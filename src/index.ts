/**
 * React + TypeScript Azure Communication Services (ACS) Chat Library
 */

export const VERSION = '1.0.0';

import './styles/variables.scss';

export * from './components';
export * from './hooks';
export type {
  // Config
  ChatConfig,

  // User & Participant
  ChatUser,
  ChatParticipant,
  ConversationParticipant,

  // Conversation
  Conversation,
  DirectConversation,
  GroupConversation,
  ConversationType,
  CreateDirectConversationOptions,
  CreateGroupConversationOptions,

  // Message
  ChatMessage,
  MessageStatus,
  MessageType,
  SendMessageOptions,

  // Connection
  ConnectionState,

  // Error
  ChatError,
  ChatErrorCode,

  // Events
  ChatDomainEvent,
  ChatEventType,

  // Reconnect
  ReconnectPolicy,
} from './types';
