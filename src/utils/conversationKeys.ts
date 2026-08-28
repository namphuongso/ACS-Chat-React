import type { Conversation } from '../types/conversation.types';

/**
 * Pure conversation key resolution helpers.
 * A conversation can be addressed by multiple aliases:
 * - `id` (ACS thread ID or backend room GUID)
 * - `conversationId` / `roomId` (backend room GUID)
 * - `threadId` (ACS thread ID)
 *
 * These helpers are store-free so they can be used from stores,
 * services, and adapters without creating circular imports.
 *
 * Lookups are backed by an alias index that is rebuilt only when the
 * conversations map reference changes (avoids an O(n) scan per event).
 */

type ConversationLike = {
  id: string;
  conversationId?: string;
  threadId?: string;
  roomId?: string;
};

/** Rebuilds the alias -> canonical id index for a conversations map. */
const buildAliasIndex = (
  conversations: Record<string, Conversation>
): Map<string, string> => {
  const index = new Map<string, string>();
  for (const [key, conv] of Object.entries(conversations)) {
    if (!conv || typeof conv !== 'object') continue;
    const c = conv as unknown as ConversationLike;
    if (c.id) index.set(c.id, key);
    if (c.conversationId) index.set(c.conversationId, key);
    if (c.threadId) index.set(c.threadId, key);
    if (c.roomId) index.set(c.roomId, key);
  }
  return index;
};

// Cache invalidated whenever the `conversations` object reference changes.
let cachedConversations: Record<string, Conversation> | null = null;
let cachedAliasIndex: Map<string, string> | null = null;

const getAliasIndex = (conversations: Record<string, Conversation>): Map<string, string> => {
  if (cachedConversations !== conversations) {
    cachedConversations = conversations;
    cachedAliasIndex = buildAliasIndex(conversations);
  }
  return cachedAliasIndex as Map<string, string>;
};

/**
 * Find the canonical key (conversation.id) of a conversation given any alias.
 */
export const findConversationKey = (
  id: string,
  conversations: Record<string, Conversation>
): string | undefined => {
  if (!id || !conversations) return undefined;
  if (conversations[id]) return id;
  return getAliasIndex(conversations).get(id);
};

/**
 * Resolve every key under which a conversation may be stored (id + aliases).
 */
export const resolveConversationKeys = (
  conversationId: string,
  conversations: Record<string, Conversation> | undefined
): string[] => {
  if (!conversationId) return [];
  const keys = new Set<string>([conversationId]);
  if (!conversations) return Array.from(keys);

  const key = findConversationKey(conversationId, conversations);
  const conv = key ? conversations[key] : undefined;
  if (conv) {
    if (conv.id) keys.add(conv.id);
    if (conv.conversationId) keys.add(conv.conversationId);
    if ((conv as unknown as Record<string, unknown>).threadId) {
      keys.add((conv as unknown as Record<string, unknown>).threadId as string);
    }
    if ((conv as unknown as Record<string, unknown>).roomId) {
      keys.add((conv as unknown as Record<string, unknown>).roomId as string);
    }
  }
  return Array.from(keys);
};

/**
 * Resolve the backend room ID for a conversation from any of its aliases.
 *
 * The WebSocket layer keys its read-state bookkeeping (`lastVisibleMessageIds`,
 * `activeRoomId`) by the backend room GUID, so every caller that sends a `read`
 * frame must resolve to the same identifier. Passing a raw thread/conversation
 * key instead would create a second, divergent bookkeeping entry and break
 * deduplication and the last-visible-message replayed on heartbeat/reconnect.
 *
 * Falls back to the provided `conversationId` when no conversation record is
 * found (e.g. before the conversation list has loaded).
 */
export const resolveRoomId = (
  conversationId: string,
  conversations: Record<string, Conversation> | undefined
): string => {
  if (!conversationId) return conversationId;
  const key = conversations ? findConversationKey(conversationId, conversations) : undefined;
  const conv = key && conversations ? (conversations[key] as unknown as ConversationLike) : undefined;
  if (!conv) return conversationId;
  return conv.conversationId || conv.roomId || conversationId;
};