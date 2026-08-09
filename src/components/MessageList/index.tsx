import React, { useMemo, ReactNode, useCallback, useRef, useEffect } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { ChatMessage } from '../../types/message.types';
import { LoadingState } from '../LoadingState';
import { MessageItem } from '../MessageItem';
import styles from './MessageList.module.scss';

export interface MessageListProps {
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
}

type ListItem =
  | { type: 'message'; data: ChatMessage }
  | { type: 'date-separator'; id: string; date: Date };

export const MessageList: React.FC<MessageListProps> = React.memo(
  ({
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
  }) => {
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

      // Sort messages by createdAt to ensure chronological order
      const sortedMessages = [...filteredMessages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

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

    const itemsRef = React.useRef<ListItem[]>([]);
    const firstItemIndexRef = React.useRef(1000000);

    // Using firstItemIndex technique for prepending items smoothly in react-virtuoso
    // This ensures scroll position is maintained when items are added to the top
    // We only adjust firstItemIndex when items are prepended, not appended.
    const firstItemIndex = React.useMemo(() => {
      const prevItems = itemsRef.current;
      if (prevItems.length > 0 && items.length > 0) {
        const oldFirstItemId = prevItems[0].type === 'message' ? prevItems[0].data.id : prevItems[0].id;
        const newIndexOfOldFirstItem = items.findIndex((item) =>
          (item.type === 'message' ? item.data.id : item.id) === oldFirstItemId
        );

        if (newIndexOfOldFirstItem > 0) {
          firstItemIndexRef.current -= newIndexOfOldFirstItem;
        }
      }
      itemsRef.current = items;
      return firstItemIndexRef.current;
    }, [items]);

    const isAppendingOwnMessageRef = useRef(false);
    const prevItemsLengthRef = useRef(items.length);

    // Determine if we are appending our own message during this render cycle
    if (items.length > prevItemsLengthRef.current) {
      const lastItem = items[items.length - 1];
      if (
        lastItem &&
        lastItem.type === 'message' &&
        lastItem.data.sender.id === currentUserId
      ) {
        isAppendingOwnMessageRef.current = true;
      } else {
        isAppendingOwnMessageRef.current = false;
      }
    } else {
      isAppendingOwnMessageRef.current = false;
    }

    useEffect(() => {
      prevItemsLengthRef.current = items.length;
    }, [items.length]);

    const handleStartReached = useCallback(() => {
      if (hasMore && !loadingMore && !loading) {
        onLoadMore();
      }
    }, [hasMore, loadingMore, loading, onLoadMore]);

    const defaultRenderDateSeparator = (date: Date) => {
      const formattedDate = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
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
      const isOwn = message.sender.id === currentUserId;

      // Determine if it's the first message in a group
      let isFirstInGroup = true;
      if (index > 0) {
        const prevItem = allItems[index - 1];
        if (prevItem.type === 'message' && prevItem.data.sender.id === message.sender.id) {
          isFirstInGroup = false;
        }
      }

      // Determine if it's the last message in a group
      let isLastInGroup = true;
      if (index < allItems.length - 1) {
        const nextItem = allItems[index + 1];
        if (nextItem.type === 'message' && nextItem.data.sender.id === message.sender.id) {
          isLastInGroup = false;
        }
      }

      const senderMember = roomMembers?.find((m) => m.cui === message.sender.id);
      
      const displayMessage = {
        ...message,
        senderDisplayName: senderMember?.contactName || message.senderDisplayName || message.sender?.displayName || message.sender?.id,
      };

      return (
        <MessageItem
          key={message.id}
          message={displayMessage}
          isOwn={isOwn}
          showSender={isFirstInGroup}
          isLastInGroup={isLastInGroup}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
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
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={items.length > 0 ? firstItemIndex + items.length - 1 : 0}
          data={items}
          startReached={handleStartReached}
          computeItemKey={(_, item) => (item.type === 'message' ? item.data.id : item.id)}
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
          followOutput={(isAtBottom) => {
            if (isAppendingOwnMessageRef.current) {
              return 'auto';
            }
            return isAtBottom ? 'smooth' : false;
          }}
          alignToBottom
        />
      </div>
    );
  }
);
