import { create } from 'zustand';
import { chatI18n } from '../i18n';
import { useChatStore } from './chatStore';
import { useMessageStore } from './messageStore';
import type { Conversation } from '../types/conversation.types';
import type { ChatError } from '../types/errors.types';
import type { ChatMessage } from '../types/message.types';

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
  /** Flag for when a single conversation is being opened/loaded */
  openingConversation: boolean;
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
  /** Set opening conversation flag */
  setOpeningConversation: (opening: boolean) => void;
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
  openingConversation: false,
  cursor: null,
  error: null,
};

const sortConversationIds = (ids: string[], conversations: Record<string, Conversation>): string[] => {
  return [...ids].sort((a, b) => {
    const convA = conversations[a];
    const convB = conversations[b];
    if (!convA || !convB) return 0;

    // 1. Sort by pin status
    if (convA.pin && !convB.pin) return -1;
    if (!convA.pin && convB.pin) return 1;

    const getTime = (val?: string | Date) => {
      if (!val) return 0;
      const time = new Date(val).getTime();
      return isNaN(time) ? 0 : time;
    };

    // 2. Sort by lastMessageTime || updatedAt || createdAt
    const timeA = getTime(convA.lastMessageTime || convA.updatedAt || convA.createdAt);
    const timeB = getTime(convB.lastMessageTime || convB.updatedAt || convB.createdAt);
    return timeB - timeA;
  });
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
        conversationIds: sortConversationIds(ids, record),
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
        conversationIds: sortConversationIds(ids, record),
      };
    }),

  addConversation: (conversation: Conversation) =>
    set((state) => {
      const exists = !!state.conversations[conversation.id];
      const record = { ...state.conversations, [conversation.id]: conversation };
      const ids = exists ? state.conversationIds : [conversation.id, ...state.conversationIds];
      return {
        conversations: record,
        conversationIds: sortConversationIds(ids, record),
      };
    }),

  updateConversation: (id: string, updates: Partial<Conversation>) =>
    set((state) => {
      const existing = state.conversations[id];
      if (!existing) return state;
      const updated = { ...existing, ...updates } as Conversation;
      const newConversations = {
        ...state.conversations,
        [id]: updated,
      };
      return {
        conversations: newConversations,
        conversationIds: sortConversationIds(state.conversationIds, newConversations),
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

      const currentUser = useChatStore.getState().currentUser;
      const currentUserId = currentUser?.id;

      let senderName = lastMessage.senderDisplayName || lastMessage.sender?.displayName || '';
      
      if (senderName === 'Unknown' || senderName === chatI18n.t('chat.unknownSender')) {
        senderName = '';
      }
      
      if (!senderName && lastMessage.sender?.id === currentUserId) {
        senderName = currentUser?.displayName 
          || existing.participants?.find(p => p.id === currentUserId)?.displayName 
          || '';

        if (senderName === 'Unknown' || senderName === chatI18n.t('chat.unknownSender')) {
          senderName = '';
        }
        
        // If still empty, try to find the sender name from previous messages
        if (!senderName) {
          const messages = useMessageStore.getState().messagesByConversation[id]?.messages;
          const lastOwnMsg = messages?.find((m: ChatMessage) => m.sender.id === currentUserId && m.senderDisplayName && m.senderDisplayName !== 'Unknown');
          if (lastOwnMsg) {
            senderName = lastOwnMsg.senderDisplayName || '';
          }
        }
      }

      let content = lastMessage.content || '';

      if (lastMessage.type === 'html') {
        content = content.replace(/<[^>]*>?/gm, '');
      }

      const formattedMessage = senderName ? `${senderName}: ${content}` : content;

      const messageTime = lastMessage.createdAt || new Date();

      const updated = {
        ...existing,
        lastMessage: formattedMessage,
        lastMessageTime: messageTime.toISOString(),
        updatedAt: messageTime,
      };

      const newConversations = {
        ...state.conversations,
        [id]: updated,
      };
      const newIds = state.conversationIds.includes(id) ? state.conversationIds : [id, ...state.conversationIds];
      return {
        conversations: newConversations,
        conversationIds: sortConversationIds(newIds, newConversations),
      };
    }),

  setLoading: (loading: boolean) => set({ loading }),
  setLoadingMore: (loadingMore: boolean) => set({ loadingMore }),
  setHasMore: (hasMore: boolean) => set({ hasMore }),
  setOpeningConversation: (openingConversation: boolean) => set({ openingConversation }),
  setCursor: (cursor: string | null) => set({ cursor }),
  setError: (error: ChatError | null) => set({ error }),

  reset: () => set(initialConversationState),
}));
