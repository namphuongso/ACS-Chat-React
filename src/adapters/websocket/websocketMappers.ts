import type {
  WsNewMessagePayload,
  WsMessageUpdatedPayload,
  WsRoomMemberItem,
  WsRoomCreatedPayload,
  WsRoomUpdatedPayload,
  WsServerRoomEventMessage,
} from '../../types/websocket.types';
import type {
  ChatMessage,
  FileAttachment,
  MessageType,
} from '../../types/message.types';
import type {
  Conversation,
  DirectConversation,
  GroupConversation,
} from '../../types/conversation.types';
import type { ConversationParticipant } from '../../types/participant.types';
import type { ChatDomainEvent } from '../../types/events.types';
import { logger } from '../../utils';

/**
 * Best-effort mapping of attachment entries inside WS message payloads
 * (fields `attachments`/`files`, camelCase or PascalCase). The current
 * backend spec does not send attachment objects, but mapping them when
 * present keeps file messages rendered correctly if/when the spec adds them.
 */
function mapWsAttachments(raw?: unknown): FileAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const attachments: FileAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const a = item as Record<string, unknown>;
    const id = String(
      a.id ?? a.Id ?? a.fileId ?? a.FileId ?? a.attachmentId ?? a.AttachmentId ?? ''
    );
    const name = String(a.name ?? a.Name ?? a.fileName ?? a.FileName ?? '');
    const url = String(a.url ?? a.Url ?? a.fileUrl ?? a.FileUrl ?? a.blobUrl ?? a.BlobUrl ?? '');
    if (!url) continue;
    const mimeKey = Object.keys(a).find((k) =>
      /mimetype|contenttype/i.test(k)
    );
    const mimeType = String(
      mimeKey ? a[mimeKey] : (a.mimeType ?? a.MimeType ?? 'application/octet-stream')
    );
    const sizeRaw = a.size ?? a.Size ?? a.fileSize ?? a.FileSize;
    const size = typeof sizeRaw === 'number' ? sizeRaw : Number(sizeRaw ?? 0) || 0;
    const thumbUrl =
      (a.thumbnailUrl ?? a.ThumbnailUrl ?? a.thumbUrl ?? a.ThumbUrl) as string | undefined;
    attachments.push({
      id: id || url,
      name: name || url,
      size,
      mimeType,
      url,
      thumbnailUrl: thumbUrl,
    });
  }
  return attachments.length > 0 ? attachments : undefined;
}

/**
 * Maps a WebSocket message payload (NewMessage / MessageUpdated) to the internal ChatMessage model.
 * Handles both camelCase and PascalCase payloads from the server.
 */
export function mapWsMessageToChatMessage(
  payload: WsNewMessagePayload | WsMessageUpdatedPayload | Record<string, unknown>,
  conversationId: string,
  _currentUserId?: string
): ChatMessage {
  const p = (payload || {}) as Record<string, unknown>;
  const messageId = String(p.messageId ?? p.MessageId ?? p.id ?? p.Id ?? '');
  const content = String(p.content ?? p.Content ?? p.message ?? p.Message ?? '');
  const rawSender =
    (p.sender as Record<string, unknown> | undefined)?.id ??
    (p.senderCommunicationIdentifier as Record<string, unknown> | undefined)?.rawId ??
    p.cui ??
    p.Cui;
  const senderId = String(p.senderId ?? p.SenderId ?? rawSender ?? '');
  const senderName = (p.senderName ?? p.SenderName ?? p.senderDisplayName ?? p.SenderDisplayName ?? (p.sender as Record<string, unknown>)?.displayName) as string | undefined;

  const rawCreated = (p.createdDate ?? p.CreatedDate ?? p.createdOn ?? p.CreatedOn ?? p.createdAt ?? p.CreatedAt) as string | number | Date | undefined;
  const createdDate = rawCreated ? new Date(rawCreated) : new Date();

  const rawEdited = (p.editedDate ?? p.EditedDate ?? p.editedOn ?? p.EditedOn ?? p.editedAt ?? p.EditedAt) as string | number | Date | undefined;
  const editedDate = rawEdited ? new Date(rawEdited) : undefined;

  const rawDeleted = (p.deletedDate ?? p.DeletedDate ?? p.deletedAtUtc ?? p.DeletedAtUtc ?? p.deletedOn ?? p.DeletedOn) as string | number | Date | undefined;
  const isDeleted = Boolean(p.isDeleted ?? p.IsDeleted ?? rawDeleted);
  const deletedDate = rawDeleted ? new Date(rawDeleted) : isDeleted ? new Date() : undefined;

  const metadata = (p.metadata ?? p.Metadata) as Record<string, string> | undefined;
  const rawType = (metadata?.type ?? p.type ?? p.Type) as string | undefined;
  const type: MessageType =
    rawType === 'html' || rawType === 'RichText/Html'
      ? 'html'
      : rawType === 'system'
        ? 'system'
        : 'text';

  const rawAttachments = p.attachments ?? p.Attachments ?? p.files ?? p.Files;
  const attachments = mapWsAttachments(rawAttachments);

  const clientMessageId = (p.clientMessageId ?? p.ClientMessageId ?? metadata?.clientMessageId) as string | undefined;
  const sequenceId = (p.sequenceId ?? p.SequenceId ?? metadata?.sequenceId) as string | undefined;

  return {
    id: messageId,
    conversationId: conversationId || '',
    type,
    content,
    sender: {
      id: senderId,
      displayName: senderName,
    },
    senderDisplayName: senderName,
    createdAt: isNaN(createdDate.getTime()) ? new Date() : createdDate,
    editedAt: editedDate && !isNaN(editedDate.getTime()) ? editedDate : undefined,
    deletedAt: deletedDate && !isNaN(deletedDate.getTime()) ? deletedDate : undefined,
    status: 'sent',
    metadata: metadata || undefined,
    attachments,
    clientMessageId,
    sequenceId,
  };
}

/**
 * Maps a WebSocket room member item to the internal ConversationParticipant model.
 * Handles both camelCase and PascalCase payloads.
 */
export function mapWsMemberToParticipant(
  item: WsRoomMemberItem | Record<string, unknown>
): ConversationParticipant {
  const m = (item || {}) as Record<string, unknown>;
  const id = String(m.cui ?? m.Cui ?? m.userId ?? m.UserId ?? m.id ?? m.Id ?? '');
  const displayName = (m.contactName ?? m.ContactName ?? m.displayName ?? m.DisplayName ?? m.fullName ?? m.FullName) as string | undefined;
  const avatarUrl = (m.avatarUrl ?? m.AvatarUrl) as string | undefined;
  const isAdmin = Boolean(m.isAdmin ?? m.IsAdmin);

  return {
    id,
    displayName,
    avatarUrl,
    role: isAdmin ? 'owner' : 'member',
  };
}

/**
 * Maps a WebSocket RoomCreated or RoomUpdated payload to the internal Conversation model.
 * Handles both camelCase and PascalCase payloads.
 */
export function mapWsRoomToConversation(
  payload: WsRoomCreatedPayload | WsRoomUpdatedPayload | Record<string, unknown>,
  currentUserId?: string
): Conversation {
  const p = (payload || {}) as Record<string, unknown>;
  const roomId = String(p.roomId ?? p.RoomId ?? p.id ?? p.Id ?? '');
  const roomName = String(p.roomName ?? p.RoomName ?? p.name ?? p.Name ?? '');
  const roomType = String(p.roomType ?? p.RoomType ?? p.type ?? p.Type ?? 'group');

  const rawCreated = (p.createdDate ?? p.CreatedDate ?? p.createdAt ?? p.CreatedAt) as string | number | Date | undefined;
  const createdDate = rawCreated ? new Date(rawCreated) : new Date();
  const validCreatedDate = isNaN(createdDate.getTime()) ? new Date() : createdDate;

  const rawMembers = (p.members ?? p.Members) as Array<Record<string, unknown>> | undefined;
  const participants: ConversationParticipant[] = Array.isArray(rawMembers)
    ? rawMembers.map(mapWsMemberToParticipant)
    : [];

  // Backend room types use 'U' (direct) / 'G' (group) per the WebSocket spec.
  // Normalize to uppercase so lowercase 'direct'/'group' values are also handled.
  const normalizedRoomType = roomType.toUpperCase();
  const isDirect =
    normalizedRoomType === 'U' ||
    normalizedRoomType === 'DIRECT' ||
    (participants.length === 2 &&
      normalizedRoomType !== 'G' &&
      normalizedRoomType !== 'GROUP');

  if (isDirect) {
    const otherMember =
      participants.find((m) => m.id !== currentUserId) ||
      participants[0] || {
        id: roomId,
        displayName: roomName,
      };

    const directConv: DirectConversation = {
      id: roomId,
      conversationId: roomId,
      type: 'direct',
      name: roomName || otherMember.displayName || '',
      avatarUrl: (p.avatarUrl ?? p.AvatarUrl ?? otherMember.avatarUrl) as string | undefined,
      createdAt: validCreatedDate,
      updatedAt: validCreatedDate,
      unreadCount: 0,
      participants,
      otherParticipant: otherMember,
    };
    return directConv;
  }

  const groupConv: GroupConversation = {
    id: roomId,
    conversationId: roomId,
    type: 'group',
    name: roomName || 'Group Chat',
    avatarUrl: (p.avatarUrl ?? p.AvatarUrl) as string | undefined,
    createdAt: validCreatedDate,
    updatedAt: validCreatedDate,
    unreadCount: 0,
    participants,
  };
  return groupConv;
}

/**
 * Normalizes a WebSocket room_event message into an internal ChatDomainEvent.
 * Handles both camelCase and PascalCase payloads from backend WebSocket push.
 */
export function mapWsRoomEventToDomainEvent(
  event: WsServerRoomEventMessage | Record<string, unknown>,
  currentUserId?: string
): ChatDomainEvent | null {
  if (!event || typeof event !== 'object') return null;

  const e = event as Record<string, unknown>;
  logger.debug(
    `[WebsocketMappers] Received room event: type=${String(e.type ?? e.Type)}, eventType=${String(
      e.eventType ?? e.EventType
    )}, roomId=${String(e.roomId ?? e.RoomId ?? '')}`
  );

  const type = e.type ?? e.Type;
  if (type !== 'room_event') return null;

  const roomId = String(e.roomId ?? e.RoomId ?? '');
  const eventType = String(e.eventType ?? e.EventType ?? '');
  const payload = (e.payload ?? e.Payload) as Record<string, unknown>;
  const rawServerTime = (e.serverTimeUtc ?? e.ServerTimeUtc) as string | undefined;
  const timestamp = rawServerTime ? new Date(rawServerTime) : new Date();
  const validTimestamp = isNaN(timestamp.getTime()) ? new Date() : timestamp;

  switch (eventType) {
    case 'NewMessage': {
      const chatMessage = mapWsMessageToChatMessage(payload, roomId, currentUserId);
      return {
        type: 'message:received',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: chatMessage,
      };
    }

    case 'MessageUpdated': {
      const chatMessage = mapWsMessageToChatMessage(payload, roomId, currentUserId);
      return {
        type: 'message:edited',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: chatMessage,
      };
    }

    case 'MessageDeleted': {
      const messageId = String(payload?.messageId ?? payload?.MessageId ?? '');
      const rawDelDate = (payload?.deletedAtUtc ?? payload?.DeletedAtUtc ?? payload?.deletedDate ?? payload?.DeletedDate) as string | undefined;
      const delDate = rawDelDate ? new Date(rawDelDate) : validTimestamp;
      const deletedBy = (payload?.deletedBy ?? payload?.DeletedBy) as string | undefined;
      return {
        type: 'message:deleted',
        conversationId: roomId,
        timestamp: isNaN(delDate.getTime()) ? validTimestamp : delDate,
        payload: {
          id: messageId,
          conversationId: roomId,
          deletedAt: isNaN(delDate.getTime()) ? validTimestamp : delDate,
          deletedBy,
        },
      };
    }

    case 'MessagePinned': {
      const messageId = String(payload?.messageId ?? payload?.MessageId ?? payload?.id ?? payload?.Id ?? '');
      return {
        type: 'message:pinned',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          messageId,
          actorId: (payload?.actorId ?? payload?.ActorId) as string | undefined,
          actorName: (payload?.actorName ?? payload?.ActorName) as string | undefined,
          actionAtUtc: (payload?.actionAtUtc ?? payload?.ActionAtUtc) as string | undefined,
        },
      };
    }

    case 'MessageUnpinned': {
      const messageId = String(payload?.messageId ?? payload?.MessageId ?? payload?.id ?? payload?.Id ?? '');
      return {
        type: 'message:unpinned',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          messageId,
          actorId: (payload?.actorId ?? payload?.ActorId) as string | undefined,
          actorName: (payload?.actorName ?? payload?.ActorName) as string | undefined,
          actionAtUtc: (payload?.actionAtUtc ?? payload?.ActionAtUtc) as string | undefined,
        },
      };
    }

    case 'MessageReacted': {
      const messageId = String(payload?.messageId ?? payload?.MessageId ?? '');
      return {
        type: 'message:reacted',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          messageId,
          reactionCode: payload?.reactionCode ?? payload?.ReactionCode,
          actorId: payload?.actorId ?? payload?.ActorId,
          actorName: payload?.actorName ?? payload?.ActorName,
        },
      };
    }

    case 'MessageReactionRemoved': {
      const messageId = String(payload?.messageId ?? payload?.MessageId ?? '');
      return {
        type: 'message:reactionRemoved',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          messageId,
          reactionCode: null,
          actorId: payload?.actorId ?? payload?.ActorId,
          actorName: payload?.actorName ?? payload?.ActorName,
        },
      };
    }

    case 'RoomCreated': {
      const conversation = mapWsRoomToConversation(payload, currentUserId);
      return {
        type: 'conversation:created',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: conversation,
      };
    }

    case 'RoomUpdated': {
      const roomName = (payload?.roomName ?? payload?.RoomName) as string | undefined;
      const avatarUrl = (payload?.avatarUrl ?? payload?.AvatarUrl) as string | undefined;
      const roomType = (payload?.roomType ?? payload?.RoomType) as string | undefined;
      return {
        type: 'conversation:updated',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          id: roomId,
          name: roomName,
          avatarUrl: avatarUrl,
          roomType: roomType,
          updatedAt: validTimestamp,
        },
      };
    }

    case 'RoomDisbanded': {
      return {
        type: 'room:disbanded',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload,
      };
    }

    case 'RoomRoleChanged': {
      return {
        type: 'room:roleChanged',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload,
      };
    }

    case 'RoomOwnershipTransferred': {
      return {
        type: 'room:ownershipTransferred',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload,
      };
    }

    case 'RoomPinned': {
      return {
        type: 'room:pinned',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: { roomId, pin: true },
      };
    }

    case 'RoomUnpinned': {
      return {
        type: 'room:unpinned',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: { roomId, pin: false },
      };
    }

    case 'MemberJoined': {
      const rawAddedIds = (payload?.addedUserIds ?? payload?.AddedUserIds) as string[] | undefined;
      const addedByUserId = (payload?.addedByUserId ?? payload?.AddedByUserId) as string | undefined;
      const addedByName = (payload?.addedByName ?? payload?.AddedByName) as string | undefined;
      const participants: ConversationParticipant[] = Array.isArray(rawAddedIds)
        ? rawAddedIds.map((userId: string) => ({
            id: userId,
            displayName: undefined,
            role: 'member',
          }))
        : [];
      return {
        type: 'participant:added',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          participants,
          addedByUserId,
          addedByName,
        },
      };
    }

    case 'MemberLeft': {
      const userId = String(payload?.userId ?? payload?.UserId ?? '');
      return {
        type: 'participant:removed',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          participants: [{ id: userId, role: 'member' }],
          userId,
        },
      };
    }

    case 'MemberRemoved': {
      const removedUserId = String(payload?.removedUserId ?? payload?.RemovedUserId ?? '');
      const removedByUserId = (payload?.removedByUserId ?? payload?.RemovedByUserId) as string | undefined;
      return {
        type: 'participant:removed',
        conversationId: roomId,
        timestamp: validTimestamp,
        payload: {
          participants: [{ id: removedUserId, role: 'member' }],
          removedUserId,
          removedByUserId,
        },
      };
    }

    default:
      logger.warn(`[WebsocketMappers] Unknown room eventType: ${eventType}`, event);
      return null;
  }
}
