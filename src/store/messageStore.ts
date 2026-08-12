import { create } from 'zustand';
import type { ChatMessage, PinnedMessage } from '../types/message.types';

export interface ConversationMessages {
  /** Ordered array of messages (oldest to newest) */
  messages: ChatMessage[];
  /** Loading flag for initial page fetch */
  loading: boolean;
  /** Loading flag for fetching older pages */
  loadingMore: boolean;
  /** Indicates if older messages exist for pagination */
  hasMore: boolean;
  /** ID of the oldest loaded message for cursor reference */
  /** ID of the oldest loaded message for cursor reference */
  oldestLoadedMessageId?: string;
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

  /** Add or update a message in a conversation (handles dedup & optimistic replacement) */
  addMessage: (conversationId: string, message: ChatMessage) => void;
  /** Prepend older messages for pagination (handles dedup & sorting) */
  prependMessages: (conversationId: string, messages: ChatMessage[], hasMore?: boolean) => void;
  /** Replace or set all messages for a conversation */
  setMessages: (conversationId: string, messages: ChatMessage[], hasMore?: boolean) => void;
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
  /** Set pinned messages for a conversation */
  setPinnedMessages: (conversationId: string, messages: PinnedMessage[]) => void;
  /** Set loading flag for pinned messages */
  setLoadingPinned: (conversationId: string, loading: boolean) => void;
  /** Set fetched flag for pinned messages */
  setHasFetchedPinned: (conversationId: string, hasFetched: boolean) => void;
  /** Trim messages for inactive conversations to a limit to save memory */
  trimInactiveConversations: (activeConversationId: string | null, keepLimit?: number) => void;
  /** Reset message store state back to initial state */
  reset: () => void;
}

export const initialConversationMessages: ConversationMessages = {
  messages: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  pinnedMessages: [],
  loadingPinned: false,
  hasFetchedPinned: false,
};

export const initialMessageState = {
  messagesByConversation: {},
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
 * Deduplicate and sort existing + incoming messages.
 * Replaces optimistic entries when server confirmation arrives.
 */
export function dedupAndSortMessages(
  existing: ChatMessage[],
  incoming: ChatMessage[]
): ChatMessage[] {
  const messageMap = new Map<string, ChatMessage>();
  const clientMsgIdToId = new Map<string, string>();

  // Populate map with existing messages
  for (const msg of existing) {
    messageMap.set(msg.id, msg);
    if (msg.clientMessageId) {
      clientMsgIdToId.set(msg.clientMessageId, msg.id);
    }
  }

  // Merge incoming messages, replacing optimistic entries
  for (const msg of incoming) {
    // If incoming message matches an existing clientMessageId mapping, remove the temporary entry
    if (msg.clientMessageId && clientMsgIdToId.has(msg.clientMessageId)) {
      const oldId = clientMsgIdToId.get(msg.clientMessageId)!;
      if (oldId !== msg.id) {
        messageMap.delete(oldId);
      }
    }
    // Also remove if temp ID was set directly as msg.id matching incoming clientMessageId
    if (msg.clientMessageId && messageMap.has(msg.clientMessageId)) {
      messageMap.delete(msg.clientMessageId);
    }

    messageMap.set(msg.id, msg);
    if (msg.clientMessageId) {
      clientMsgIdToId.set(msg.clientMessageId, msg.id);
    }
  }

  const result = Array.from(messageMap.values());
  result.sort(compareMessages);
  return result;
}

export const useMessageStore = create<MessageState>((set) => ({
  ...initialMessageState,

  addMessage: (conversationId: string, message: ChatMessage) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      const updatedMessages = dedupAndSortMessages(convData.messages, [message]);
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            messages: updatedMessages,
            oldestLoadedMessageId: updatedMessages[0]?.id,
          },
        },
      };
    }),

  prependMessages: (conversationId: string, messages: ChatMessage[], hasMore?: boolean) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      const updatedMessages = dedupAndSortMessages(convData.messages, messages);
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            messages: updatedMessages,
            hasMore: hasMore !== undefined ? hasMore : convData.hasMore,
            oldestLoadedMessageId: updatedMessages[0]?.id,
          },
        },
      };
    }),

  setMessages: (conversationId: string, messages: ChatMessage[], hasMore?: boolean) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      const updatedMessages = dedupAndSortMessages([], messages);
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            messages: updatedMessages,
            hasMore: hasMore !== undefined ? hasMore : convData.hasMore,
            oldestLoadedMessageId: updatedMessages[0]?.id,
          },
        },
      };
    }),

  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId];
      if (!convData) return state;

      let found = false;
      const updatedMessages = convData.messages.map((msg) => {
        if (msg.id === messageId || (msg.clientMessageId && msg.clientMessageId === messageId)) {
          found = true;
          return { ...msg, ...updates };
        }
        return msg;
      });

      if (!found) return state;

      updatedMessages.sort(compareMessages);

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            messages: updatedMessages,
            oldestLoadedMessageId: updatedMessages[0]?.id,
          },
        },
      };
    }),

  removeMessage: (conversationId: string, messageId: string) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId];
      if (!convData) return state;

      const filtered = convData.messages.filter(
        (msg) => msg.id !== messageId && msg.clientMessageId !== messageId
      );

      if (filtered.length === convData.messages.length) return state;

      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            messages: filtered,
            oldestLoadedMessageId: filtered[0]?.id,
          },
        },
      };
    }),

  setLoading: (conversationId: string, loading: boolean) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            loading,
          },
        },
      };
    }),

  setLoadingMore: (conversationId: string, loadingMore: boolean) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            loadingMore,
          },
        },
      };
    }),

  setHasMore: (conversationId: string, hasMore: boolean) =>
    set((state) => {
      const convData = state.messagesByConversation[conversationId] || {
        ...initialConversationMessages,
      };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: {
            ...convData,
            hasMore,
          },
        },
      };
    }),

  setPinnedMessages: (conversationId, pinnedMessages) =>
    set((state) => {
      const conv = state.messagesByConversation[conversationId] || { ...initialConversationMessages };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: { ...conv, pinnedMessages, hasFetchedPinned: true },
        },
      };
    }),

  setLoadingPinned: (conversationId, loadingPinned) =>
    set((state) => {
      const conv = state.messagesByConversation[conversationId] || { ...initialConversationMessages };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: { ...conv, loadingPinned },
        },
      };
    }),

  setHasFetchedPinned: (conversationId, hasFetchedPinned) =>
    set((state) => {
      const conv = state.messagesByConversation[conversationId] || { ...initialConversationMessages };
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: { ...conv, hasFetchedPinned },
        },
      };
    }),

  trimInactiveConversations: (activeConversationId: string | null, keepLimit: number = 50) =>
    set((state) => {
      let changed = false;
      const newMessagesByConversation: Record<string, ConversationMessages> = {};

      for (const [convId, convData] of Object.entries(state.messagesByConversation)) {
        if (convId !== activeConversationId && convData.messages.length > keepLimit) {
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

  reset: () => set(initialMessageState),
}));
