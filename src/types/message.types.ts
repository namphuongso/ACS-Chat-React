import type { ChatUser } from './chat.types';

/**
 * Message status tracking lifecycle in the client and ACS backend
 */
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

/**
 * Message content format type
 */
export type MessageType = 'text' | 'html' | 'system';

/**
 * Metadata representation for attached files
 */
export interface FileAttachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type of the file */
  mimeType: string;
  /** Download/access URL */
  url: string;
  /** Optional thumbnail URL (for images/videos) */
  thumbnailUrl?: string;
  /** Optional SAS token expiration timestamp */
  expiresAt?: Date;
}

/**
 * Represents a chat message in a conversation
 */
export interface ChatMessage {
  /** Unique ACS message ID or client-generated temporary ID */
  id: string;
  /** ID of the conversation / thread this message belongs to */
  conversationId: string;
  /** Type of message (text, html, system) */
  type: MessageType;
  /** Text or HTML body content */
  content: string;
  /** User who sent the message */
  sender: ChatUser;
  /** Display name of the sender at the time of sending */
  senderDisplayName?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Edit timestamp if message was updated */
  editedAt?: Date;
  /** Deletion timestamp if message was deleted */
  deletedAt?: Date;
  /** Recall timestamp if message was recalled */
  recalledAt?: Date;
  /** Current delivery/read status */
  status: MessageStatus;
  /** Custom key-value metadata attached to message */
  metadata?: Record<string, string>;
  /** File attachments if any */
  attachments?: FileAttachment[];
  /** System event payload if type is 'system' */
  systemEvent?: {
    type: 'topicUpdated' | 'participantAdded' | 'participantRemoved';
    initiator?: ChatUser;
    participants?: ChatUser[];
    newTopic?: string;
  };
  /** Temporary client-generated ID before ACS server confirmation */
  clientMessageId?: string;
  /** ACS sequence ID for ordering messages */
  sequenceId?: string;
}

/**
 * Options when sending a new message
 */
export interface SendMessageOptions {
  /** Format of the message (text or html, defaults to text) */
  type?: 'text' | 'html';
  /** Custom metadata key-value pairs */
  metadata?: Record<string, string>;
  /** Optional file attachments */
  attachments?: FileAttachment[];
  /** Optional explicit sender display name for optimistic UI updates */
  senderDisplayName?: string;
  /** Optional pre-generated client message ID for optimistic updates */
  clientMessageId?: string;
}

/**
 * Represents a pinned message returned from the backend API
 */
export interface PinnedMessage {
  messageId: string;
  type: string;
  content: string;
  createdDate: string;
  creator: string;
  attachmentType: string;
  attachmentUrl: string;
  thumbUrl: string;
}

/**
 * Options when listing messages from a thread
 */
export interface ListMessagesOptions {
  /** Maximum number of messages per page */
  maxPageSize?: number;
  /** Start time to fetch messages from */
  startTime?: Date;
}
