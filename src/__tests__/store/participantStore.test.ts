import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useParticipantStore, initialParticipantState } from '../../store/participantStore';
import {
  selectParticipantsByConversation,
  selectTypingUsersByConversation,
  selectReadReceiptsByConversation,
  selectReadReceiptForUser,
} from '../../store/selectors';
import type { ConversationParticipant } from '../../types/participant.types';
import type { ReadReceipt } from '../../models/ReadReceipt';

describe('participantStore', () => {
  const p1: ConversationParticipant = {
    id: 'user-1',
    displayName: 'Alice',
    role: 'owner',
  };

  const p2: ConversationParticipant = {
    id: 'user-2',
    displayName: 'Bob',
    role: 'member',
  };

  const p3: ConversationParticipant = {
    id: 'user-3',
    displayName: 'Charlie',
    role: 'member',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    useParticipantStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with default state', () => {
    const state = useParticipantStore.getState();
    expect(state.participantsByConversation).toEqual({});
    expect(state.typingUsers).toEqual({});
    expect(state.readReceipts).toEqual({});
  });

  it('should setParticipants and replace existing participants', () => {
    useParticipantStore.getState().setParticipants('conv-1', [p1, p2]);

    const state = useParticipantStore.getState();
    expect(state.participantsByConversation['conv-1']).toEqual([p1, p2]);
  });

  it('should addParticipants deduplicating by ID and updating fields', () => {
    useParticipantStore.getState().setParticipants('conv-1', [p1, p2]);

    const p2Updated: ConversationParticipant = {
      ...p2,
      displayName: 'Robert',
    };

    useParticipantStore.getState().addParticipants('conv-1', [p2Updated, p3]);

    const participants = useParticipantStore.getState().participantsByConversation['conv-1'];
    expect(participants).toHaveLength(3);
    expect(participants.find((p) => p.id === 'user-2')?.displayName).toBe('Robert');
    expect(participants.find((p) => p.id === 'user-3')).toBeDefined();
  });

  it('should removeParticipant by userId', () => {
    useParticipantStore.getState().setParticipants('conv-1', [p1, p2, p3]);
    useParticipantStore.getState().removeParticipant('conv-1', 'user-2');

    const participants = useParticipantStore.getState().participantsByConversation['conv-1'];
    expect(participants).toHaveLength(2);
    expect(participants.map((p) => p.id)).toEqual(['user-1', 'user-3']);
  });

  it('should setTypingUser and removeTypingUser', () => {
    useParticipantStore.getState().setTypingUser('conv-1', p1);

    let typingMap = useParticipantStore.getState().typingUsers['conv-1'];
    expect(typingMap['user-1']).toBeDefined();
    expect(typingMap['user-1'].user.displayName).toBe('Alice');

    useParticipantStore.getState().removeTypingUser('conv-1', 'user-1');
    typingMap = useParticipantStore.getState().typingUsers['conv-1'];
    expect(typingMap['user-1']).toBeUndefined();
  });

  it('should auto-expire typing user after timeoutMs', () => {
    useParticipantStore.getState().setTypingUser('conv-1', p1, 1000);

    expect(useParticipantStore.getState().typingUsers['conv-1']['user-1']).toBeDefined();

    vi.advanceTimersByTime(1000);

    expect(useParticipantStore.getState().typingUsers['conv-1']?.['user-1']).toBeUndefined();
  });

  it('should refresh auto-expiry timer when setTypingUser is called again', () => {
    useParticipantStore.getState().setTypingUser('conv-1', p1, 1000);

    vi.advanceTimersByTime(500);
    useParticipantStore.getState().setTypingUser('conv-1', p1, 1000);

    vi.advanceTimersByTime(500); // 1000ms after 1st call, 500ms after 2nd call
    expect(useParticipantStore.getState().typingUsers['conv-1']['user-1']).toBeDefined();

    vi.advanceTimersByTime(500); // 1000ms after 2nd call
    expect(useParticipantStore.getState().typingUsers['conv-1']?.['user-1']).toBeUndefined();
  });

  it('should clearTypingUsers for a conversation', () => {
    useParticipantStore.getState().setTypingUser('conv-1', p1);
    useParticipantStore.getState().setTypingUser('conv-1', p2);

    expect(Object.keys(useParticipantStore.getState().typingUsers['conv-1'])).toHaveLength(2);

    useParticipantStore.getState().clearTypingUsers('conv-1');

    expect(useParticipantStore.getState().typingUsers['conv-1']).toBeUndefined();
  });

  it('should cleanupExpiredTypingUsers based on maxAgeMs', () => {
    useParticipantStore.getState().setTypingUser('conv-1', p1, 5000);

    vi.advanceTimersByTime(6000);
    useParticipantStore.getState().cleanupExpiredTypingUsers('conv-1', 5000);

    expect(useParticipantStore.getState().typingUsers['conv-1']?.['user-1']).toBeUndefined();
  });

  it('should setReadReceipts and addReadReceipt', () => {
    const receipt1: ReadReceipt = {
      messageId: 'msg-10',
      user: p1,
      readOn: new Date('2026-01-01T10:00:00Z'),
    };

    useParticipantStore.getState().setReadReceipts('conv-1', [receipt1]);

    const state = useParticipantStore.getState();
    expect(state.readReceipts['conv-1']['user-1']).toEqual(receipt1);

    const receipt2: ReadReceipt = {
      messageId: 'msg-12',
      user: p1,
      readOn: new Date('2026-01-01T10:05:00Z'),
    };

    useParticipantStore.getState().addReadReceipt('conv-1', receipt2);
    expect(useParticipantStore.getState().readReceipts['conv-1']['user-1']).toEqual(receipt2);

    // Older receipt for user-1 should be ignored
    const olderReceipt: ReadReceipt = {
      messageId: 'msg-5',
      user: p1,
      readOn: new Date('2026-01-01T09:00:00Z'),
    };

    useParticipantStore.getState().addReadReceipt('conv-1', olderReceipt);
    expect(useParticipantStore.getState().readReceipts['conv-1']['user-1']).toEqual(receipt2);
  });

  it('should retrieve data using participant selectors', () => {
    useParticipantStore.getState().setParticipants('conv-1', [p1, p2]);
    useParticipantStore.getState().setTypingUser('conv-1', p1);

    const receipt: ReadReceipt = {
      messageId: 'msg-1',
      user: p1,
      readOn: new Date(),
    };
    useParticipantStore.getState().setReadReceipts('conv-1', [receipt]);

    const state = useParticipantStore.getState();

    expect(selectParticipantsByConversation(state, 'conv-1')).toHaveLength(2);
    expect(selectTypingUsersByConversation(state, 'conv-1')).toHaveLength(1);
    expect(selectReadReceiptsByConversation(state, 'conv-1')).toHaveLength(1);
    expect(selectReadReceiptForUser(state, 'conv-1', 'user-1')).toEqual(receipt);
  });

  it('should reset state and cancel pending timers', () => {
    useParticipantStore.getState().setParticipants('conv-1', [p1]);
    useParticipantStore.getState().setTypingUser('conv-1', p1, 5000);

    useParticipantStore.getState().reset();

    expect(useParticipantStore.getState()).toEqual({
      ...initialParticipantState,
      setParticipants: expect.any(Function),
      addParticipants: expect.any(Function),
      removeParticipant: expect.any(Function),
      setTypingUser: expect.any(Function),
      removeTypingUser: expect.any(Function),
      clearTypingUsers: expect.any(Function),
      cleanupExpiredTypingUsers: expect.any(Function),
      setReadReceipts: expect.any(Function),
      addReadReceipt: expect.any(Function),
      reset: expect.any(Function),
    });
  });
});
