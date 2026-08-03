import type { ChatMessage } from './message.types';
import type { ConversationParticipant } from './participant.types';

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
  /** Type of conversation ('direct' or 'group') */
  type: ConversationType;
  /** Timestamp when conversation was created */
  createdAt: Date;
  /** Timestamp when conversation was last updated */
  updatedAt?: Date;
  /** Most recent message in the conversation */
  lastMessage?: ChatMessage;
  /** Number of unread messages for the current user */
  unreadCount: number;
  /** List of participants in the conversation */
  participants: ConversationParticipant[];
  /** Custom key-value metadata */
  metadata?: Record<string, string>;
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
  /** Display title/name of the group */
  name: string;
  /** Optional topic/description of the group */
  description?: string;
  /** Optional avatar URL for the group */
  avatarUrl?: string;
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
