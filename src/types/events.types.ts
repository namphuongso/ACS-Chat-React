/**
 * Supported domain event types emitted by the chat library event bus
 */
export type ChatEventType =
  | 'message:received'
  | 'message:edited'
  | 'message:deleted'
  | 'message:pinned'
  | 'message:unpinned'
  | 'message:reacted'
  | 'message:reactionRemoved'
  | 'typing:started'
  | 'readReceipt:received'
  | 'conversation:created'
  | 'conversation:deleted'
  | 'conversation:updated'
  | 'participant:added'
  | 'participant:removed'
  | 'room:pinned'
  | 'room:unpinned'
  | 'room:roleChanged'
  | 'room:ownershipTransferred'
  | 'room:disbanded'
  | 'connection:connected'
  | 'connection:disconnected'
  | 'ws:connected'
  | 'ws:disconnected'
  | 'ws:error'
  | 'token:refreshed'
  | 'token:refreshFailed';

/**
 * Normalized domain event payload structure
 */
export interface ChatDomainEvent<T = unknown> {
  /** Specific event type */
  type: ChatEventType;
  /** ID of the associated conversation/thread */
  conversationId: string;
  /** Timestamp when event occurred */
  timestamp: Date;
  /** Event-specific payload data */
  payload: T;
} /**
 * Interface for domain event handlers
 */
export interface ChatEventHandler {
  onEvent(event: ChatDomainEvent): void;
}
