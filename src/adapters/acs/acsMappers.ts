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
  BackendChatMessageData,
} from '../../types';
import type { ReadReceipt } from '../../models/ReadReceipt';
import { AcsChatError } from '../../types/errors.types';
import { CHAT_ERRORS } from '../../constants/errors';

/**
 * Extract raw communication user ID string from ACS CommunicationIdentifier.
 */
export function extractCommunicationUserId(
  identifier?: CommunicationIdentifier | CommunicationIdentifierKind | Record<string, unknown> | string
): string {
  if (!identifier) {
    return '';
  }
  if (typeof identifier === 'string') {
    return identifier;
  }
  const idObj = identifier as Record<string, unknown>;
  if (typeof idObj.communicationUserId === 'string') {
    return idObj.communicationUserId;
  }
  if (typeof idObj.rawId === 'string') {
    return idObj.rawId;
  }
  if (
    idObj.communicationUser &&
    typeof (idObj.communicationUser as Record<string, unknown>).id === 'string'
  ) {
    return (idObj.communicationUser as Record<string, unknown>).id as string;
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
  identifier?: CommunicationIdentifier | CommunicationIdentifierKind | Record<string, unknown> | string,
  displayName?: string
): ChatUser {
  const id = extractCommunicationUserId(identifier);
  return {
    id: id || 'system',
    displayName: displayName || (id ? undefined : 'System'),
  };
}

/**
 * Map ACS ChatMessage or backend ChatMessage to Library ChatMessage.
 */
export function mapAcsMessageToMessage(
  acsMsg: ACSChatMessage | BackendChatMessageData | Record<string, unknown> | unknown,
  convId: string,
  _currentUserId?: string
): ChatMessage {
  const msgObj = acsMsg as Record<string, unknown>;
  const msgType = (msgObj.type as string) || 'text';
  const metadata = (msgObj.metadata as Record<string, string>) || undefined;

  const isSystem =
    msgType === 'topicUpdated' ||
    msgType === 'participantAdded' ||
    msgType === 'participantRemoved';

  const type: MessageType = isSystem
    ? 'system'
    : msgType === 'html' || metadata?.type === 'html'
    ? 'html'
    : 'text';

  const senderIdentifier =
    msgObj.sender ||
    msgObj.senderCommunicationIdentifier ||
    msgObj.senderIdentifier;

  const sender = mapAcsIdentifierToUser(
    senderIdentifier as CommunicationIdentifier | undefined,
    msgObj.senderDisplayName as string | undefined
  );

  const rawContent = msgObj.content as
    | {
        message?: string | null;
        topic?: string | null;
        participants?: Array<{ id?: unknown; displayName?: string }>;
        initiator?: unknown;
      }
    | string
    | undefined;

  let systemEvent: ChatMessage['systemEvent'] = undefined;
  if (isSystem && typeof rawContent === 'object' && rawContent !== null) {
    systemEvent = {
      type: msgType as 'topicUpdated' | 'participantAdded' | 'participantRemoved',
      initiator: rawContent.initiator
        ? mapAcsIdentifierToUser(rawContent.initiator as CommunicationIdentifier)
        : undefined,
      participants: rawContent.participants
        ? rawContent.participants.map((p) =>
            mapAcsIdentifierToUser(
              (p.id || (p as Record<string, unknown>).senderCommunicationIdentifier || p) as CommunicationIdentifier,
              p.displayName
            )
          )
        : undefined,
      newTopic: rawContent.topic || undefined,
    };
  }

  let content = '';
  if (typeof rawContent === 'string') {
    content = rawContent;
  } else if (typeof rawContent === 'object' && rawContent !== null) {
    content = isSystem
      ? rawContent.topic || rawContent.message || ''
      : rawContent.message || '';
  }

  const createdOn =
    (msgObj.createdOn || msgObj.createdDate || msgObj.createdAt) as
      | string
      | number
      | Date
      | undefined;
  const editedOn =
    (msgObj.editedOn || msgObj.editedDate || msgObj.editedAt) as
      | string
      | number
      | Date
      | undefined;
  const deletedOn =
    (msgObj.deletedOn || msgObj.deletedDate || msgObj.deletedAt) as
      | string
      | number
      | Date
      | undefined;

  const recalledAt = metadata?.deletedBy
    ? new Date(editedOn || createdOn || Date.now())
    : undefined;

  return {
    id: String(msgObj.id),
    conversationId: convId,
    type,
    content,
    sender,
    senderDisplayName: msgObj.senderDisplayName as string | undefined,
    createdAt: createdOn ? new Date(createdOn) : new Date(),
    editedAt: editedOn ? new Date(editedOn) : undefined,
    deletedAt: deletedOn ? new Date(deletedOn) : undefined,
    recalledAt,
    status: 'sent',
    metadata,
    systemEvent,
    sequenceId: msgObj.sequenceId ? String(msgObj.sequenceId) : undefined,
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
