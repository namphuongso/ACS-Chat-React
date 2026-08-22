import type { ConversationParticipant } from './participant.types';
import type { ChatUser } from './chat.types';

/**
 * Supported conversation types in the chat system
 */
export type ConversationType = 'direct' | 'group';

/**
 * Base properties shared across all conversation types
 */
export interface BaseConversation {
  /** Unique conversation / thread ID */
  id: string;
  /** Original backend conversation ID */
  conversationId?: string;
  /** Type of conversation ('direct' or 'group') */
  type: ConversationType;
  /** Raw backend room type ('U' for direct, 'G' for group) if provided */
  roomType?: string;
  /** Timestamp when conversation was created */
  createdAt: Date;
  /** Timestamp when conversation was last updated */
  updatedAt?: Date;
  /** Most recent message in the conversation */
  lastMessage?: string;
  /** Time of last message in the conversation */
  lastMessageTime?: string;
  /** Number of unread messages for the current user */
  unreadCount: number;
  /** Display title/name of the group */
  name: string;
  /** Optional avatar URL for the group */
  avatarUrl?: string;
  /** List of participants in the conversation */
  participants: ConversationParticipant[];
  /** Custom key-value metadata */
  metadata?: Record<string, string>;
  /** Whether the conversation is pinned */
  pin?: boolean;
  /** Whether the conversation is read */
  isRead?: boolean;
  /** The user who created the conversation */
  createdBy?: ChatUser;
}

/**
 * Direct 1-on-1 conversation between two users
 */
export interface DirectConversation extends BaseConversation {
  type: 'direct';
  /** The other user in the direct conversation */
  otherParticipant: ConversationParticipant;
}

/**
 * Group conversation among multiple users
 */
export interface GroupConversation extends BaseConversation {
  type: 'group';
  /** Optional topic/description of the group */
  description?: string;
}

/**
 * Discriminated union of all conversation types
 */
export type Conversation = DirectConversation | GroupConversation;

/**
 * Options for creating a direct 1-on-1 conversation
 */
export interface CreateDirectConversationOptions {
  /** Target user's ACS Communication User ID */
  targetUserId: string;
  /** Target user's display name */
  displayName?: string;
}

/**
 * Options for creating a group conversation
 */
export interface CreateGroupConversationOptions {
  /** Display name / topic for the group */
  name: string;
  /** Initial list of participants to add */
  participants: Array<{ userId: string; displayName?: string }>;
  /** Optional description for the group */
  description?: string;
}

/**
 * Represents a conversation item returned from the backend API
 */
export interface BackendConversationItem {
  id: string;
  type: string;
  topic?: string;
  createdAt?: string | Date | number;
  updatedAt?: string | Date | number;
  participants?: ConversationParticipant[];
  pid?: string;
  hostId?: string;
  roomName?: string;
  description?: string;
  threadId?: string;
  avatarUrl?: string;
  created?: string;
  modified?: string | Date | number | null;
  creator?: string;
  modifier?: string;
  isRead?: boolean;
  pin?: boolean;
  isMuted?: boolean;
  lastMessage?: string;
  lastMessageTime?: string | null;
  lastViewedDate?: string | null;
}
