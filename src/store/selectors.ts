import type { ConversationState } from './conversationStore';
import type {
  Conversation,
  DirectConversation,
  GroupConversation,
} from '../types/conversation.types';

/**
 * Selector: Get all conversations ordered by conversationIds
 */
export const selectAllConversations = (state: ConversationState): Conversation[] => {
  return state.conversationIds
    .map((id) => state.conversations[id])
    .filter((conv): conv is Conversation => Boolean(conv));
};

/**
 * Selector: Get active conversation entity or null
 */
export const selectActiveConversation = (state: ConversationState): Conversation | null => {
  if (!state.activeConversationId) return null;
  return state.conversations[state.activeConversationId] || null;
};

/**
 * Selector: Get conversation by ID
 */
export const selectConversationById = (
  state: ConversationState,
  id: string
): Conversation | undefined => {
  return state.conversations[id];
};

/**
 * Selector: Get total unread message count across all conversations
 */
export const selectUnreadCountTotal = (state: ConversationState): number => {
  return Object.values(state.conversations).reduce(
    (total, conv) => total + (conv.unreadCount || 0),
    0
  );
};

/**
 * Selector: Get direct (1-on-1) conversations ordered
 */
export const selectDirectConversations = (state: ConversationState): DirectConversation[] => {
  return selectAllConversations(state).filter(
    (conv): conv is DirectConversation => conv.type === 'direct'
  );
};

/**
 * Selector: Get group conversations ordered
 */
export const selectGroupConversations = (state: ConversationState): GroupConversation[] => {
  return selectAllConversations(state).filter(
    (conv): conv is GroupConversation => conv.type === 'group'
  );
};

/* -------------------------------------------------------------------------- */
/*                              Message Selectors                             */
/* -------------------------------------------------------------------------- */

import type { MessageState, ConversationMessages } from './messageStore';
import type { ChatMessage } from '../types/message.types';

/**
 * Selector: Get messages array for a given conversation ID
 */
export const selectMessagesByConversation = (
  state: MessageState,
  conversationId: string
): ChatMessage[] => {
  return state.messagesByConversation[conversationId]?.messages || [];
};

/**
 * Selector: Get full ConversationMessages store data for a conversation ID
 */
export const selectConversationMessagesData = (
  state: MessageState,
  conversationId: string
): ConversationMessages | undefined => {
  return state.messagesByConversation[conversationId];
};

/**
 * Selector: Get the latest message for a conversation ID
 */
export const selectLatestMessage = (
  state: MessageState,
  conversationId: string
): ChatMessage | undefined => {
  const messages = selectMessagesByConversation(state, conversationId);
  return messages.length > 0 ? messages[messages.length - 1] : undefined;
};
