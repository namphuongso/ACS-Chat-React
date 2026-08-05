import { describe, it, expect } from 'vitest';
import {
  mapAcsIdentifierToUser,
  mapAcsMessageToMessage,
  mapAcsThreadItemToConversation,
  mapAcsThreadPropertiesToConversation,
  mapAcsParticipantToParticipant,
  mapAcsReadReceiptToReadReceipt,
  mapAcsErrorToChatError,
  extractCommunicationUserId,
} from '../../adapters/acs/acsMappers';
import { AcsChatError } from '../../types/errors.types';
import type { GroupConversation } from '../../types';
import type {
  ChatMessage as ACSChatMessage,
  ChatThreadItem,
  ChatThreadProperties,
  ChatParticipant as ACSChatParticipant,
  ChatMessageReadReceipt,
} from '@azure/communication-chat';
import type { CommunicationUserIdentifier, PhoneNumberIdentifier } from '@azure/communication-common';

describe('ACS Model Mappers', () => {
  describe('extractCommunicationUserId & mapAcsIdentifierToUser', () => {
    it('should extract ID from communicationUserId object', () => {
      const identifier: CommunicationUserIdentifier = { communicationUserId: '8:acs:user-123' };
      expect(extractCommunicationUserId(identifier)).toBe('8:acs:user-123');
      const user = mapAcsIdentifierToUser(identifier, 'User One');
      expect(user).toEqual({
        id: '8:acs:user-123',
        displayName: 'User One',
      });
    });

    it('should extract ID from phoneNumber object', () => {
      const identifier: PhoneNumberIdentifier = { phoneNumber: '+1234567890' };
      expect(extractCommunicationUserId(identifier)).toBe('+1234567890');
      const user = mapAcsIdentifierToUser(identifier);
      expect(user.id).toBe('+1234567890');
    });

    it('should handle undefined or empty identifier gracefully', () => {
      expect(extractCommunicationUserId(undefined)).toBe('');
      const user = mapAcsIdentifierToUser(undefined);
      expect(user).toEqual({
        id: 'system',
        displayName: 'System',
      });
    });
  });

  describe('mapAcsMessageToMessage', () => {
    const now = new Date();

    it('should map standard text message', () => {
      const acsMsg: ACSChatMessage = {
        id: 'msg-1',
        type: 'text',
        sequenceId: '1',
        version: '1',
        content: { message: 'Hello World' },
        senderDisplayName: 'Alice',
        createdOn: now,
        sender: { kind: 'communicationUser', communicationUserId: '8:acs:alice' },
      };

      const result = mapAcsMessageToMessage(acsMsg, 'thread-1', '8:acs:alice');
      expect(result.id).toBe('msg-1');
      expect(result.conversationId).toBe('thread-1');
      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello World');
      expect(result.sender.id).toBe('8:acs:alice');
      expect(result.senderDisplayName).toBe('Alice');
      expect(result.createdAt).toEqual(now);
      expect(result.status).toBe('sent');
    });

    it('should map html message', () => {
      const acsMsg: ACSChatMessage = {
        id: 'msg-2',
        type: 'html',
        sequenceId: '2',
        version: '1',
        content: { message: '<b>Bold Text</b>' },
        senderDisplayName: 'Bob',
        createdOn: now,
        sender: { kind: 'communicationUser', communicationUserId: '8:acs:bob' },
      };

      const result = mapAcsMessageToMessage(acsMsg, 'thread-1', '8:acs:alice');
      expect(result.type).toBe('html');
      expect(result.content).toBe('<b>Bold Text</b>');
    });

    it('should map system topicUpdated message and edge cases', () => {
      const acsMsg: ACSChatMessage = {
        id: 'msg-3',
        type: 'topicUpdated',
        sequenceId: '3',
        version: '1',
        content: {
          topic: 'New Group Name',
          initiator: { kind: 'communicationUser', communicationUserId: '8:acs:alice' },
        },
        createdOn: now,
      };

      const result = mapAcsMessageToMessage(acsMsg, 'thread-1', '8:acs:alice');
      expect(result.type).toBe('system');
      expect(result.content).toBe('New Group Name');
      expect(result.sender.id).toBe('system');
      expect(result.systemEvent?.type).toBe('topicUpdated');
      expect(result.systemEvent?.newTopic).toBe('New Group Name');
      expect(result.systemEvent?.initiator?.id).toBe('8:acs:alice');
    });
  });

  describe('mapAcsThreadItemToConversation & mapAcsThreadPropertiesToConversation', () => {
    const createdOn = new Date('2026-01-01T00:00:00Z');
    const updatedOn = new Date('2026-01-02T00:00:00Z');

    it('should map ChatThreadItem to Partial<Conversation>', () => {
      const threadItem: ChatThreadItem = {
        id: 'thread-123',
        topic: 'Engineering Team',
        lastMessageReceivedOn: updatedOn,
      };

      const conv = mapAcsThreadItemToConversation(threadItem) as Partial<GroupConversation>;
      expect(conv.id).toBe('thread-123');
      expect(conv.name).toBe('Engineering Team');
      expect(conv.type).toBe('group');
      expect(conv.updatedAt).toEqual(updatedOn);
    });

    it('should map ChatThreadProperties to Partial<Conversation>', () => {
      const props: ChatThreadProperties = {
        id: 'thread-456',
        topic: 'Design Team',
        createdOn,
      };

      const conv = mapAcsThreadPropertiesToConversation(props) as Partial<GroupConversation>;
      expect(conv.id).toBe('thread-456');
      expect(conv.name).toBe('Design Team');
      expect(conv.type).toBe('group');
      expect(conv.createdAt).toEqual(createdOn);
    });
  });

  describe('mapAcsParticipantToParticipant', () => {
    it('should map ChatParticipant to ConversationParticipant', () => {
      const joinedAt = new Date('2026-01-01T10:00:00Z');
      const acsParticipant: ACSChatParticipant = {
        id: { communicationUserId: '8:acs:charlie' },
        displayName: 'Charlie',
        shareHistoryTime: joinedAt,
      };

      const participant = mapAcsParticipantToParticipant(acsParticipant);
      expect(participant.id).toBe('8:acs:charlie');
      expect(participant.displayName).toBe('Charlie');
      expect(participant.joinedAt).toEqual(joinedAt);
      expect(participant.role).toBe('member');
    });
  });

  describe('mapAcsReadReceiptToReadReceipt', () => {
    it('should map ChatMessageReadReceipt to ReadReceipt', () => {
      const readOn = new Date('2026-01-01T12:00:00Z');
      const receipt: ChatMessageReadReceipt = {
        chatMessageId: 'msg-100',
        sender: { kind: 'communicationUser', communicationUserId: '8:acs:david' },
        readOn,
      };

      const result = mapAcsReadReceiptToReadReceipt(receipt);
      expect(result.messageId).toBe('msg-100');
      expect(result.user.id).toBe('8:acs:david');
      expect(result.readOn).toEqual(readOn);
    });
  });

  describe('mapAcsErrorToChatError', () => {
    it('should return the error if it is already an AcsChatError', () => {
      const existingError = new AcsChatError('INVALID_INPUT', 'Test message');
      const mapped = mapAcsErrorToChatError(existingError);
      expect(mapped).toBe(existingError);
    });

    it('should map 401 status to AUTH_TOKEN_EXPIRED', () => {
      const error = { statusCode: 401, message: 'Unauthorized' };
      const mapped = mapAcsErrorToChatError(error);
      expect(mapped.code).toBe('AUTH_TOKEN_EXPIRED');
    });

    it('should map 403 status to PERMISSION_DENIED', () => {
      const error = { statusCode: 403, message: 'Forbidden' };
      const mapped = mapAcsErrorToChatError(error);
      expect(mapped.code).toBe('PERMISSION_DENIED');
    });

    it('should map 404 status to ACS_NOT_FOUND', () => {
      const error = { statusCode: 404, message: 'Not Found' };
      const mapped = mapAcsErrorToChatError(error);
      expect(mapped.code).toBe('ACS_NOT_FOUND');
    });

    it('should map 429 status to ACS_RATE_LIMITED with retryable=true', () => {
      const error = { statusCode: 429, message: 'Too Many Requests' };
      const mapped = mapAcsErrorToChatError(error);
      expect(mapped.code).toBe('ACS_RATE_LIMITED');
      expect(mapped.retryable).toBe(true);
    });

    it('should map network error to NETWORK_ERROR with retryable=true', () => {
      const error = new TypeError('Failed to fetch');
      const mapped = mapAcsErrorToChatError(error);
      expect(mapped.code).toBe('NETWORK_ERROR');
      expect(mapped.retryable).toBe(true);
    });

    it('should attach messageId and conversationId from options when mapping a new error', () => {
      const error = { statusCode: 400, message: 'Bad Request' };
      const mapped = mapAcsErrorToChatError(error, 'someOperation', {
        messageId: 'msg-123',
        conversationId: 'conv-456',
      });
      expect(mapped.code).toBe('INVALID_INPUT');
      expect(mapped.operation).toBe('someOperation');
      expect(mapped.messageId).toBe('msg-123');
      expect(mapped.conversationId).toBe('conv-456');
    });

    it('should return a new error with messageId/conversationId if already an AcsChatError but those properties differ', () => {
      const existingError = new AcsChatError('INVALID_INPUT', 'Test message', {
        operation: 'oldOp',
        conversationId: 'oldConv',
        messageId: 'oldMsg',
      });
      const mapped = mapAcsErrorToChatError(existingError, 'newOp', {
        messageId: 'newMsg',
        conversationId: 'newConv',
      });
      expect(mapped).not.toBe(existingError);
      expect(mapped.code).toBe('INVALID_INPUT');
      expect(mapped.operation).toBe('newOp');
      expect(mapped.messageId).toBe('newMsg');
      expect(mapped.conversationId).toBe('newConv');
    });

    it('should return the same error if it is already an AcsChatError and options match or are not provided', () => {
      const existingError = new AcsChatError('INVALID_INPUT', 'Test message', {
        operation: 'oldOp',
        conversationId: 'oldConv',
        messageId: 'oldMsg',
      });
      const mapped = mapAcsErrorToChatError(existingError, 'oldOp', {
        messageId: 'oldMsg',
        conversationId: 'oldConv',
      });
      expect(mapped).toBe(existingError);
    });
  });
});
