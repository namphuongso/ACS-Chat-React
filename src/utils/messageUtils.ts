import type { ChatMessage } from '../types/message.types';
import type { Conversation } from '../types/conversation.types';
import { findConversationKey } from './conversationKeys';

/**
 * Iterates backwards through an array of messages to find the most recent
 * persisted message (i.e. has a valid non-empty ID and is not a temporary optimistic message).
 *
 * @param messages Array of ChatMessage objects
 * @returns The last persisted ChatMessage or undefined if none found
 */
export function findLastPersistedMessage(
  messages?: ChatMessage[] | null
): ChatMessage | undefined {
  if (!messages || messages.length === 0) {
    return undefined;
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.id && !msg.id.startsWith('temp-') && msg.status !== 'sending' && msg.status !== 'failed') {
      return msg;
    }
  }

  return undefined;
}

/**
 * Whether the browser document is currently visible to the user.
 *
 * Used to gate automatic read receipts so that messages are not marked as read
 * while the tab/window is hidden (backgrounded) — a read receipt should only be
 * sent when the user can actually see the conversation.
 *
 * Returns `true` when `document` is unavailable (SSR / non-browser) so that the
 * check never blocks in environments where visibility cannot be determined.
 */
export function isDocumentVisible(): boolean {
  if (typeof document === 'undefined' || typeof document.visibilityState === 'undefined') {
    return true;
  }
  return document.visibilityState === 'visible';
}

/**
 * Whether a given conversation is the currently active conversation.
 *
 * The active conversation is tracked by its id in the conversation store, but
 * the conversation may be addressed by any of its aliases (id, conversationId,
 * threadId, roomId). This helper resolves both sides to canonical keys before
 * comparing, and also accepts the resolved backend room id as a fallback match.
 *
 * @param activeConversationId The id of the currently active conversation (or null).
 * @param conversationId The id/alias of the conversation being checked.
 * @param roomId The resolved backend room id of the conversation being checked.
 * @param conversations The conversation store map used to resolve aliases.
 * @returns True when the conversation is active.
 */
export function isActiveConversation(
  activeConversationId: string | null | undefined,
  conversationId: string,
  roomId: string | undefined,
  conversations: Record<string, Conversation> | undefined
): boolean {
  if (!activeConversationId || !conversations) return false;
  const activeKey =
    findConversationKey(activeConversationId, conversations) || activeConversationId;
  const currentKey = findConversationKey(conversationId, conversations) || conversationId;
  return activeKey === currentKey || activeKey === roomId;
}
