import type { ChatUser } from '../types';

/**
 * Internal domain model for ReadReceipt
 */
export interface ReadReceipt {
  /** ID of the message that was read */
  messageId: string;
  /** User who read the message */
  user: ChatUser;
  /** Timestamp when the message was read */
  readOn: Date;
}
