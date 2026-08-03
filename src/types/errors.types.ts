/**
 * Error code classifications for chat operations
 */
export type ChatErrorCode =
  // Auth
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_REFRESH_FAILED'
  | 'AUTH_UNAUTHORIZED'

  // Network
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'

  // ACS
  | 'ACS_SERVICE_ERROR'
  | 'ACS_RATE_LIMITED'
  | 'ACS_NOT_FOUND'

  // Permission
  | 'PERMISSION_DENIED'

  // Conversation
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_DELETED'
  | 'CONVERSATION_DUPLICATE'

  // Message
  | 'MESSAGE_NOT_FOUND'
  | 'MESSAGE_TOO_LARGE'
  | 'MESSAGE_SEND_FAILED'

  // Connection
  | 'CONNECTION_LOST'
  | 'CONNECTION_FAILED'
  | 'RECONNECT_FAILED'

  // General
  | 'UNKNOWN_ERROR'
  | 'INVALID_INPUT';

/**
 * Standard error object produced by the ACS chat library
 */
export interface ChatError {
  /** Error classification code */
  code: ChatErrorCode;
  /** Human-readable error message */
  message: string;
  /** Underlying cause or original error object */
  cause?: unknown;
  /** Name of the operation that failed */
  operation?: string;
  /** Related conversation ID if applicable */
  conversationId?: string;
  /** Related message ID if applicable */
  messageId?: string;
  /** Indicates if the operation can be retried */
  retryable: boolean;
  /** Timestamp when the error occurred */
  timestamp: Date;
}

/**
 * Custom Error class thrown by the ACS Chat Library
 */
export class AcsChatError extends Error implements ChatError {
  readonly code: ChatErrorCode;
  readonly cause?: unknown;
  readonly operation?: string;
  readonly conversationId?: string;
  readonly messageId?: string;
  readonly retryable: boolean;
  readonly timestamp: Date;

  constructor(
    code: ChatErrorCode,
    message: string,
    options?: {
      cause?: unknown;
      operation?: string;
      conversationId?: string;
      messageId?: string;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'AcsChatError';
    this.code = code;
    this.cause = options?.cause;
    this.operation = options?.operation;
    this.conversationId = options?.conversationId;
    this.messageId = options?.messageId;
    this.retryable = options?.retryable ?? false;
    this.timestamp = new Date();

    Object.setPrototypeOf(this, AcsChatError.prototype);
  }
}

