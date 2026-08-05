import type { ChatErrorCode } from '../types/errors.types';

export const CHAT_ERROR_MESSAGES: Record<ChatErrorCode, string> = {
  // Auth
  AUTH_TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng làm mới.',
  AUTH_TOKEN_INVALID: 'Token đăng nhập không hợp lệ.',
  AUTH_REFRESH_FAILED: 'Không thể làm mới token đăng nhập.',
  AUTH_UNAUTHORIZED: 'Bạn không có quyền thực hiện thao tác này.',

  // Network
  NETWORK_ERROR: 'Lỗi mạng. Vui lòng kiểm tra lại kết nối.',
  NETWORK_TIMEOUT: 'Kết nối quá hạn. Vui lòng thử lại sau.',

  // ACS
  ACS_SERVICE_ERROR: 'Lỗi từ hệ thống máy chủ chat. Vui lòng thử lại sau.',
  ACS_RATE_LIMITED: 'Hệ thống đang quá tải. Vui lòng đợi một lát.',
  ACS_NOT_FOUND: 'Không tìm thấy tài nguyên trên máy chủ.',

  // Permission
  PERMISSION_DENIED: 'Bạn không có quyền truy cập vào nội dung này.',

  // Conversation
  CONVERSATION_NOT_FOUND: 'Không tìm thấy cuộc trò chuyện.',
  CONVERSATION_DELETED: 'Cuộc trò chuyện đã bị xóa.',
  CONVERSATION_DUPLICATE: 'Cuộc trò chuyện này đã tồn tại.',

  // Message
  MESSAGE_NOT_FOUND: 'Không tìm thấy tin nhắn.',
  MESSAGE_TOO_LARGE: 'Nội dung tin nhắn quá dài.',
  MESSAGE_SEND_FAILED: 'Không thể gửi tin nhắn.',

  // Connection
  CONNECTION_LOST: 'Mất kết nối tới máy chủ. Đang thử lại...',
  CONNECTION_FAILED: 'Không thể kết nối tới máy chủ chat.',
  RECONNECT_FAILED: 'Không thể kết nối lại. Vui lòng tải lại trang.',

  // General
  UNKNOWN_ERROR: 'Đã có lỗi không xác định xảy ra.',
  INVALID_INPUT: 'Dữ liệu không hợp lệ.',
};

export const CHAT_ERRORS = {
  MESSAGES: CHAT_ERROR_MESSAGES,
} as const;
