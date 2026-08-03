import type { ChatUser } from '../types';

/**
 * Internal domain model for User
 */
export type UserModel = ChatUser;

/**
 * User presence state (optional extension for internal use)
 */
export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  lastSeenAt?: Date;
}
