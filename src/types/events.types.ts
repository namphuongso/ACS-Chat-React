/**
 * Supported domain event types emitted by the chat library event bus
 */
export type ChatEventType =
  | 'message:received'
  | 'message:edited'
  | 'message:deleted'
  | 'typing:started'
  | 'readReceipt:received'
  | 'conversation:created'
  | 'conversation:deleted'
  | 'conversation:updated'
  | 'participant:added'
  | 'participant:removed'
  | 'connection:connected'
  | 'connection:disconnected';

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
