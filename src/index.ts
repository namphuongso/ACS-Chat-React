/**
 * React + TypeScript Azure Communication Services (ACS) Chat Library
 */

export const VERSION = '1.2.1';

import './styles/variables.scss';

export * from './components';
export * from './hooks';
export * from './services';
export * from './utils';
export * from './adapters/websocket';
export * from './constants/websocket';

export type {
  // Config
  ChatConfig,
  LinkPreviewConfig,

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
  PinnedMessage,
  MessageStatus,
  MessageType,
  SendMessageOptions,
  LinkPreview,

  // Connection
  ConnectionState,

  // Error
  ChatError,
  ChatErrorCode,

  // File
  MessageFileMetadata,

  // Events
  ChatDomainEvent,
  ChatEventType,

  // Reconnect
  ReconnectPolicy,

  // WebSocket
  WsClientMessage,
  WsClientHeartbeatMessage,
  WsClientEnterRoomMessage,
  WsClientLeaveRoomMessage,
  WsClientReadMessage,
  WsServerMessage,
  WsServerConnectedMessage,
  WsServerEnterRoomAckMessage,
  WsServerLeaveAckMessage,
  WsServerHeartbeatAckMessage,
  WsServerReadAckMessage,
  WsServerErrorMessage,
  WsServerRoomEventMessage,
  WsRoomEventType,
  WsErrorCode,
  WsConnectionState,
  WsNewMessagePayload,
  WsMessageUpdatedPayload,
  WsMessageDeletedPayload,
  WsMessagePinnedPayload,
  WsMessageUnpinnedPayload,
  WsMessageReactedPayload,
  WsMessageReactionRemovedPayload,
  WsRoomCreatedPayload,
  WsRoomUpdatedPayload,
  WsRoomDisbandedPayload,
  WsRoomRoleChangedPayload,
  WsRoomOwnershipTransferredPayload,
  WsMemberJoinedPayload,
  WsMemberLeftPayload,
  WsMemberRemovedPayload,
} from './types';
