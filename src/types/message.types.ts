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
 * Preview metadata for a URL detected in a message.
 * Extracted from Open Graph / meta tags by the backend (/api/link-preview)
 * or client-side fallback.
 */
export interface LinkPreview {
  /** The original URL this preview belongs to */
  url: string;
  /** Page title (og:title or <title>) */
  title?: string;
  /** Short description (og:description or meta description) */
  description?: string;
  /** Preview image URL (og:image) */
  imageUrl?: string;
  /** Site name (og:site_name) */
  siteName?: string;
  /** Favicon URL of the site */
  favicon?: string;
  /** Keywords from crawler or meta tags */
  keywords?: string[];
  /** Canonical URL if provided */
  canonicalUrl?: string;
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
  metadata?: MessageMetadata;
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
 * Custom metadata value type supporting primitives, nested objects, and arrays
 */
export type MessageMetadataValue =
  | string
  | number
  | Record<string, string | number>
  | Array<string | number | Record<string, string | number>>;

export type MessageMetadata = Record<string, MessageMetadataValue>;

/**
 * Options when sending a new message
 */
export interface SendMessageOptions {
  /** Format of the message (text or html, defaults to text) */
  type?: 'text' | 'html';
  /** Custom metadata key-value pairs */
  metadata?: MessageMetadata;
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

export interface ListMessagesOptions {
  /** Maximum number of messages per page */
  maxPageSize?: number;
  /** Start time to fetch messages from */
  startTime?: Date;
  /** Continuation token for pagination */
  continuationToken?: string;
}

/**
 * Raw chat message data inside backend response items
 */
export interface BackendChatMessageData {
  id: string;
  type: string;
  sequenceId?: string;
  version?: string;
  content?: {
    message?: string | null;
    topic?: string | null;
    participants?: Array<{ id?: unknown; displayName?: string }>;
    attachments?: unknown[];
    initiator?: unknown;
  };
  senderDisplayName?: string;
  createdOn?: string;
  editedOn?: string | null;
  deletedOn?: string | null;
  metadata?: Record<string, string>;
  senderCommunicationIdentifier?: {
    rawId?: string;
    communicationUser?: {
      id?: string;
    };
  };
  sender?: unknown;
}

/**
 * Single item in the backend get-messages response
 */
export interface BackendChatMessageItem {
  itemType: string;
  createdDate?: string;
  data: BackendChatMessageData;
}

/**
 * Data payload returned from /api/chat/get-messages
 */
export interface BackendGetMessagesData {
  items: BackendChatMessageItem[];
  continuationToken?: string | null;
  hasMore?: boolean;
}
