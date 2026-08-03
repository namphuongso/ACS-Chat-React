/**
 * Represents a user within the ACS Chat domain
 */
export interface ChatUser {
  /** ACS Communication User ID */
  id: string;
  /** Display name of the user */
  displayName?: string;
}

/**
 * Connection state of the real-time communication channel
 */
export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';
