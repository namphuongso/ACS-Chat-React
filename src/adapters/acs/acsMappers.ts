import type {
  ChatMessage as ACSChatMessage,
  ChatThreadItem,
  ChatThreadProperties,
  ChatParticipant as ACSChatParticipant,
  ChatMessageReadReceipt,
} from '@azure/communication-chat';
import type {
  CommunicationIdentifier,
  CommunicationIdentifierKind,
} from '@azure/communication-common';
import type {
  ChatUser,
  ChatMessage,
  MessageType,
  Conversation,
  ConversationParticipant,
  ChatErrorCode,
  BackendConversationItem,
  GroupConversation,
} from '../../types';
import type { ReadReceipt } from '../../models/ReadReceipt';
import { AcsChatError } from '../../types/errors.types';
import { CHAT_ERRORS } from '../../constants/errors';

/**
 * Extract raw communication user ID string from ACS CommunicationIdentifier.
 */
export function extractCommunicationUserId(
  identifier?: CommunicationIdentifier | CommunicationIdentifierKind | Record<string, unknown>
): string {
  if (!identifier) {
    return '';
  }
  const idObj = identifier as Record<string, unknown>;
  if (typeof idObj.communicationUserId === 'string') {
    return idObj.communicationUserId;
  }
  if (typeof idObj.rawId === 'string') {
    return idObj.rawId;
  }
  if (typeof idObj.phoneNumber === 'string') {
    return idObj.phoneNumber;
  }
  if (typeof idObj.microsoftTeamsUserId === 'string') {
    return idObj.microsoftTeamsUserId;
  }
  if (typeof idObj.id === 'string') {
    return idObj.id;
  }
  return '';
}

/**
 * Map BackendConversationItem to Library Conversation.
 */
export function mapBackendItemToConversation(item: BackendConversationItem): Conversation {
  const commonProps = {
    id: item.threadId || item.id,
    conversationId: item.id,
    createdAt: new Date(item.created || item.createdAt || Date.now()),
    updatedAt:
      item.modified || item.updatedAt
        ? new Date((item.modified || item.updatedAt) as string | number | Date)
        : undefined,
    unreadCount: item.isRead === false ? 1 : 0,
    participants: item.participants || [],
    avatarUrl: item.avatarUrl || undefined,
    pin: item.pin || false,
    lastMessage: item.lastMessage || '',
    lastMessageTime: item.lastMessageTime || '',
    isRead: item.isRead || false,
  };

  if (item.type === 'U' || item.type === 'direct') {
    return {
      ...commonProps,
      type: 'direct',
      otherParticipant: {
        id: item.pid || 'unknown',
        displayName: item.roomName || 'Unknown',
      },
      name: item.roomName || 'Unknown',
    };
  }

  return {
    ...commonProps,
    type: 'group',
    name: item.roomName || item.topic || 'Group',
  };
}

/**
 * Map ACS CommunicationIdentifier to Library ChatUser.
 */
export function mapAcsIdentifierToUser(
  identifier?: CommunicationIdentifier | CommunicationIdentifierKind,
  displayName?: string
): ChatUser {
  const id = extractCommunicationUserId(identifier);
  return {
    id: id || 'system',
    displayName: displayName || (id ? undefined : 'System'),
  };
}

/**
 * Map ACS ChatMessage to Library ChatMessage.
 */
export function mapAcsMessageToMessage(
  acsMsg: ACSChatMessage,
  convId: string,
  _currentUserId?: string
): ChatMessage {
  const isSystem =
    acsMsg.type === 'topicUpdated' ||
    acsMsg.type === 'participantAdded' ||
    acsMsg.type === 'participantRemoved';

  const type: MessageType = isSystem ? 'system' : acsMsg.type === 'html' ? 'html' : 'text';

  const sender = mapAcsIdentifierToUser(acsMsg.sender, acsMsg.senderDisplayName);

  let systemEvent: ChatMessage['systemEvent'] = undefined;
  if (isSystem) {
    systemEvent = {
      type: acsMsg.type as 'topicUpdated' | 'participantAdded' | 'participantRemoved',
      initiator: acsMsg.content?.initiator
        ? mapAcsIdentifierToUser(acsMsg.content.initiator)
        : undefined,
      participants: acsMsg.content?.participants
        ? acsMsg.content.participants.map((p) => mapAcsIdentifierToUser(p.id, p.displayName))
        : undefined,
      newTopic: acsMsg.content?.topic,
    };
  }

  const content = isSystem
    ? acsMsg.content?.topic || acsMsg.content?.message || ''
    : acsMsg.content?.message || '';

  return {
    id: acsMsg.id,
    conversationId: convId,
    type,
    content,
    sender,
    senderDisplayName: acsMsg.senderDisplayName,
    createdAt: acsMsg.createdOn ? new Date(acsMsg.createdOn) : new Date(),
    editedAt: acsMsg.editedOn ? new Date(acsMsg.editedOn) : undefined,
    deletedAt: acsMsg.deletedOn ? new Date(acsMsg.deletedOn) : undefined,
    status: 'sent',
    metadata: acsMsg.metadata,
    systemEvent,
    sequenceId: acsMsg.sequenceId,
  };
}

/**
 * Map ACS ChatThreadItem to Library Partial<Conversation>.
 */
export function mapAcsThreadItemToConversation(threadItem: ChatThreadItem): Partial<Conversation> {
  const result: Partial<GroupConversation> = {
    id: threadItem.id,
    type: 'group',
    name: threadItem.topic || '',
    updatedAt: threadItem.lastMessageReceivedOn
      ? new Date(threadItem.lastMessageReceivedOn)
      : undefined,
  };
  return result;
}

/**
 * Map ACS ChatThreadProperties to Library Partial<Conversation>.
 */
export function mapAcsThreadPropertiesToConversation(
  props: ChatThreadProperties
): Partial<Conversation> {
  const result: Partial<GroupConversation> = {
    id: props.id,
    type: 'group',
    name: props.topic || '',
    createdAt: props.createdOn ? new Date(props.createdOn) : new Date(),
    metadata: props.metadata,
  };
  return result;
}

/**
 * Map ACS ChatParticipant to Library ConversationParticipant.
 */
export function mapAcsParticipantToParticipant(
  acsParticipant: ACSChatParticipant
): ConversationParticipant {
  const user = mapAcsIdentifierToUser(acsParticipant.id, acsParticipant.displayName);
  return {
    ...user,
    joinedAt: acsParticipant.shareHistoryTime
      ? new Date(acsParticipant.shareHistoryTime)
      : undefined,
    role: 'member',
  };
}

/**
 * Map ACS ChatMessageReadReceipt to Library ReadReceipt.
 */
export function mapAcsReadReceiptToReadReceipt(receipt: ChatMessageReadReceipt): ReadReceipt {
  return {
    messageId: receipt.chatMessageId,
    user: mapAcsIdentifierToUser(receipt.sender),
    readOn: receipt.readOn ? new Date(receipt.readOn) : new Date(),
  };
}

/**
 * Map ACS Error / RestError / Unknown Error to Library AcsChatError.
 */
export function mapAcsErrorToChatError(
  error: unknown,
  operation?: string,
  options?: { messageId?: string; conversationId?: string }
): AcsChatError {
  if (error instanceof AcsChatError) {
    if (
      (options?.messageId && error.messageId !== options.messageId) ||
      (options?.conversationId && error.conversationId !== options.conversationId)
    ) {
      return new AcsChatError(error.code, error.message, {
        cause: error.cause,
        operation: operation || error.operation,
        conversationId: options.conversationId || error.conversationId,
        messageId: options.messageId || error.messageId,
        retryable: error.retryable,
      });
    }
    return error;
  }

  const err = error as {
    statusCode?: number;
    status?: number;
    code?: string;
    message?: string;
    name?: string;
  };
  const statusCode = err?.statusCode || err?.status;

  let errorCode: ChatErrorCode = 'ACS_SERVICE_ERROR';
  let retryable = false;

  if (statusCode === 401) {
    errorCode = 'AUTH_TOKEN_EXPIRED';
  } else if (statusCode === 403) {
    errorCode = 'PERMISSION_DENIED';
  } else if (statusCode === 404) {
    errorCode = 'ACS_NOT_FOUND';
  } else if (statusCode === 429) {
    errorCode = 'ACS_RATE_LIMITED';
    retryable = true;
  } else if (statusCode === 400) {
    errorCode = 'INVALID_INPUT';
  } else if (statusCode && statusCode >= 500) {
    errorCode = 'ACS_SERVICE_ERROR';
    retryable = true;
  } else if (
    err?.name === 'TypeError' ||
    err?.message?.toLowerCase().includes('fetch') ||
    err?.message?.toLowerCase().includes('network')
  ) {
    errorCode = 'NETWORK_ERROR';
    retryable = true;
  }

  const message =
    err?.message || CHAT_ERRORS.MESSAGES[errorCode] || 'An ACS service error occurred.';

  return new AcsChatError(errorCode, message, {
    cause: error,
    operation,
    retryable,
    conversationId: options?.conversationId,
    messageId: options?.messageId,
  });
}
