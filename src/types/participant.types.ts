import type { ChatUser } from './chat.types';

/**
 * Represents a participant in a chat thread
 */
export interface ChatParticipant extends ChatUser {
  /** Timestamp when the participant joined the thread */
  joinedAt?: Date;
}

/**
 * Extended participant model containing role information
 */
export interface ConversationParticipant extends ChatParticipant {
  /** Role of the participant in the conversation */
  role?: 'owner' | 'admin' | 'member';
}
