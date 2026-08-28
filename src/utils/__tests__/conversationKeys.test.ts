import { describe, it, expect } from 'vitest';
import {
  findConversationKey,
  resolveConversationKeys,
  resolveRoomId,
} from '../conversationKeys';
import type { Conversation } from '../../types/conversation.types';

const makeConversation = (overrides: Record<string, unknown>): Conversation =>
  ({
    id: 'conv-id-1',
    type: 'direct',
    createdAt: new Date('2026-08-20T10:00:00Z'),
    unreadCount: 0,
    name: 'Alice',
    participants: [],
    ...overrides,
  }) as unknown as Conversation;

describe('findConversationKey', () => {
  const conversations: Record<string, Conversation> = {
    'conv-id-1': makeConversation({
      id: 'conv-id-1',
      conversationId: 'room-guid-1',
      threadId: 'thread-guid-1',
      roomId: 'room-guid-1',
    }),
  };

  it('returns the key when lookup uses the canonical id', () => {
    expect(findConversationKey('conv-id-1', conversations)).toBe('conv-id-1');
  });

  it('returns the canonical key when lookup uses an alias (conversationId/roomId/threadId)', () => {
    expect(findConversationKey('room-guid-1', conversations)).toBe('conv-id-1');
    expect(findConversationKey('thread-guid-1', conversations)).toBe('conv-id-1');
  });

  it('returns undefined when lookup is empty, conversations is empty/undefined, or not found', () => {
    expect(findConversationKey('', conversations)).toBeUndefined();
    expect(findConversationKey('conv-id-1', {})).toBeUndefined();
    expect(findConversationKey('conv-id-1', undefined as never)).toBeUndefined();
    expect(findConversationKey('missing', conversations)).toBeUndefined();
  });
});

describe('resolveConversationKeys', () => {
  it('returns all aliases under which a conversation may be stored', () => {
    const conversations: Record<string, Conversation> = {
      'conv-id-1': makeConversation({
        id: 'conv-id-1',
        conversationId: 'room-guid-1',
        threadId: 'thread-guid-1',
        roomId: 'room-guid-1',
      }),
    };

    const keys = resolveConversationKeys('room-guid-1', conversations);
    expect(keys.sort()).toEqual(['conv-id-1', 'room-guid-1', 'thread-guid-1']);
  });

  it('returns only the input when conversations is undefined or not found', () => {
    expect(resolveConversationKeys('conv-id-1', undefined)).toEqual(['conv-id-1']);
    expect(resolveConversationKeys('missing', {})).toEqual(['missing']);
    expect(resolveConversationKeys('', {})).toEqual([]);
  });
});

describe('resolveRoomId', () => {
  const conversations: Record<string, Conversation> = {
    'conv-id-1': makeConversation({
      id: 'conv-id-1',
      conversationId: 'room-guid-1',
      threadId: 'thread-guid-1',
      roomId: 'room-guid-1',
    }),
  };

  it('resolves the backend room id from a canonical id', () => {
    expect(resolveRoomId('conv-id-1', conversations)).toBe('room-guid-1');
  });

  it('resolves the backend room id from an alias (conversationId/roomId/threadId)', () => {
    expect(resolveRoomId('room-guid-1', conversations)).toBe('room-guid-1');
    expect(resolveRoomId('thread-guid-1', conversations)).toBe('room-guid-1');
  });

  it('falls back to the input when conversations is undefined', () => {
    expect(resolveRoomId('conv-id-1', undefined)).toBe('conv-id-1');
  });

  it('falls back to the input when conversation is not found', () => {
    expect(resolveRoomId('missing', conversations)).toBe('missing');
    expect(resolveRoomId('missing', {})).toBe('missing');
  });
});
