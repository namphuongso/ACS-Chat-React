import React, {
  useMemo,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { ChatMessage } from '../../types/message.types';
import { useChatStore } from '../../store/chatStore';
import { useMessageStore, compareMessages, getConversationKeys } from '../../store/messageStore';
import { LoadingState } from '../LoadingState';
import { MessageItem } from '../MessageItem';
import { preloadChatImage } from '../MessageItem/ChatImage';
import { websocketService } from '../../services/websocketService';
import { useConversationStore } from '../../store/conversationStore';
import { resolveRoomId } from '../../utils/conversationKeys';
import { isDocumentVisible } from '../../utils/messageUtils';
import type { FilePreviewItem } from '../FilePreviewModal';
import styles from './MessageList.module.scss';

export interface MessageListHandle {
  scrollToMessage: (
    messageId: string,
    align?: 'center' | 'start' | 'end',
    behavior?: 'auto' | 'smooth'
  ) => Promise<boolean>;
  scrollToIndex: (
    index: number,
    align?: 'center' | 'start' | 'end',
    behavior?: 'auto' | 'smooth'
  ) => void;
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void;
  highlightMessage: (messageId: string, durationMs?: number) => void;
}

export interface MessageListProps {
  conversationId?: string;
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  renderMessage?: (message: ChatMessage) => ReactNode;
  renderSystemMessage?: (message: ChatMessage) => ReactNode;
  renderDateSeparator?: (date: Date) => ReactNode;
  renderLoadingMore?: () => ReactNode;
  roomMembers?: Array<{ userId?: string; contactName?: string; avatarUrl?: string; cui?: string }>;
  roomType?: string;
  onEditMessage?: (messageId: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onPinMessage?: (messageId: string, pin: boolean) => void;
  pinnedMessageIds?: Set<string> | string[];
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
  onDownloadAttachment?: (url: string, fileName?: string) => void;
}


type ListItem =
  { type: 'message'; data: ChatMessage } | { type: 'date-separator'; id: string; date: Date };

export const MessageList = React.memo(
  forwardRef<MessageListHandle, MessageListProps>(
    (
      {
        conversationId,
        messages,
        currentUserId,
        loading,
        loadingMore,
        hasMore,
        onLoadMore,
        renderMessage,
        renderSystemMessage,
        renderDateSeparator,
        renderLoadingMore,
        roomMembers,
        roomType,
        onEditMessage,
        onDeleteMessage,
        onPinMessage,
        pinnedMessageIds,
        onOpenAttachment,
        onDownloadAttachment,
      },
      ref
    ) => {
      const virtuosoRef = useRef<VirtuosoHandle>(null);
      const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const jumpResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
      const isJumpingRef = useRef(false);
      const pendingJumpRef = useRef<{
        messageId: string;
        attemptCount: number;
        highlightDuration?: number;
      } | null>(null);

      const jumpTarget = useMessageStore((state) => state.jumpTarget);
      const highlightedMessageId = useMessageStore((state) => state.highlightedMessageId);

      const items: ListItem[] = useMemo(() => {
        const result: ListItem[] = [];
        let currentDate = '';

        // Filter messages if roomType is 'U'
        let filteredMessages = messages;
        if (roomType === 'U') {
          filteredMessages = messages.filter((msg) => {
            if (msg.type === 'system') {
              return (
                msg.systemEvent?.type !== 'participantAdded' &&
                msg.systemEvent?.type !== 'topicUpdated'
              );
            }
            return true;
          });
        }

        // Deduplicate messages by ID
        const seenIds = new Set<string>();
        const dedupedMessages: ChatMessage[] = [];
        for (const msg of filteredMessages) {
          if (!msg || !msg.id || seenIds.has(msg.id)) continue;
          seenIds.add(msg.id);
          dedupedMessages.push(msg);
        }

        // Sort messages deterministically using compareMessages (sequenceId, then createdAt)
        const sortedMessages = [...dedupedMessages].sort(compareMessages);

        sortedMessages.forEach((msg) => {
          const msgDate = new Date(msg.createdAt).toDateString();
          if (msgDate !== currentDate) {
            result.push({
              type: 'date-separator',
              id: `date-${msgDate}`,
              date: new Date(msg.createdAt),
            });
            currentDate = msgDate;
          }
          result.push({ type: 'message', data: msg });
        });

        return result;
      }, [messages, roomType]);

      // Preload all image URLs in conversation so they are cached in memory
      useEffect(() => {
        items.forEach((item) => {
          if (item.type === 'message' && item.data.metadata?.type === 'image') {
            const meta = item.data.metadata;
            if (meta.files) {
              let files = meta.files;
              if (typeof files === 'string') {
                try {
                  files = JSON.parse(files);
                } catch {
                  files = [];
                }
              }
              if (Array.isArray(files)) {
                files.forEach((f) => {
                  if (f && typeof f === 'object' && (f as Record<string, unknown>).url) {
                    preloadChatImage(String((f as Record<string, unknown>).url));
                  }
                });
              }
            }
            if (meta.url) {
              preloadChatImage(String(meta.url));
            }
          }
        });
      }, [items]);

      const itemsRef = React.useRef<ListItem[]>([]);
      const firstItemIndexRef = React.useRef(1000000);
      const prevConversationIdRef = React.useRef<string | undefined>(conversationId);
      const initialScrolledConvRef = useRef<string | null>(null);
      const isInitialMountPhaseRef = useRef<boolean>(true);
      const hasUserScrolledUpRef = useRef<boolean>(false);
      const lastSentReadMsgIdRef = useRef<string | null>(null);

      // Track whether the initial scroll has settled so we can fade in the list
      const [isScrollReady, setIsScrollReady] = useState(false);

      useEffect(() => {
        initialScrolledConvRef.current = null;
        isInitialMountPhaseRef.current = true;
        hasUserScrolledUpRef.current = false;
        lastSentReadMsgIdRef.current = null;
        setIsScrollReady(false);
      }, [conversationId]);

      // Using firstItemIndex technique for prepending items smoothly in react-virtuoso
      // This ensures scroll position is maintained when items are added to the top
      // We only adjust firstItemIndex when items are prepended, not appended.
      const firstItemIndex = React.useMemo(() => {
        if (prevConversationIdRef.current !== conversationId) {
          prevConversationIdRef.current = conversationId;
          firstItemIndexRef.current = 1000000;
          itemsRef.current = items;
          return firstItemIndexRef.current;
        }

        const prevItems = itemsRef.current;
        if (prevItems.length > 0 && items.length > 0) {
          // Find the first message in prevItems to use as an anchor
          const prevFirstMsg = prevItems.find(
            (it): it is { type: 'message'; data: ChatMessage } => it.type === 'message'
          );

          if (prevFirstMsg) {
            const prevMsgIndex = prevItems.findIndex(
              (it) => it.type === 'message' && it.data.id === prevFirstMsg.data.id
            );
            const newMsgIndex = items.findIndex(
              (it) => it.type === 'message' && it.data.id === prevFirstMsg.data.id
            );

            if (newMsgIndex !== -1 && prevMsgIndex !== -1) {
              const diff = newMsgIndex - prevMsgIndex;
              if (diff > 0) {
                // Items were prepended before the previous first message
                firstItemIndexRef.current -= diff;
                hasUserScrolledUpRef.current = true;
                isInitialMountPhaseRef.current = false;
              }
            } else if (newMsgIndex === -1 && items.length !== prevItems.length) {
              // Message list was completely replaced or reset
              firstItemIndexRef.current = 1000000;
            }
          } else {
            // Fallback for non-message items
            const oldFirstItemId =
              prevItems[0].type === 'message' ? prevItems[0].data.id : prevItems[0].id;
            const newIndexOfOldFirstItem = items.findIndex(
              (item) => (item.type === 'message' ? item.data.id : item.id) === oldFirstItemId
            );
            if (newIndexOfOldFirstItem > 0) {
              firstItemIndexRef.current -= newIndexOfOldFirstItem;
              hasUserScrolledUpRef.current = true;
              isInitialMountPhaseRef.current = false;
            } else if (newIndexOfOldFirstItem === -1 && items.length !== prevItems.length) {
              firstItemIndexRef.current = 1000000;
            }
          }
        }
        itemsRef.current = items;
        return firstItemIndexRef.current;
      }, [items, conversationId]);

      const prevLastItemIdRef = useRef<string | null>(null);

      // Determine during this render if a new message was newly appended at the bottom by current user
      const currentLastItem = items.length > 0 ? items[items.length - 1] : null;
      const currentLastId = currentLastItem
        ? currentLastItem.type === 'message'
          ? currentLastItem.data.id
          : currentLastItem.id
        : null;

      const isNewLastItem =
        prevLastItemIdRef.current !== null &&
        currentLastId !== null &&
        currentLastId !== prevLastItemIdRef.current;

      const isOwnNewLastItem =
        isNewLastItem &&
        currentLastItem?.type === 'message' &&
        (currentLastItem.data.sender.id === currentUserId ||
          currentLastItem.data.id.startsWith('temp-') ||
          currentLastItem.data.status === 'sending');

      // Keep a ref to the latest items so scroll callbacks always use the current length
      const latestItemsRef = useRef(items);
      latestItemsRef.current = items;

      // Refs for initial scroll timers — kept outside the effect so they survive re-renders
      const initialScrollTimersRef = useRef<{
        rafs: number[];
        timeouts: ReturnType<typeof setTimeout>[];
      }>({ rafs: [], timeouts: [] });

      const markLatestMessageAsRead = useCallback(() => {
        if (!isDocumentVisible()) return;
        const currentItems = latestItemsRef.current;
        for (let i = currentItems.length - 1; i >= 0; i--) {
          const item = currentItems[i];
          if (
            item.type === 'message' &&
            item.data?.id &&
            !item.data.id.startsWith('temp-') &&
            item.data.status !== 'sending' &&
            item.data.status !== 'failed'
          ) {
            if (currentUserId && item.data.sender?.id === currentUserId) {
              continue;
            }
            const msgId = item.data.id;
            if (lastSentReadMsgIdRef.current !== msgId) {
              lastSentReadMsgIdRef.current = msgId;
              const roomId = conversationId
                ? resolveRoomId(conversationId, useConversationStore.getState().conversations)
                : undefined;
              websocketService.sendRead(msgId, roomId);
            }
            break;
          }
        }
      }, [conversationId, currentUserId]);

      // Core scroll-to-bottom function (always reads latest items from ref)
      const scrollToBottomImmediate = useCallback(() => {
        const currentItems = latestItemsRef.current;
        if (virtuosoRef.current && currentItems.length > 0) {
          virtuosoRef.current.scrollToIndex({
            index: currentItems.length - 1,
            align: 'end',
            behavior: 'auto',
          });
        }
      }, []);

      // Helper: schedule aggressive scroll-to-bottom with retries
      const scheduleScrollToBottom = useCallback(() => {
        // Clear any previously scheduled scroll timers
        initialScrollTimersRef.current.rafs.forEach(cancelAnimationFrame);
        initialScrollTimersRef.current.timeouts.forEach(clearTimeout);
        initialScrollTimersRef.current = { rafs: [], timeouts: [] };

        scrollToBottomImmediate();
        const r1 = requestAnimationFrame(scrollToBottomImmediate);
        const r2 = requestAnimationFrame(() => requestAnimationFrame(scrollToBottomImmediate));
        const t1 = setTimeout(scrollToBottomImmediate, 50);
        const t2 = setTimeout(scrollToBottomImmediate, 150);
        const t3 = setTimeout(scrollToBottomImmediate, 300);
        const t4 = setTimeout(scrollToBottomImmediate, 600);
        const t5 = setTimeout(scrollToBottomImmediate, 1000);
        // Reveal the list after scroll attempts have had time to settle
        const t6 = setTimeout(() => {
          setIsScrollReady(true);
          markLatestMessageAsRead();
        }, 200);
        const t7 = setTimeout(() => {
          isInitialMountPhaseRef.current = false;
        }, 2500);

        initialScrollTimersRef.current = {
          rafs: [r1, r2],
          timeouts: [t1, t2, t3, t4, t5, t6, t7],
        };
      }, [scrollToBottomImmediate, markLatestMessageAsRead]);

      // Scroll to bottom on initial mount or when items first become available
      useEffect(() => {
        if (
          items.length > 0 &&
          initialScrolledConvRef.current !== (conversationId || '__default__') &&
          !jumpTarget?.messageId &&
          !pendingJumpRef.current
        ) {
          initialScrolledConvRef.current = conversationId || '__default__';
          scheduleScrollToBottom();
          markLatestMessageAsRead();
        }
      }, [items.length, conversationId, jumpTarget?.messageId, scheduleScrollToBottom, markLatestMessageAsRead]);

      // When items change while user is at the bottom, mark latest message as read
      useEffect(() => {
        if (!hasUserScrolledUpRef.current || isOwnNewLastItem) {
          markLatestMessageAsRead();
        }
      }, [items, isOwnNewLastItem, markLatestMessageAsRead]);

      // Cleanup initial scroll timers on unmount
      useEffect(() => {
        return () => {
          initialScrollTimersRef.current.rafs.forEach(cancelAnimationFrame);
          initialScrollTimersRef.current.timeouts.forEach(clearTimeout);
        };
      }, []);

      // Self-correcting scroll: when Virtuoso's total list height changes during initial mount
      // (e.g., images load, dynamic content resolves), re-scroll to bottom
      const handleTotalListHeightChanged = useCallback(() => {
        if (isInitialMountPhaseRef.current && !isJumpingRef.current && !pendingJumpRef.current) {
          scrollToBottomImmediate();
        }
      }, [scrollToBottomImmediate]);

      const followOutput = useCallback(
        (isAtBottom: boolean) => {
          if (isJumpingRef.current || pendingJumpRef.current || jumpTarget?.messageId) {
            return false;
          }

          if (isOwnNewLastItem) {
            hasUserScrolledUpRef.current = false;
            return 'auto';
          }

          // During initial mount phase (while images/DOM are laying out) or when anchored at bottom
          if (isInitialMountPhaseRef.current || !hasUserScrolledUpRef.current || isAtBottom) {
            return 'auto';
          }

          return false;
        },
        [isOwnNewLastItem, jumpTarget?.messageId]
      );

      useEffect(() => {
        prevLastItemIdRef.current = currentLastId;
      }, [currentLastId]);

      const triggerHighlight = useCallback((messageId: string, durationMs = 2500) => {
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
        }
        useMessageStore.getState().setHighlightedMessageId(messageId);
        highlightTimerRef.current = setTimeout(() => {
          useMessageStore.getState().setHighlightedMessageId(null);
        }, durationMs);
      }, []);

      const matchMessage = (item: ListItem, targetId: string): boolean => {
        if (item.type !== 'message' || !item.data) return false;
        const msg = item.data;
        const target = String(targetId).trim();
        const metadata = msg.metadata;
        const rawMsg = msg as unknown as Record<string, unknown>;
        return (
          String(msg.id).trim() === target ||
          (Boolean(rawMsg.messageId) && String(rawMsg.messageId).trim() === target) ||
          (Boolean(msg.clientMessageId) && String(msg.clientMessageId).trim() === target) ||
          (Boolean(msg.sequenceId) && String(msg.sequenceId).trim() === target) ||
          (Boolean(metadata?.clientMessageId) &&
            String(metadata?.clientMessageId).trim() === target) ||
          (Boolean(metadata?.messageId) && String(metadata?.messageId).trim() === target) ||
          (Boolean(metadata?.id) && String(metadata?.id).trim() === target)
        );
      };

      const executeScroll = useCallback(
        (
          targetIndex: number,
          targetMessageId: string,
          align: 'center' | 'start' | 'end' = 'center',
          behavior: 'auto' | 'smooth' = 'smooth',
          highlightDuration?: number
        ) => {
          isJumpingRef.current = true;
          hasUserScrolledUpRef.current = true;
          isInitialMountPhaseRef.current = false;
          if (jumpResetTimeoutRef.current) {
            clearTimeout(jumpResetTimeoutRef.current);
          }

          // Virtuoso scrollToIndex expects 0-based data index (0 to items.length - 1)
          virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align,
            behavior,
          });

          // Re-verify alignment on next frame after DOM render/measurement
          requestAnimationFrame(() => {
            virtuosoRef.current?.scrollToIndex({
              index: targetIndex,
              align,
              behavior: 'auto',
            });
            const el = document.getElementById(`acs-msg-${targetMessageId}`);
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
          });

          // Delayed safety check after layout settles
          setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({
              index: targetIndex,
              align,
              behavior: 'auto',
            });
            const el = document.getElementById(`acs-msg-${targetMessageId}`);
            if (el && typeof el.scrollIntoView === 'function') {
              el.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
          }, 100);

          triggerHighlight(targetMessageId, highlightDuration);
          pendingJumpRef.current = null;
          useMessageStore.getState().clearJumpTarget();

          jumpResetTimeoutRef.current = setTimeout(() => {
            isJumpingRef.current = false;
          }, 2000);
        },
        [triggerHighlight]
      );

      const scrollToMessage = useCallback(
        async (
          targetMessageId: string,
          align: 'center' | 'start' | 'end' = 'center',
          behavior: 'auto' | 'smooth' = 'smooth',
          highlightDuration?: number
        ): Promise<boolean> => {
          isJumpingRef.current = true;
          const itemIndex = items.findIndex((item) => matchMessage(item, targetMessageId));

          if (itemIndex !== -1) {
            const foundMessageId =
              items[itemIndex].type === 'message' ? items[itemIndex].data.id : targetMessageId;
            executeScroll(itemIndex, foundMessageId, align, behavior, highlightDuration);
            return true;
          }

          // If not in current list and we have older messages to fetch (or loading)
          if (hasMore || loadingMore || loading) {
            pendingJumpRef.current = {
              messageId: targetMessageId,
              attemptCount: (pendingJumpRef.current?.attemptCount || 0) + 1,
              highlightDuration,
            };
            if (!loadingMore && !loading) {
              onLoadMore();
            }
            return false;
          }

          pendingJumpRef.current = null;
          useMessageStore.getState().clearJumpTarget();
          isJumpingRef.current = false;
          return false;
        },
        [items, hasMore, loadingMore, loading, onLoadMore, executeScroll]
      );

      // Imperative handle ref
      useImperativeHandle(
        ref,
        () => ({
          scrollToMessage: (messageId, align = 'center', behavior = 'smooth') =>
            scrollToMessage(messageId, align, behavior),
          scrollToIndex: (index, align = 'center', behavior = 'smooth') => {
            virtuosoRef.current?.scrollToIndex({
              index,
              align,
              behavior,
            });
          },
          scrollToBottom: (behavior = 'smooth') => {
            hasUserScrolledUpRef.current = false;
            if (items.length > 0) {
              virtuosoRef.current?.scrollToIndex({
                index: items.length - 1,
                align: 'end',
                behavior,
              });
            }
          },
          highlightMessage: (messageId, durationMs) => {
            triggerHighlight(messageId, durationMs);
          },
        }),
        [items.length, scrollToMessage, triggerHighlight]
      );

      // Listen for jumpTarget changes from store
      useEffect(() => {
        if (!jumpTarget?.messageId) return;

        // If jumpTarget specified a conversationId, ensure it matches this list's conversation
        if (jumpTarget.conversationId && conversationId) {
          const targetKeys = new Set(getConversationKeys(jumpTarget.conversationId));
          const currentKeys = getConversationKeys(conversationId);
          const isMatch =
            jumpTarget.conversationId === conversationId ||
            currentKeys.some((k) => targetKeys.has(k));
          if (!isMatch) {
            return;
          }
        }

        isJumpingRef.current = true;
        scrollToMessage(jumpTarget.messageId, 'center', 'smooth', jumpTarget.highlightDuration);
      }, [jumpTarget, conversationId, scrollToMessage]);

      // Check pending jump when items change (after pagination)
      useEffect(() => {
        if (!pendingJumpRef.current) return;

        const { messageId, attemptCount, highlightDuration } = pendingJumpRef.current;
        const itemIndex = items.findIndex((item) => matchMessage(item, messageId));

        if (itemIndex !== -1) {
          const foundMessageId =
            items[itemIndex].type === 'message' ? items[itemIndex].data.id : messageId;
          executeScroll(itemIndex, foundMessageId, 'center', 'smooth', highlightDuration);
          return;
        }

        // If currently loading older messages, wait for loading to finish! Do NOT cancel!
        if (loadingMore || loading) {
          return;
        }

        // If not found yet and there are more older messages to fetch
        if (hasMore && attemptCount < 30) {
          pendingJumpRef.current = {
            messageId,
            attemptCount: attemptCount + 1,
            highlightDuration,
          };
          onLoadMore();
        } else {
          // Genuinely exhausted pagination or max attempts reached
          pendingJumpRef.current = null;
          useMessageStore.getState().clearJumpTarget();
          isJumpingRef.current = false;
        }
      }, [items, hasMore, loadingMore, loading, onLoadMore, executeScroll]);

      // Cleanup highlight timeout on unmount
      useEffect(() => {
        return () => {
          if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
          }
          if (jumpResetTimeoutRef.current) {
            clearTimeout(jumpResetTimeoutRef.current);
          }
        };
      }, []);

      const handleStartReached = useCallback(() => {
        if (hasMore && !loadingMore && !loading) {
          onLoadMore();
        }
      }, [hasMore, loadingMore, loading, onLoadMore]);

      const defaultRenderDateSeparator = (date: Date) => {
        const formattedDate = date.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        return (
          <div className={styles.dateSeparator}>
            <span>{formattedDate}</span>
          </div>
        );
      };

      const defaultRenderLoadingMore = () => (
        <div className={styles.loadingMore}>Loading previous messages...</div>
      );

      const defaultRenderMessage = (message: ChatMessage, index: number, allItems: ListItem[]) => {
        const currentUser = useChatStore.getState()?.currentUser;
        const currentDisplayName = currentUser?.displayName;

        const isSenderSelf = (msg: ChatMessage): boolean => {
          if (msg.sender?.id && currentUserId && msg.sender.id === currentUserId) return true;
          if (
            roomMembers?.some(
              (m) =>
                (m.cui === currentUserId || m.userId === currentUserId) &&
                (m.cui === msg.sender?.id || m.userId === msg.sender?.id)
            )
          ) {
            return true;
          }
          if (
            currentDisplayName &&
            currentDisplayName !== 'Unknown' &&
            (msg.senderDisplayName === currentDisplayName ||
              msg.sender?.displayName === currentDisplayName)
          ) {
            return true;
          }
          return msg.id.startsWith('temp-') || msg.status === 'sending';
        };

        const isSameSenderAs = (a: ChatMessage, b: ChatMessage): boolean => {
          if (a.sender?.id && b.sender?.id && a.sender.id === b.sender.id) return true;
          const aSelf = isSenderSelf(a);
          const bSelf = isSenderSelf(b);
          if (aSelf && bSelf) return true;
          if (
            a.senderDisplayName &&
            b.senderDisplayName &&
            a.senderDisplayName !== 'Unknown' &&
            a.senderDisplayName === b.senderDisplayName
          ) {
            return true;
          }
          if (
            a.sender?.displayName &&
            b.sender?.displayName &&
            a.sender.displayName !== 'Unknown' &&
            a.sender.displayName === b.sender.displayName
          ) {
            return true;
          }
          return false;
        };

        const isOwn = isSenderSelf(message);

        // Determine if it's the first message in a group
        let isFirstInGroup = true;
        if (index > 0) {
          const prevItem = allItems[index - 1];
          if (prevItem?.type === 'message' && isSameSenderAs(prevItem.data, message)) {
            isFirstInGroup = false;
          }
        }

        // Determine if it's the last message in a group
        let isLastInGroup = true;
        if (index < allItems.length - 1) {
          const nextItem = allItems[index + 1];
          if (nextItem?.type === 'message' && isSameSenderAs(nextItem.data, message)) {
            isLastInGroup = false;
          }
        }

        const senderMember = roomMembers?.find(
          (m) => m.cui === message.sender.id || m.userId === message.sender.id
        );

        return (
          <MessageItem
            key={message.id}
            message={message}
            senderDisplayName={senderMember?.contactName}
            isOwn={isOwn}
            showSender={isFirstInGroup}
            isLastInGroup={isLastInGroup}
            isPinned={
              pinnedMessageIds instanceof Set
                ? pinnedMessageIds.has(message.id)
                : Array.isArray(pinnedMessageIds)
                  ? pinnedMessageIds.includes(message.id)
                  : false
            }
            isHighlighted={
              Boolean(highlightedMessageId) &&
              (highlightedMessageId === message.id ||
                (Boolean((message as unknown as Record<string, unknown>).messageId) &&
                  highlightedMessageId ===
                    (message as unknown as Record<string, unknown>).messageId) ||
                (Boolean(message.sequenceId) && highlightedMessageId === message.sequenceId) ||
                (Boolean(message.clientMessageId) &&
                  highlightedMessageId === message.clientMessageId) ||
                (Boolean(message.metadata?.messageId) &&
                  highlightedMessageId === message.metadata?.messageId) ||
                (Boolean(message.metadata?.id) && highlightedMessageId === message.metadata?.id))
            }
            onEdit={onEditMessage}
            onDelete={onDeleteMessage}
            onPin={onPinMessage}
            onOpenAttachment={onOpenAttachment}
            onDownloadAttachment={onDownloadAttachment}
            currentUserId={currentUserId}
            roomMembers={roomMembers}
          />
        );
      };

      if (loading && messages.length === 0) {
        return (
          <div className={styles.messageListContainer}>
            <LoadingState />
          </div>
        );
      }

      return (
        <div className={styles.messageListContainer}>
          <Virtuoso
            key={conversationId || '__default__'}
            ref={virtuosoRef}
            style={{
              height: '100%',
              width: '100%',
              overflowX: 'hidden',
              opacity: isScrollReady || items.length === 0 ? 1 : 0,
              transition: 'opacity 0.15s ease-in',
            }}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={
              items.length > 0
                ? {
                    index: items.length - 1,
                    align: 'end',
                  }
                : 0
            }
            data={items}
            startReached={handleStartReached}
            atBottomThreshold={60}
            atBottomStateChange={(atBottom) => {
              if (atBottom) {
                hasUserScrolledUpRef.current = false;
                // If we reach bottom during mount phase, mark scroll as ready
                if (isInitialMountPhaseRef.current && !isScrollReady) {
                  setIsScrollReady(true);
                }
                markLatestMessageAsRead();
              } else if (isInitialMountPhaseRef.current) {
                // During initial mount, if we detect we're not at bottom, force re-scroll
                // This self-corrects when layout shifts push us away from the bottom
                scrollToBottomImmediate();
              } else {
                hasUserScrolledUpRef.current = true;
              }
            }}
            totalListHeightChanged={handleTotalListHeightChanged}
            computeItemKey={(_, item) => (item.type === 'message' ? item.data.id : item.id)}
            overscan={{ main: 1500, reverse: 1500 }}
            increaseViewportBy={{ top: 1200, bottom: 1200 }}
            itemContent={(virtuosoIndex, item) => {
              const dataIndex = virtuosoIndex - firstItemIndex;

              if (item.type === 'date-separator') {
                return renderDateSeparator
                  ? renderDateSeparator(item.date)
                  : defaultRenderDateSeparator(item.date);
              }

              if (item.data.type === 'system') {
                return renderSystemMessage
                  ? renderSystemMessage(item.data)
                  : defaultRenderMessage(item.data, dataIndex, items);
              }

              return renderMessage
                ? renderMessage(item.data)
                : defaultRenderMessage(item.data, dataIndex, items);
            }}
            components={{
              Header: () =>
                loadingMore
                  ? renderLoadingMore
                    ? renderLoadingMore()
                    : defaultRenderLoadingMore()
                  : null,
            }}
            followOutput={followOutput}
            alignToBottom
          />
        </div>
      );
    }
  )
);
