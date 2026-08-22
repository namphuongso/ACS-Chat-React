/**
 * Configuration options for reconnecting to ACS
 */
export interface ReconnectPolicy {
  /** Maximum number of reconnection attempts (default: 10) */
  maxRetries: number;
  /** Initial delay in milliseconds before first reconnection attempt (default: 1000) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds between reconnection attempts (default: 30000) */
  maxDelayMs: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier: number;
}

/**
 * Logger interface for library diagnostic logging
 */
export interface ChatLogger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Primary configuration for initializing the ACS Chat client / provider
 */
export interface ChatConfig {
  /** ACS resource endpoint URL */
  endpoint: string;
  /** Current user's ACS Communication User ID */
  userId: string;
  /** Current user's display name */
  displayName: string;
  /** Initial ACS access token */
  token: string;
  /** Async callback to refresh token when expired or proactively */
  tokenRefresher: () => Promise<string>;
  /** Optional backend API base URL */
  backendUrl?: string;
  /** Optional custom headers for backend API requests */
  backendHeaders?: Record<string, string>;
  /** Optional custom headers for file upload API requests */
  uploadHeaders?: Record<string, string>;
  /** Optional custom headers for file download requests */
  downloadHeaders?: Record<string, string>;
  /** Optional reconnection policy configuration */
  reconnectPolicy?: ReconnectPolicy;
  /** Optional custom logger implementation */
  logger?: ChatLogger;
  /** Optional callback to handle file uploads, returning metadata for attachment */
  onFileUpload?: (file: File) => Promise<import('./message.types').FileAttachment>;
  /** Optional callback to handle file downloads */
  onFileDownload?: (url: string, fileName?: string) => Promise<void> | void;
  /** Optional explicit WebSocket server URL (e.g. wss://<host>/ws/chat/view) */
  websocketUrl?: string;
  /** Optional device ID for multi-device/multi-tab WebSocket session identification */
  deviceId?: string;
  /** Optional initial room ID to join upon opening WebSocket connection */
  initialRoomId?: string;
  /** Optional flag to enable/disable WebSocket realtime connection (default: true if backendUrl/websocketUrl present) */
  enableWebSocket?: boolean;
  /** Optional JWT access token specifically for WebSocket/Backend if distinct from ACS token */
  accessToken?: string;
}
