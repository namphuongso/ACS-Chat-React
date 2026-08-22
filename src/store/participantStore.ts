import { create } from 'zustand';
import type { ConversationParticipant } from '../types/participant.types';
import type { ChatUser } from '../types/chat.types';
import type { ReadReceipt } from '../models/ReadReceipt';
import { findConversationKey } from '../utils/conversationKeys';
import { useConversationStore } from './conversationStore';
import { getConversationKeys } from './messageStore';

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
  const keys = getConversationKeys(conversationId);
  for (const k of keys) {
    const key = `${k}:${userId}`;
    const existingTimer = typingTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
      typingTimers.delete(key);
    }
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
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newPartByConv = { ...state.participantsByConversation };
      for (const k of keys) {
        newPartByConv[k] = [...participants];
      }
      return {
        participantsByConversation: newPartByConv,
      };
    }),

  addParticipants: (conversationId: string, newParticipants: ConversationParticipant[]) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newPartByConv = { ...state.participantsByConversation };

      for (const k of keys) {
        const existing = newPartByConv[k] || [];
        const existingMap = new Map(existing.map((p) => [p.id, p]));

        for (const p of newParticipants) {
          existingMap.set(p.id, { ...existingMap.get(p.id), ...p });
        }
        newPartByConv[k] = Array.from(existingMap.values());
      }

      return {
        participantsByConversation: newPartByConv,
      };
    }),

  removeParticipant: (conversationId: string, userId: string) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newPartByConv = { ...state.participantsByConversation };
      let changed = false;

      for (const k of keys) {
        const existing = newPartByConv[k];
        if (existing) {
          const filtered = existing.filter((p) => p.id !== userId);
          if (filtered.length !== existing.length) {
            newPartByConv[k] = filtered;
            changed = true;
          }
        }
      }

      if (!changed) return state;

      return {
        participantsByConversation: newPartByConv,
      };
    }),

  /* -------------------------------------------------------------------------- */
  /*                              Typing Actions                                */
  /* -------------------------------------------------------------------------- */

  setTypingUser: (conversationId: string, user: ChatUser, timeoutMs: number = 8000) => {
    // Clear any existing timer for this user in this conversation
    clearTimer(conversationId, user.id);

    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newTypingUsers = { ...state.typingUsers };

      for (const k of keys) {
        const convTyping = newTypingUsers[k] || {};
        newTypingUsers[k] = {
          ...convTyping,
          [user.id]: {
            user,
            startedAt: new Date(),
          },
        };
      }

      return {
        typingUsers: newTypingUsers,
      };
    });

    // Schedule auto-removal after timeoutMs (default 8 seconds per ACS spec).
    // Register the timer under the CANONICAL conversation key so a stop event
    // arriving via any alias (roomId/threadId/conversationId) clears it.
    const canonicalKey =
      findConversationKey(
        conversationId,
        useConversationStore.getState().conversations
      ) || conversationId;
    const timerKey = `${canonicalKey}:${user.id}`;
    const existingTimer = typingTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    const timer = setTimeout(() => {
      get().removeTypingUser(conversationId, user.id);
    }, timeoutMs);

    typingTimers.set(timerKey, timer);
  },

  removeTypingUser: (conversationId: string, userId: string) => {
    clearTimer(conversationId, userId);

    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newTypingUsers = { ...state.typingUsers };
      let changed = false;

      for (const k of keys) {
        const convTyping = newTypingUsers[k];
        if (convTyping && convTyping[userId]) {
          const updated = { ...convTyping };
          delete updated[userId];
          newTypingUsers[k] = updated;
          changed = true;
        }
      }

      if (!changed) return state;

      return {
        typingUsers: newTypingUsers,
      };
    });
  },

  clearTypingUsers: (conversationId: string) => {
    const keys = getConversationKeys(conversationId);
    let changed = false;
    for (const k of keys) {
      const convTyping = get().typingUsers[k];
      if (convTyping && Object.keys(convTyping).length > 0) {
        changed = true;
        for (const userId of Object.keys(convTyping)) {
          clearTimer(k, userId);
        }
      }
    }

    if (!changed) return;

    set((state) => {
      const newTypingUsers = { ...state.typingUsers };
      for (const k of keys) {
        delete newTypingUsers[k];
      }

      return {
        typingUsers: newTypingUsers,
      };
    });
  },

  cleanupExpiredTypingUsers: (conversationId: string, maxAgeMs: number = 8000) => {
    const now = Date.now();

    set((state) => {
      const keys = getConversationKeys(conversationId);
      const newTypingUsers = { ...state.typingUsers };
      let changed = false;

      for (const k of keys) {
        const convTyping = newTypingUsers[k];
        if (!convTyping) continue;

        const updated = { ...convTyping };
        for (const [userId, item] of Object.entries(convTyping)) {
          const age = now - item.startedAt.getTime();
          if (age >= maxAgeMs) {
            clearTimer(k, userId);
            delete updated[userId];
            changed = true;
          }
        }
        newTypingUsers[k] = updated;
      }

      if (!changed) return state;

      return {
        typingUsers: newTypingUsers,
      };
    });
  },

  /* -------------------------------------------------------------------------- */
  /*                            Read Receipt Actions                            */
  /* -------------------------------------------------------------------------- */

  setReadReceipts: (conversationId: string, receipts: ReadReceipt[]) =>
    set((state) => {
      const keys = getConversationKeys(conversationId);
      const receiptMap: Record<string, ReadReceipt> = {};
      for (const r of receipts) {
        if (r.user?.id) {
          receiptMap[r.user.id] = r;
        }
      }

      const newReadReceipts = { ...state.readReceipts };
      for (const k of keys) {
        newReadReceipts[k] = receiptMap;
      }

      return {
        readReceipts: newReadReceipts,
      };
    }),

  addReadReceipt: (conversationId: string, receipt: ReadReceipt) =>
    set((state) => {
      const userId = receipt.user?.id;
      if (!userId) return state;

      const keys = getConversationKeys(conversationId);
      const newReadReceipts = { ...state.readReceipts };

      for (const k of keys) {
        const convReceipts = newReadReceipts[k] || {};
        const existing = convReceipts[userId];

        // Update if no existing receipt or if new readOn date is newer/equal
        if (!existing || existing.readOn.getTime() <= receipt.readOn.getTime()) {
          newReadReceipts[k] = {
            ...convReceipts,
            [userId]: receipt,
          };
        }
      }

      return {
        readReceipts: newReadReceipts,
      };
    }),

  reset: () => {
    clearAllTimers();
    set(initialParticipantState);
  },
}));
