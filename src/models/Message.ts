import type {
  ChatMessage,
  MessageStatus,
  MessageType,
  FileAttachment,
  SendMessageOptions,
} from '../types';

/**
 * Internal domain model for Message
 */
export type MessageModel = ChatMessage;

export type { ChatMessage, MessageStatus, MessageType, FileAttachment, SendMessageOptions };
