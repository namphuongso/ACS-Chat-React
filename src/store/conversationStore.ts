import { create } from 'zustand';
import type { Conversation } from '../types/conversation.types';
import type { ChatMessage } from '../types/message.types';
import type { ChatError } from '../types/errors.types';

export interface ConversationState {
  /** Map of conversation ID to Conversation entity (normalized state) */
  conversations: Record<string, Conversation>;
  /** Ordered array of conversation IDs */
  conversationIds: string[];
  /** Currently active conversation ID */
  activeConversationId: string | null;
  /** Initial loading flag for fetching conversations */
  loading: boolean;
  /** Flag for pagination (loading next page) */
  loadingMore: boolean;
  /** Indicates if there are more conversations to fetch */
  hasMore: boolean;
  /** Pagination continuation token / cursor */
  cursor: string | null;
  /** Error object if fetching or conversation operation fails */
  error: ChatError | null;

  /** Replace all conversations in the store */
  setConversations: (conversations: Conversation[]) => void;
  /** Append additional conversations (for pagination) */
  appendConversations: (conversations: Conversation[]) => void;
  /** Add or insert a single conversation (prepends to top) */
  addConversation: (conversation: Conversation) => void;
  /** Update properties of an existing conversation */
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  /** Remove a conversation by ID */
  removeConversation: (id: string) => void;
  /** Set active conversation ID */
  setActiveConversation: (id: string | null) => void;
  /** Increment unread count for a conversation */
  incrementUnreadCount: (id: string, by?: number) => void;
  /** Reset unread count for a conversation to 0 */
  resetUnreadCount: (id: string) => void;
  /** Update last message and move conversation to top of list */
  updateLastMessage: (id: string, lastMessage: ChatMessage) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set loadingMore state for pagination */
  setLoadingMore: (loadingMore: boolean) => void;
  /** Set hasMore flag for pagination */
  setHasMore: (hasMore: boolean) => void;
  /** Set pagination cursor */
  setCursor: (cursor: string | null) => void;
  /** Set conversation error */
  setError: (error: ChatError | null) => void;
  /** Reset store state to initial defaults */
  reset: () => void;
}

export const initialConversationState = {
  conversations: {},
  conversationIds: [],
  activeConversationId: null,
  loading: false,
  loadingMore: false,
  hasMore: true,
  cursor: null,
  error: null,
};

export const useConversationStore = create<ConversationState>((set) => ({
  ...initialConversationState,

  setConversations: (conversations: Conversation[]) =>
    set(() => {
      const record: Record<string, Conversation> = {};
      const ids: string[] = [];
      for (const conv of conversations) {
        record[conv.id] = conv;
        ids.push(conv.id);
      }
      return {
        conversations: record,
        conversationIds: ids,
      };
    }),

  appendConversations: (conversations: Conversation[]) =>
    set((state) => {
      const record = { ...state.conversations };
      const ids = [...state.conversationIds];
      for (const conv of conversations) {
        if (!record[conv.id]) {
          ids.push(conv.id);
        }
        record[conv.id] = conv;
      }
      return {
        conversations: record,
        conversationIds: ids,
      };
    }),

  addConversation: (conversation: Conversation) =>
    set((state) => {
      const exists = !!state.conversations[conversation.id];
      const record = { ...state.conversations, [conversation.id]: conversation };
      const ids = exists ? state.conversationIds : [conversation.id, ...state.conversationIds];
      return {
        conversations: record,
        conversationIds: ids,
      };
    }),

  updateConversation: (id: string, updates: Partial<Conversation>) =>
    set((state) => {
      const existing = state.conversations[id];
      if (!existing) return state;
      const updated = { ...existing, ...updates } as Conversation;
      return {
        conversations: {
          ...state.conversations,
          [id]: updated,
        },
      };
    }),

  removeConversation: (id: string) =>
    set((state) => {
      if (!state.conversations[id]) return state;
      const conversations = { ...state.conversations };
      delete conversations[id];
      return {
        conversations,
        conversationIds: state.conversationIds.filter((item) => item !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
      };
    }),

  setActiveConversation: (activeConversationId: string | null) => set({ activeConversationId }),

  incrementUnreadCount: (id: string, by: number = 1) =>
    set((state) => {
      const existing = state.conversations[id];
      if (!existing) return state;
      const currentUnread = existing.unreadCount || 0;
      const updated = {
        ...existing,
        unreadCount: currentUnread + by,
      };
      return {
        conversations: {
          ...state.conversations,
          [id]: updated,
        },
      };
    }),

  resetUnreadCount: (id: string) =>
    set((state) => {
      const existing = state.conversations[id];
      if (!existing || existing.unreadCount === 0) return state;
      const updated = {
        ...existing,
        unreadCount: 0,
      };
      return {
        conversations: {
          ...state.conversations,
          [id]: updated,
        },
      };
    }),

  updateLastMessage: (id: string, lastMessage: ChatMessage) =>
    set((state) => {
      const existing = state.conversations[id];
      if (!existing) return state;

      const updated = {
        ...existing,
        lastMessage,
        updatedAt: lastMessage.createdAt || new Date(),
      };

      const filteredIds = state.conversationIds.filter((item) => item !== id);
      return {
        conversations: {
          ...state.conversations,
          [id]: updated,
        },
        conversationIds: [id, ...filteredIds],
      };
    }),

  setLoading: (loading: boolean) => set({ loading }),
  setLoadingMore: (loadingMore: boolean) => set({ loadingMore }),
  setHasMore: (hasMore: boolean) => set({ hasMore }),
  setCursor: (cursor: string | null) => set({ cursor }),
  setError: (error: ChatError | null) => set({ error }),

  reset: () => set(initialConversationState),
}));
