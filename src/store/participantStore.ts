import { create } from 'zustand';
import type { ConversationParticipant } from '../types/participant.types';
import type { ChatUser } from '../types/chat.types';
import type { ReadReceipt } from '../models/ReadReceipt';

export interface TypingUser {
  /** User object / ID of the typing participant */
  user: ChatUser;
  /** Timestamp when typing was started/refreshed */
  startedAt: Date;
}

export interface ParticipantState {
  /** Map of conversation ID to list of participants */
  participantsByConversation: Record<string, ConversationParticipant[]>;
  /** Map of conversation ID -> map of userId -> TypingUser */
  typingUsers: Record<string, Record<string, TypingUser>>;
  /** Map of conversation ID -> map of userId -> ReadReceipt */
  readReceipts: Record<string, Record<string, ReadReceipt>>;

  /** Set or replace participants for a conversation */
  setParticipants: (conversationId: string, participants: ConversationParticipant[]) => void;
  /** Add new participants to an existing conversation (deduplicates by user.id) */
  addParticipants: (conversationId: string, participants: ConversationParticipant[]) => void;
  /** Remove a participant from a conversation by user ID */
  removeParticipant: (conversationId: string, userId: string) => void;

  /** Set typing user indicator for a conversation with auto-expiry */
  setTypingUser: (conversationId: string, user: ChatUser, timeoutMs?: number) => void;
  /** Manually remove typing user indicator */
  removeTypingUser: (conversationId: string, userId: string) => void;
  /** Clear all typing users for a conversation */
  clearTypingUsers: (conversationId: string) => void;
  /** Purge expired typing indicators older than maxAgeMs */
  cleanupExpiredTypingUsers: (conversationId: string, maxAgeMs?: number) => void;

  /** Set or replace all read receipts for a conversation */
  setReadReceipts: (conversationId: string, receipts: ReadReceipt[]) => void;
  /** Add or update a single read receipt for a user in a conversation */
  addReadReceipt: (conversationId: string, receipt: ReadReceipt) => void;

  /** Reset entire participant store state */
  reset: () => void;
}

export const initialParticipantState = {
  participantsByConversation: {},
  typingUsers: {},
  readReceipts: {},
};

/** Internal timer map to handle auto-expiry of typing indicators */
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearTimer(conversationId: string, userId: string) {
  const key = `${conversationId}:${userId}`;
  const existingTimer = typingTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
    typingTimers.delete(key);
  }
}

function clearAllTimers() {
  for (const timer of typingTimers.values()) {
    clearTimeout(timer);
  }
  typingTimers.clear();
}

export const useParticipantStore = create<ParticipantState>((set, get) => ({
  ...initialParticipantState,

  /* -------------------------------------------------------------------------- */
  /*                            Participant Actions                             */
  /* -------------------------------------------------------------------------- */

  setParticipants: (conversationId: string, participants: ConversationParticipant[]) =>
    set((state) => ({
      participantsByConversation: {
        ...state.participantsByConversation,
        [conversationId]: participants,
      },
    })),

  addParticipants: (conversationId: string, newParticipants: ConversationParticipant[]) =>
    set((state) => {
      const existing = state.participantsByConversation[conversationId] || [];
      const existingMap = new Map(existing.map((p) => [p.id, p]));

      for (const p of newParticipants) {
        existingMap.set(p.id, { ...existingMap.get(p.id), ...p });
      }

      return {
        participantsByConversation: {
          ...state.participantsByConversation,
          [conversationId]: Array.from(existingMap.values()),
        },
      };
    }),

  removeParticipant: (conversationId: string, userId: string) =>
    set((state) => {
      const existing = state.participantsByConversation[conversationId];
      if (!existing) return state;

      return {
        participantsByConversation: {
          ...state.participantsByConversation,
          [conversationId]: existing.filter((p) => p.id !== userId),
        },
      };
    }),

  /* -------------------------------------------------------------------------- */
  /*                              Typing Actions                                */
  /* -------------------------------------------------------------------------- */

  setTypingUser: (conversationId: string, user: ChatUser, timeoutMs: number = 8000) => {
    // Clear any existing timer for this user in this conversation
    clearTimer(conversationId, user.id);

    set((state) => {
      const convTyping = state.typingUsers[conversationId] || {};
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: {
            ...convTyping,
            [user.id]: {
              user,
              startedAt: new Date(),
            },
          },
        },
      };
    });

    // Schedule auto-removal after timeoutMs (default 8 seconds per ACS spec)
    const key = `${conversationId}:${user.id}`;
    const timer = setTimeout(() => {
      get().removeTypingUser(conversationId, user.id);
    }, timeoutMs);

    typingTimers.set(key, timer);
  },

  removeTypingUser: (conversationId: string, userId: string) => {
    clearTimer(conversationId, userId);

    set((state) => {
      const convTyping = state.typingUsers[conversationId];
      if (!convTyping || !convTyping[userId]) return state;

      const updated = { ...convTyping };
      delete updated[userId];

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updated,
        },
      };
    });
  },

  clearTypingUsers: (conversationId: string) => {
    const convTyping = get().typingUsers[conversationId];
    if (convTyping) {
      for (const userId of Object.keys(convTyping)) {
        clearTimer(conversationId, userId);
      }
    }

    set((state) => {
      if (!state.typingUsers[conversationId]) return state;
      const updated = { ...state.typingUsers };
      delete updated[conversationId];

      return {
        typingUsers: updated,
      };
    });
  },

  cleanupExpiredTypingUsers: (conversationId: string, maxAgeMs: number = 8000) => {
    const now = Date.now();

    set((state) => {
      const convTyping = state.typingUsers[conversationId];
      if (!convTyping) return state;

      let changed = false;
      const updated = { ...convTyping };

      for (const [userId, item] of Object.entries(convTyping)) {
        const age = now - item.startedAt.getTime();
        if (age >= maxAgeMs) {
          clearTimer(conversationId, userId);
          delete updated[userId];
          changed = true;
        }
      }

      if (!changed) return state;

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: updated,
        },
      };
    });
  },

  /* -------------------------------------------------------------------------- */
  /*                            Read Receipt Actions                            */
  /* -------------------------------------------------------------------------- */

  setReadReceipts: (conversationId: string, receipts: ReadReceipt[]) =>
    set((state) => {
      const receiptMap: Record<string, ReadReceipt> = {};
      for (const r of receipts) {
        if (r.user?.id) {
          receiptMap[r.user.id] = r;
        }
      }

      return {
        readReceipts: {
          ...state.readReceipts,
          [conversationId]: receiptMap,
        },
      };
    }),

  addReadReceipt: (conversationId: string, receipt: ReadReceipt) =>
    set((state) => {
      const userId = receipt.user?.id;
      if (!userId) return state;

      const convReceipts = state.readReceipts[conversationId] || {};
      const existing = convReceipts[userId];

      // Update if no existing receipt or if new readOn date is newer/equal
      if (existing && existing.readOn.getTime() > receipt.readOn.getTime()) {
        return state;
      }

      return {
        readReceipts: {
          ...state.readReceipts,
          [conversationId]: {
            ...convReceipts,
            [userId]: receipt,
          },
        },
      };
    }),

  reset: () => {
    clearAllTimers();
    set(initialParticipantState);
  },
}));
