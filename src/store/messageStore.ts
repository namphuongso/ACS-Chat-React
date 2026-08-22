import { create } from 'zustand';
import type { ChatMessage, PinnedMessage } from '../types/message.types';
import { resolveConversationKeys } from '../utils/conversationKeys';
import { useConversationStore } from './conversationStore';
import { useChatStore } from './chatStore';
import { registerMessageStore } from './registry';

export interface ConversationMessages {
  /** Ordered array of messages (oldest to newest) */
  messages: ChatMessage[];
  /** Loading flag for initial page fetch */
  loading: boolean;
  /** Loading flag for fetching older pages */
  loadingMore: boolean;
  /** Indicates if older messages exist for pagination */
  hasMore: boolean;
  /** Indicates if initial messages have been fetched */
  hasFetched?: boolean;
  /** ID of the oldest loaded message for cursor reference */
  oldestLoadedMessageId?: string;
  /** Continuation token for backend API pagination */
  continuationToken?: string | null;
  /** Pinned messages for this conversation */
  pinnedMessages?: PinnedMessage[];
  /** Loading flag for pinned messages */
  loadingPinned?: boolean;
  /** Indicates if pinned messages have been fetched */
  hasFetchedPinned?: boolean;
}

export interface MessageState {
  /** Map of conversation ID to ConversationMessages structure */
  messagesByConversation: Record<string, ConversationMessages>;

  /** Target message to jump/scroll to */
  jumpTarget: {
    conversationId?: string;
    messageId: string;
    timestamp: number;
    highlightDuration?: number;
  } | null;
  /** Currently highlighted message ID */
  highlightedMessageId: string | null;

  /** Add or update a message in a conversation (handles dedup & optimistic replacement) */
  addMessage: (conversationId: string, message: ChatMessage) => void;
  /** Prepend older messages for pagination (handles dedup & sorting) */
  prependMessages: (
    conversationId: string,
    messages: ChatMessage[],
    hasMore?: boolean,
    continuationToken?: string | null
  ) => void;
  /** Replace or set all messages for a conversation */
  setMessages: (
    conversationId: string,
    messages: ChatMessage[],
    hasMore?: boolean,
    continuationToken?: string | null
  ) => void;
  /** Update properties of an existing message */
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  /** Remove a message by ID from a conversation */
  removeMessage: (conversationId: string, messageId: string) => void;
  /** Set initial loading flag for a conversation */
  setLoading: (conversationId: string, loading: boolean) => void;
  /** Set pagination loading flag for a conversation */
  setLoadingMore: (conversationId: string, loadingMore: boolean) => void;
  /** Set hasMore pagination flag for a conversation */
  setHasMore: (conversationId: string, hasMore: boolean) => void;
  /** Set continuationToken for a conversation */
  setContinuationToken: (conversationId: string, continuationToken: string | null) => void;
  /** Set fetched flag for initial messages */
  setHasFetched: (conversationId: string, hasFetched: boolean) => void;
  /** Set pinned messages for a conversation */
  setPinnedMessages: (conversationId: string, messages: PinnedMessage[]) => void;
  /** Add a pinned message if pinned messages have been fetched/cached */
  addPinnedMessage: (conversationId: string, message: PinnedMessage) => void;
  /** Remove a pinned message by ID if pinned messages have been fetched/cached */
  removePinnedMessage: (conversationId: string, messageId: string) => void;
  /** Set loading flag for pinned messages */
  setLoadingPinned: (conversationId: string, loading: boolean) => void;
  /** Set fetched flag for pinned messages */
  setHasFetchedPinned: (conversationId: string, hasFetched: boolean) => void;
  /** Trim messages for inactive conversations to a limit to save memory */
  trimInactiveConversations: (activeConversationId: string | null, keepLimit?: number) => void;
  /** Jump to a specific message ID with optional conversation and highlight duration */
  jumpToMessage: (messageId: string, conversationId?: string, highlightDuration?: number) => void;
  /** Set currently highlighted message ID */
  setHighlightedMessageId: (messageId: string | null) => void;
  /** Clear active jump target */
  clearJumpTarget: () => void;
  /** Reset message store state back to initial state */
  reset: () => void;
}

export const initialConversationMessages: ConversationMessages = {
  messages: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  hasFetched: false,
  continuationToken: null,
  pinnedMessages: [],
  loadingPinned: false,
  hasFetchedPinned: false,
};

export const initialMessageState = {
  messagesByConversation: {},
  jumpTarget: null,
  highlightedMessageId: null,
};

export const getConversationKeys = (conversationId: string): string[] => {
  if (!conversationId) return [];
  try {
    const conversations = useConversationStore.getState()?.conversations;
    return resolveConversationKeys(conversationId, conversations);
  } catch {
    // Ignore store resolution errors in isolated unit tests
    return [conversationId];
  }
};

/**
 * Compare two messages for sorting (oldest first).
 * Primary sort key: numeric sequenceId (if available on both).
 * Secondary sort key: createdAt timestamp.
 */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.sequenceId && b.sequenceId) {
    const seqA = parseInt(a.sequenceId, 10);
    const seqB = parseInt(b.sequenceId, 10);
    if (!isNaN(seqA) && !isNaN(seqB) && seqA !== seqB) {
      return seqA - seqB;
    }
  }
  const timeA =
    a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
  const timeB =
    b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
  return timeA - timeB;
}

/**
 * Client/server clock skew tolerance when matching an optimistic message
 * to its server confirmation by createdAt timestamps.
 */
const CLOCK_SKEW_TOLERANCE_MS = 60_000;

/**
 * Deduplicate and sort existing + incoming messages.
 * Replaces optimistic entries when server confirmation arrives,
 * even when the WebSocket push event lacks clientMessageId or uses different sender ID formats.
 * Messages that are provably distinct (different clientMessageId / sequenceId) are never
 * treated as duplicates, and a confirmation must not predate its optimistic counterpart,
 * so identical messages sent by the same user in quick succession are not lost.
 */
export function dedupAndSortMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const messageMap = new Map<string, ChatMessage>();
  const clientMsgIdToId = new Map<string, string>();

  let currentUserId: string | undefined;
  let currentDisplayName: string | undefined;
  try {
    const currentUser = useChatStore.getState()?.currentUser;
    currentUserId = currentUser?.id;
    currentDisplayName = currentUser?.displayName;
  } catch {
    // Ignore in tests where chatStore is not initialized
  }

  const stripHtml = (s?: string) => (s || '').replace(/<[^>]*>?/gm, '').trim();

  const isSenderMatch = (a: ChatMessage, b: ChatMessage): boolean => {
    if (a.sender?.id && b.sender?.id && a.sender.id === b.sender.id) return true;
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
    const aIsMe =
      (currentUserId && a.sender?.id === currentUserId) ||
      (currentDisplayName &&
        currentDisplayName !== 'Unknown' &&
        (a.sender?.displayName === currentDisplayName ||
          a.senderDisplayName === currentDisplayName)) ||
      a.id.startsWith('temp-') ||
      a.status === 'sending';
    const bIsMe =
      (currentUserId && b.sender?.id === currentUserId) ||
      (currentDisplayName &&
        currentDisplayName !== 'Unknown' &&
        (b.sender?.displayName === currentDisplayName ||
          b.senderDisplayName === currentDisplayName)) ||
      b.id.startsWith('temp-') ||
      b.status === 'sending';
    return Boolean(aIsMe && bIsMe);
  };

  const isProvablyDistinct = (a: ChatMessage, b: ChatMessage): boolean => {
    if (a.clientMessageId && b.clientMessageId && a.clientMessageId !== b.clientMessageId) {
      return true;
    }
    if (a.sequenceId && b.sequenceId && a.sequenceId !== b.sequenceId) {
      return true;
    }
    return false;
  };

  const isConfirmationOf = (optimistic: ChatMessage, confirmed: ChatMessage): boolean => {
    if (
      optimistic.clientMessageId &&
      confirmed.clientMessageId &&
      optimistic.clientMessageId === confirmed.clientMessageId
    ) {
      return true;
    }
    const optimisticTime = new Date(optimistic.createdAt).getTime();
    const confirmedTime = new Date(confirmed.createdAt).getTime();
    if (isNaN(optimisticTime) || isNaN(confirmedTime)) {
      return true;
    }
    // Two-sided tolerance for clock skew between device and server
    return Math.abs(confirmedTime - optimisticTime) <= CLOCK_SKEW_TOLERANCE_MS;
  };

  // Populate map with existing messages (filtering out invalid IDs)
  for (const msg of existing) {
    if (
      !msg ||
      !msg.id ||
      msg.id === '[object Object]' ||
      msg.id === 'null' ||
      msg.id === 'undefined'
    ) {
      continue;
    }
    messageMap.set(msg.id, msg);
    if (msg.clientMessageId) {
      clientMsgIdToId.set(msg.clientMessageId, msg.id);
    }
  }

  // Merge incoming messages, replacing optimistic entries
  for (const msg of incoming) {
    if (
      !msg ||
      !msg.id ||
      msg.id === '[object Object]' ||
      msg.id === 'null' ||
      msg.id === 'undefined'
    ) {
      continue;
    }

    // 1. If incoming message matches an existing clientMessageId mapping, remove the temporary entry
    if (msg.clientMessageId && clientMsgIdToId.has(msg.clientMessageId)) {
      const oldId = clientMsgIdToId.get(msg.clientMessageId)!;
      if (oldId !== msg.id) {
        messageMap.delete(oldId);
      }
    }
    if (msg.clientMessageId && messageMap.has(msg.clientMessageId)) {
      messageMap.delete(msg.clientMessageId);
    }

    // 2. If incoming message is from server (confirmed ID) and has no clientMessageId,
    // match against any pending optimistic message (temp ID or status sending) with same sender & content
    const isServerConfirmed = !msg.id.startsWith('temp-') && msg.status !== 'sending';
    if (isServerConfirmed) {
      for (const [existingId, existingMsg] of messageMap.entries()) {
        const isOptimistic = existingId.startsWith('temp-') || existingMsg.status === 'sending';

        if (isOptimistic && !isProvablyDistinct(existingMsg, msg)) {
          const sameSender = isSenderMatch(existingMsg, msg);
          const sameContent =
            existingMsg.content === msg.content ||
            stripHtml(existingMsg.content) === stripHtml(msg.content);

          if (sameSender && sameContent && isConfirmationOf(existingMsg, msg)) {
            messageMap.delete(existingId);
            if (existingMsg.clientMessageId) {
              clientMsgIdToId.delete(existingMsg.clientMessageId);
            }
            break;
          }
        }
      }
    }

    const existingEntry = messageMap.get(msg.id);
    if (existingEntry) {
      messageMap.set(msg.id, { ...existingEntry, ...msg });
    } else {
      messageMap.set(msg.id, msg);
    }

    if (msg.clientMessageId) {
      clientMsgIdToId.set(msg.clientMessageId, msg.id);
    }
  }

  // Final cleanup of any invalid keys
  messageMap.delete('[object Object]');
  messageMap.delete('null');
  messageMap.delete('undefined');
  messageMap.delete('');

  // Deduplicate any lingering temporary/optimistic duplicates vs confirmed messages
  const existingConfirmedIds = new Set(
    existing
      .filter((m) => m && m.id && !m.id.startsWith('temp-') && m.status !== 'sending')
      .map((m) => m.id)
  );
  const incomingOptimisticIds = new Set(
    incoming
      .filter((m) => m && m.id && (m.id.startsWith('temp-') || m.status === 'sending'))
      .map((m) => m.id)
  );

  const allMessages = Array.from(messageMap.values());
  const confirmedMessages = allMessages.filter(
    (m) => !m.id.startsWith('temp-') && m.status !== 'sending'
  );

  const finalMessages: ChatMessage[] = [];
  for (const msg of allMessages) {
    if (msg.id.startsWith('temp-') || msg.status === 'sending') {
      const hasMatchingConfirmed = confirmedMessages.some((cm) => {
        // An existing confirmed message present before this optimistic message was created
        // cannot be its confirmation unless clientMessageId explicitly matches
        if (
          existingConfirmedIds.has(cm.id) &&
          incomingOptimisticIds.has(msg.id) &&
          (!msg.clientMessageId || !cm.clientMessageId || msg.clientMessageId !== cm.clientMessageId)
        ) {
          return false;
        }

        if (isProvablyDistinct(msg, cm)) {
          return false;
        }
        const sameSender = isSenderMatch(msg, cm);
        const sameContent =
          msg.content === cm.content || stripHtml(msg.content) === stripHtml(cm.content);
        const timeDiff = Math.abs(
          new Date(msg.createdAt).getTime() - new Date(cm.createdAt).getTime()
        );
        return (
          sameSender &&
          sameContent &&
          timeDiff <= 60000 &&
          isConfirmationOf(msg, cm)
        );
      });
      if (hasMatchingConfirmed) {
        continue; // Skip this duplicate temp message
      }
    }
    finalMessages.push(msg);
  }

  finalMessages.sort(compareMessages);
  return finalMessages;
}

export const useMessageStore = create<MessageState>((set) => ({
  ...initialMessageState,

  addMessage: (conversationId: string, message: ChatMessage) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        const updatedMessages = dedupAndSortMessages(convData.messages, [message]);
        newMessagesByConversation[key] = {
          ...convData,
          messages: updatedMessages,
          oldestLoadedMessageId: updatedMessages[0]?.id,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  prependMessages: (
    conversationId: string,
    messages: ChatMessage[],
    hasMore?: boolean,
    continuationToken?: string | null
  ) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        const updatedMessages = dedupAndSortMessages(convData.messages, messages);
        newMessagesByConversation[key] = {
          ...convData,
          messages: updatedMessages,
          hasMore: hasMore !== undefined ? hasMore : convData.hasMore,
          continuationToken:
            continuationToken !== undefined ? continuationToken : convData.continuationToken,
          oldestLoadedMessageId: updatedMessages[0]?.id,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setMessages: (
    conversationId: string,
    messages: ChatMessage[],
    hasMore?: boolean,
    continuationToken?: string | null
  ) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        const updatedMessages = dedupAndSortMessages([], messages);
        newMessagesByConversation[key] = {
          ...convData,
          messages: updatedMessages,
          hasMore: hasMore !== undefined ? hasMore : convData.hasMore,
          continuationToken:
            continuationToken !== undefined ? continuationToken : convData.continuationToken,
          oldestLoadedMessageId: updatedMessages[0]?.id,
          hasFetched: true,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };
      let anyFound = false;

      for (const key of keys) {
        const convData = newMessagesByConversation[key];
        if (!convData) continue;

        let found = false;
        const updatedMessages = convData.messages.map((msg) => {
          if (msg.id === messageId || (msg.clientMessageId && msg.clientMessageId === messageId)) {
            found = true;
            return { ...msg, ...updates };
          }
          return msg;
        });

        if (found) {
          anyFound = true;
          updatedMessages.sort(compareMessages);
          newMessagesByConversation[key] = {
            ...convData,
            messages: updatedMessages,
            oldestLoadedMessageId: updatedMessages[0]?.id,
          };
        }
      }

      if (!anyFound) return state;

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  removeMessage: (conversationId: string, messageId: string) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };
      let anyFound = false;

      for (const key of keys) {
        const convData = newMessagesByConversation[key];
        if (!convData) continue;

        const filtered = convData.messages.filter(
          (msg) => msg.id !== messageId && msg.clientMessageId !== messageId
        );

        if (filtered.length !== convData.messages.length) {
          anyFound = true;
          newMessagesByConversation[key] = {
            ...convData,
            messages: filtered,
            oldestLoadedMessageId: filtered[0]?.id,
          };
        }
      }

      if (!anyFound) return state;

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setLoading: (conversationId: string, loading: boolean) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        newMessagesByConversation[key] = {
          ...convData,
          loading,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setLoadingMore: (conversationId: string, loadingMore: boolean) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        newMessagesByConversation[key] = {
          ...convData,
          loadingMore,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setHasMore: (conversationId: string, hasMore: boolean) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        newMessagesByConversation[key] = {
          ...convData,
          hasMore,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setContinuationToken: (conversationId: string, continuationToken: string | null) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const convData = newMessagesByConversation[key] || {
          ...initialConversationMessages,
        };
        newMessagesByConversation[key] = {
          ...convData,
          continuationToken,
        };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setPinnedMessages: (conversationId, pinnedMessages) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const conv = newMessagesByConversation[key] || { ...initialConversationMessages };
        newMessagesByConversation[key] = { ...conv, pinnedMessages, hasFetchedPinned: true };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  addPinnedMessage: (conversationId, pinnedMessage) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };
      let anyUpdated = false;

      for (const key of keys) {
        const convData = newMessagesByConversation[key];
        // Only process if pinned messages have been fetched and are currently cached
        if (!convData || !convData.hasFetchedPinned) continue;

        const currentPinned = convData.pinnedMessages || [];
        const exists = currentPinned.some((m) => m.messageId === pinnedMessage.messageId);
        if (exists) continue;

        anyUpdated = true;
        newMessagesByConversation[key] = {
          ...convData,
          pinnedMessages: [pinnedMessage, ...currentPinned],
        };
      }

      if (!anyUpdated) return state;

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  removePinnedMessage: (conversationId, messageId) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };
      let anyUpdated = false;

      for (const key of keys) {
        const convData = newMessagesByConversation[key];
        // Only process if pinned messages have been fetched and are currently cached
        if (!convData || !convData.hasFetchedPinned) continue;

        const currentPinned = convData.pinnedMessages || [];
        const filtered = currentPinned.filter((m) => m.messageId !== messageId);
        if (filtered.length === currentPinned.length) continue;

        anyUpdated = true;
        newMessagesByConversation[key] = {
          ...convData,
          pinnedMessages: filtered,
        };
      }

      if (!anyUpdated) return state;

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setLoadingPinned: (conversationId, loadingPinned) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const conv = newMessagesByConversation[key] || { ...initialConversationMessages };
        newMessagesByConversation[key] = { ...conv, loadingPinned };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setHasFetched: (conversationId, hasFetched) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const conv = newMessagesByConversation[key] || { ...initialConversationMessages };
        newMessagesByConversation[key] = { ...conv, hasFetched };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  setHasFetchedPinned: (conversationId, hasFetchedPinned) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newMessagesByConversation = { ...state.messagesByConversation };

      for (const key of keys) {
        const conv = newMessagesByConversation[key] || { ...initialConversationMessages };
        newMessagesByConversation[key] = { ...conv, hasFetchedPinned };
      }

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  trimInactiveConversations: (activeConversationId: string | null, keepLimit: number = 50) =>
    set((state) => {
      const activeKeys = new Set(
        activeConversationId ? getConversationKeys(activeConversationId) : []
      );
      let changed = false;
      const newMessagesByConversation: Record<string, ConversationMessages> = {};

      for (const [convId, convData] of Object.entries(state.messagesByConversation)) {
        if (!activeKeys.has(convId) && convData.messages.length > keepLimit) {
          changed = true;
          // Keep only the most recent `keepLimit` messages
          const trimmedMessages = convData.messages.slice(-keepLimit);
          newMessagesByConversation[convId] = {
            ...convData,
            messages: trimmedMessages,
            oldestLoadedMessageId: trimmedMessages[0]?.id,
            hasMore: true,
          };
        } else {
          newMessagesByConversation[convId] = convData;
        }
      }

      if (!changed) return state;

      return {
        messagesByConversation: newMessagesByConversation,
      };
    }),

  jumpToMessage: (messageId: string, conversationId?: string, highlightDuration?: number) =>
    set({
      jumpTarget: {
        messageId,
        conversationId,
        timestamp: Date.now(),
        highlightDuration,
      },
    }),

  setHighlightedMessageId: (highlightedMessageId: string | null) =>
    set({ highlightedMessageId }),

  clearJumpTarget: () =>
    set({ jumpTarget: null }),

  reset: () => set(initialMessageState),
}));

registerMessageStore(useMessageStore);
