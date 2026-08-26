import { describe, it, expect } from 'vitest';
import {
  mapWsMessageToChatMessage,
  mapWsMemberToParticipant,
  mapWsRoomToConversation,
  mapWsRoomEventToDomainEvent,
} from '../../adapters/websocket/websocketMappers';
import type { WsServerRoomEventMessage } from '../../types/websocket.types';
import type { ChatDomainEvent } from '../../types/events.types';
import type { ChatMessage } from '../../types/message.types';

interface PinEventPayload {
  messageId: string;
  actorName?: string;
  actionAtUtc?: string;
}

describe('WebSocket Mappers', () => {
  describe('mapWsMessageToChatMessage', () => {
    it('should map NewMessage payload to ChatMessage', () => {
      const payload = {
        messageId: 'msg-123',
        content: 'Hello World',
        createdDate: '2026-08-18T10:00:00Z',
        senderId: 'user-1',
        senderName: 'Alice',
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1', 'user-1');

      expect(result.id).toBe('msg-123');
      expect(result.conversationId).toBe('room-1');
      expect(result.content).toBe('Hello World');
      expect(result.sender.id).toBe('user-1');
      expect(result.sender.displayName).toBe('Alice');
      expect(result.senderDisplayName).toBe('Alice');
      expect(result.status).toBe('sent');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

it('should map PascalCase NewMessage payload to ChatMessage correctly', () => {
      const payload = {
        MessageId: '1787194704985',
        Content: '333',
        CreatedDate: '2026-08-20T02:58:25.0854042Z',
        EditedDate: null,
        DeletedDate: null,
        IsDeleted: false,
        SenderId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
        SenderName: 'Hà Anh Thảo 2',
        metadata: { type: 'html' },
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1', 'user-1');
      expect(result.id).toBe('1787194704985');
      expect(result.content).toBe('333');
      expect(result.type).toBe('html');
      expect(result.sender.id).toBe('2a53536f-a1a4-4e87-9586-86f14537ed6b');
      expect(result.sender.displayName).toBe('Hà Anh Thảo 2');
    });

    it('should map attachments from payload when present', () => {
      const payload = {
        messageId: 'msg-999',
        content: '',
        senderId: 'user-1',
        attachments: [
          {
            id: 'att-1',
            name: 'report.pdf',
            url: 'https://cdn.example.com/report.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            thumbnailUrl: 'https://cdn.example.com/thumb.png',
          },
          {
            fileName: 'photo.jpg',
            fileUrl: 'https://cdn.example.com/photo.jpg',
            contentType: 'image/jpeg',
          },
        ],
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.attachments).toHaveLength(2);
      expect(result.attachments?.[0].id).toBe('att-1');
      expect(result.attachments?.[0].name).toBe('report.pdf');
      expect(result.attachments?.[0].url).toBe('https://cdn.example.com/report.pdf');
      expect(result.attachments?.[0].mimeType).toBe('application/pdf');
      expect(result.attachments?.[0].thumbnailUrl).toBe('https://cdn.example.com/thumb.png');
      expect(result.attachments?.[1].name).toBe('photo.jpg');
      expect(result.attachments?.[1].url).toBe('https://cdn.example.com/photo.jpg');
      expect(result.attachments?.[1].mimeType).toBe('image/jpeg');
    });

    it('should not set attachments when payload has none', () => {
      const payload = {
        messageId: 'msg-1000',
        content: 'plain text',
        senderId: 'user-1',
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.attachments).toBeUndefined();
    });

    it('should map clientMessageId and sequenceId from payload and metadata when present', () => {
      const payload = {
        messageId: 'msg-2000',
        content: 'echo',
        senderId: 'user-1',
        clientMessageId: 'cm-2000',
        sequenceId: '42',
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.clientMessageId).toBe('cm-2000');
      expect(result.sequenceId).toBe('42');

      const payloadFromMetadata = {
        messageId: 'msg-2001',
        content: 'echo via metadata',
        senderId: 'user-1',
        metadata: { clientMessageId: 'cm-2001', sequenceId: '43' },
      };

      const resultFromMetadata = mapWsMessageToChatMessage(payloadFromMetadata, 'room-1');
      expect(resultFromMetadata.clientMessageId).toBe('cm-2001');
      expect(resultFromMetadata.sequenceId).toBe('43');
    });

    it('should map edited and deleted flags', () => {
      const payload = {
        messageId: 'msg-456',
        content: 'Updated content',
        createdDate: '2026-08-18T10:00:00Z',
        editedDate: '2026-08-18T10:05:00Z',
        isDeleted: true,
        senderId: 'user-2',
        senderName: 'Bob',
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.editedAt).toBeInstanceOf(Date);
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should fall back to senderCommunicationIdentifier.rawId when senderId is missing', () => {
      const payload = {
        messageId: 'msg-789',
        content: 'No sender id',
        senderCommunicationIdentifier: {
          rawId: '8:acs:raw-guid',
          communicationUser: { id: '8:acs:guid' },
        },
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.sender.id).toBe('8:acs:raw-guid');
    });

    it('should fall back to cui when senderId and sender are missing', () => {
      const payload = {
        messageId: 'msg-790',
        content: 'Cui sender',
        cui: 'contact-cui-1',
      };

      const result = mapWsMessageToChatMessage(payload, 'room-1');
      expect(result.sender.id).toBe('contact-cui-1');
    });
  });

  describe('mapWsMemberToParticipant', () => {
    it('should map member item', () => {
      const item = {
        cui: 'user-1',
        contactName: 'Alice',
        avatarUrl: 'https://avatar.png',
        isAdmin: true,
      };

      const result = mapWsMemberToParticipant(item);
      expect(result.id).toBe('user-1');
      expect(result.displayName).toBe('Alice');
      expect(result.avatarUrl).toBe('https://avatar.png');
      expect(result.role).toBe('owner');
    });
  });

  describe('mapWsRoomToConversation', () => {
    it('should map direct conversation when roomType is U', () => {
      const payload = {
        roomId: 'room-1',
        roomName: 'Direct Room',
        roomType: 'U',
        createdByUserId: 'user-1',
        createdByName: 'Alice',
        createdDate: '2026-08-18T10:00:00Z',
        members: [
          { cui: 'user-1', contactName: 'Alice' },
          { cui: 'user-2', contactName: 'Bob' },
        ],
      };

      const result = mapWsRoomToConversation(payload, 'user-1');
      expect(result.type).toBe('direct');
      if (result.type === 'direct') {
        expect(result.otherParticipant.id).toBe('user-2');
      }
    });

    it('should map group conversation when roomType is G', () => {
      const payload = {
        roomId: 'room-group',
        roomName: 'Group Alpha',
        roomType: 'G',
        createdByUserId: 'user-1',
        createdByName: 'Alice',
        createdDate: '2026-08-18T10:00:00Z',
        members: [
          { cui: 'user-1', contactName: 'Alice' },
          { cui: 'user-2', contactName: 'Bob' },
          { cui: 'user-3', contactName: 'Charlie' },
        ],
      };

      const result = mapWsRoomToConversation(payload, 'user-1');
      expect(result.type).toBe('group');
      expect(result.name).toBe('Group Alpha');
      expect(result.participants.length).toBe(3);
    });

    it('should keep group conversation for roomType G even with exactly 2 members', () => {
      const payload = {
        roomId: 'room-group-2',
        roomName: 'Two-Person Group',
        roomType: 'G',
        createdDate: '2026-08-18T10:00:00Z',
        members: [
          { cui: 'user-1', contactName: 'Alice' },
          { cui: 'user-2', contactName: 'Bob' },
        ],
      };

      const result = mapWsRoomToConversation(payload, 'user-1');
      expect(result.type).toBe('group');
    });

    it('should keep group conversation for lowercase roomType group with exactly 2 members', () => {
      const payload = {
        roomId: 'room-group-3',
        roomName: 'Named Group',
        roomType: 'group',
        createdDate: '2026-08-18T10:00:00Z',
        members: [
          { cui: 'user-1', contactName: 'Alice' },
          { cui: 'user-2', contactName: 'Bob' },
        ],
      };

      const result = mapWsRoomToConversation(payload, 'user-1');
      expect(result.type).toBe('group');
    });
  });

  describe('mapWsRoomEventToDomainEvent', () => {
    it('should map server NewMessage room event with PascalCase payload correctly', () => {
      const eventJson = {
        type: 'room_event',
        success: true,
        roomId: 'f220f5e0-a950-45fd-b011-130ac2cca639',
        eventType: 'NewMessage',
        payload: {
          MessageId: '1787194704985',
          Content: '333',
          CreatedDate: '2026-08-20T02:58:25.0854042Z',
          EditedDate: null,
          DeletedDate: null,
          IsDeleted: false,
          SenderId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
          SenderName: 'Hà Anh Thảo 2',
          metadata: { type: 'html' },
        },
        serverTimeUtc: '2026-08-20T02:58:25.0863651Z',
      };

      const domainEvent = mapWsRoomEventToDomainEvent(eventJson, 'current-user-id');
      expect(domainEvent).not.toBeNull();
      expect(domainEvent?.type).toBe('message:received');
      expect(domainEvent?.conversationId).toBe('f220f5e0-a950-45fd-b011-130ac2cca639');
      const msg = (domainEvent as ChatDomainEvent<ChatMessage> | null)?.payload;
      expect(msg?.id).toBe('1787194704985');
      expect(msg?.content).toBe('333');
      expect(msg?.type).toBe('html');
      expect(msg?.sender.id).toBe('2a53536f-a1a4-4e87-9586-86f14537ed6b');
      expect(msg?.sender.displayName).toBe('Hà Anh Thảo 2');
    });

    it('should map NewMessage event', () => {
      const event: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'NewMessage',
        payload: {
          messageId: 'msg-1',
          content: 'Hello',
          createdDate: '2026-08-18T10:00:00Z',
          senderId: 'user-1',
          senderName: 'Alice',
        },
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      const domainEvent = mapWsRoomEventToDomainEvent(event, 'user-1');
      expect(domainEvent).not.toBeNull();
      expect(domainEvent?.type).toBe('message:received');
      expect(domainEvent?.conversationId).toBe('room-1');
    });

    it('should map MessageDeleted event', () => {
      const event: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'MessageDeleted',
        payload: {
          messageId: 'msg-1',
          deletedAtUtc: '2026-08-18T10:00:00Z',
          deletedBy: 'user-1',
        },
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      const domainEvent = mapWsRoomEventToDomainEvent(event);
      expect(domainEvent?.type).toBe('message:deleted');
    });

    it('should map MessagePinned and MessageUnpinned events correctly', () => {
      const pinEvent = {
        type: 'room_event',
        success: true,
        roomId: 'f220f5e0-a950-45fd-b011-130ac2cca639',
        eventType: 'MessagePinned',
        payload: {
          messageId: '1787198733909',
          actorId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
          actorName: 'Hà Anh Thảo 2',
          actionAtUtc: '2026-08-20T04:09:02.3617401Z',
        },
        serverTimeUtc: '2026-08-20T04:09:02.3627776Z',
      };

      const unpinEvent = {
        type: 'room_event',
        success: true,
        roomId: 'f220f5e0-a950-45fd-b011-130ac2cca639',
        eventType: 'MessageUnpinned',
        payload: {
          messageId: '1786594746570',
          actorId: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
          actorName: 'Hà Anh Thảo 2',
          actionAtUtc: '2026-08-20T04:10:08.2670851Z',
        },
        serverTimeUtc: '2026-08-20T04:10:08.2680483Z',
      };

      const pinnedDomainEvent = mapWsRoomEventToDomainEvent(pinEvent);
      expect(pinnedDomainEvent?.type).toBe('message:pinned');
      expect(pinnedDomainEvent?.conversationId).toBe('f220f5e0-a950-45fd-b011-130ac2cca639');
      expect((pinnedDomainEvent as ChatDomainEvent<PinEventPayload> | null)?.payload.messageId).toBe(
        '1787198733909'
      );
      expect(
        (pinnedDomainEvent as ChatDomainEvent<PinEventPayload> | null)?.payload.actorName
      ).toBe('Hà Anh Thảo 2');

      const unpinnedDomainEvent = mapWsRoomEventToDomainEvent(unpinEvent);
      expect(unpinnedDomainEvent?.type).toBe('message:unpinned');
      expect(unpinnedDomainEvent?.conversationId).toBe('f220f5e0-a950-45fd-b011-130ac2cca639');
      expect(
        (unpinnedDomainEvent as ChatDomainEvent<PinEventPayload> | null)?.payload.messageId
      ).toBe('1786594746570');
      expect(
        (unpinnedDomainEvent as ChatDomainEvent<PinEventPayload> | null)?.payload.actorName
      ).toBe('Hà Anh Thảo 2');
    });

    it('should map RoomPinned and RoomUnpinned events', () => {
      const pinEvent: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'RoomPinned',
        payload: null,
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      const unpinEvent: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'RoomUnpinned',
        payload: null,
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      expect(mapWsRoomEventToDomainEvent(pinEvent)?.type).toBe('room:pinned');
      expect(mapWsRoomEventToDomainEvent(unpinEvent)?.type).toBe('room:unpinned');
    });

    it('should map MemberJoined and MemberLeft events', () => {
      const joinEvent: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'MemberJoined',
        payload: {
          roomId: 'room-1',
          addedUserIds: ['user-2', 'user-3'],
          addedByUserId: 'user-1',
          addedByName: 'Alice',
          actionAtUtc: '2026-08-18T10:00:00Z',
        },
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      const leftEvent: WsServerRoomEventMessage = {
        type: 'room_event',
        success: true,
        roomId: 'room-1',
        eventType: 'MemberLeft',
        payload: {
          roomId: 'room-1',
          userId: 'user-2',
          leftAtUtc: '2026-08-18T10:00:00Z',
        },
        serverTimeUtc: '2026-08-18T10:00:00Z',
      };

      expect(mapWsRoomEventToDomainEvent(joinEvent)?.type).toBe('participant:added');
      expect(mapWsRoomEventToDomainEvent(leftEvent)?.type).toBe('participant:removed');
    });
  });
});
