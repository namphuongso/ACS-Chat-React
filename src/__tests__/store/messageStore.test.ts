import { describe, it, expect, beforeEach } from 'vitest';
import {
  useMessageStore,
  initialMessageState,
  compareMessages,
  dedupAndSortMessages,
} from '../../store/messageStore';
import {
  selectMessagesByConversation,
  selectConversationMessagesData,
  selectLatestMessage,
} from '../../store/selectors';
import type { ChatMessage } from '../../types/message.types';

describe('messageStore', () => {
  const sampleUser = { id: 'user-1', displayName: 'Alice' };

  const sampleMsg1: ChatMessage = {
    id: 'msg-1',
    conversationId: 'conv-1',
    type: 'text',
    content: 'Hello',
    sender: sampleUser,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    status: 'sent',
    sequenceId: '1',
  };

  const sampleMsg2: ChatMessage = {
    id: 'msg-2',
    conversationId: 'conv-1',
    type: 'text',
    content: 'World',
    sender: sampleUser,
    createdAt: new Date('2026-01-01T10:05:00Z'),
    status: 'sent',
    sequenceId: '2',
  };

  const sampleMsg3: ChatMessage = {
    id: 'msg-3',
    conversationId: 'conv-1',
    type: 'text',
    content: 'Latest',
    sender: sampleUser,
    createdAt: new Date('2026-01-01T10:10:00Z'),
    status: 'sent',
    sequenceId: '3',
  };

  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it('should initialize with default state', () => {
    const state = useMessageStore.getState();
    expect(state.messagesByConversation).toEqual({});
  });

  it('should addMessage and initialize per-conversation state', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg1);

    const state = useMessageStore.getState();
    const convData = state.messagesByConversation['conv-1'];

    expect(convData).toBeDefined();
    expect(convData.messages).toEqual([sampleMsg1]);
    expect(convData.oldestLoadedMessageId).toBe('msg-1');
  });

  it('should deduplicate messages with same ID when addMessage is called', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg1);

    const updatedMsg1: ChatMessage = { ...sampleMsg1, content: 'Updated Hello' };
    useMessageStore.getState().addMessage('conv-1', updatedMsg1);

    const state = useMessageStore.getState();
    const messages = state.messagesByConversation['conv-1'].messages;

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Updated Hello');
  });

  it('should replace optimistic message when server-confirmed message arrives matching clientMessageId', () => {
    const optimisticMsg: ChatMessage = {
      id: 'temp-123',
      clientMessageId: 'client-abc',
      conversationId: 'conv-1',
      type: 'text',
      content: 'Sending...',
      sender: sampleUser,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      status: 'sending',
    };

    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const serverMsg: ChatMessage = {
      id: 'server-999',
      clientMessageId: 'client-abc',
      conversationId: 'conv-1',
      type: 'text',
      content: 'Sending...',
      sender: sampleUser,
      createdAt: new Date('2026-01-01T10:00:00Z'),
      status: 'sent',
      sequenceId: '10',
    };

    useMessageStore.getState().addMessage('conv-1', serverMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('server-999');
    expect(messages[0].status).toBe('sent');
  });

  it('should sort messages by sequenceId primary key', () => {
    const msgSeq10: ChatMessage = { ...sampleMsg1, id: 'msg-seq-10', sequenceId: '10' };
    const msgSeq5: ChatMessage = { ...sampleMsg2, id: 'msg-seq-5', sequenceId: '5' };

    useMessageStore.getState().addMessage('conv-1', msgSeq10);
    useMessageStore.getState().addMessage('conv-1', msgSeq5);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages[0].id).toBe('msg-seq-5');
    expect(messages[1].id).toBe('msg-seq-10');
  });

  it('should sort messages by createdAt if sequenceId is not available', () => {
    const earlierMsg: ChatMessage = {
      ...sampleMsg1,
      id: 'earlier',
      sequenceId: undefined,
      createdAt: new Date('2026-01-01T08:00:00Z'),
    };
    const laterMsg: ChatMessage = {
      ...sampleMsg2,
      id: 'later',
      sequenceId: undefined,
      createdAt: new Date('2026-01-01T09:00:00Z'),
    };

    useMessageStore.getState().addMessage('conv-1', laterMsg);
    useMessageStore.getState().addMessage('conv-1', earlierMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages[0].id).toBe('earlier');
    expect(messages[1].id).toBe('later');
  });

  it('should prependMessages for pagination and avoid duplicates', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg3);

    useMessageStore
      .getState()
      .prependMessages('conv-1', [sampleMsg1, sampleMsg2, sampleMsg3], true);

    const convData = useMessageStore.getState().messagesByConversation['conv-1'];
    expect(convData.messages).toHaveLength(3);
    expect(convData.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    expect(convData.hasMore).toBe(true);
    expect(convData.oldestLoadedMessageId).toBe('msg-1');
  });

  it('should setMessages replacing existing messages', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg3);
    useMessageStore.getState().setMessages('conv-1', [sampleMsg1, sampleMsg2], false);

    const convData = useMessageStore.getState().messagesByConversation['conv-1'];
    expect(convData.messages).toHaveLength(2);
    expect(convData.messages.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
    expect(convData.hasMore).toBe(false);
  });

  it('should updateMessage by id', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg1);
    useMessageStore
      .getState()
      .updateMessage('conv-1', 'msg-1', { content: 'Edited Content', status: 'read' });

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages[0].content).toBe('Edited Content');
    expect(messages[0].status).toBe('read');
  });

  it('should removeMessage by id', () => {
    useMessageStore.getState().setMessages('conv-1', [sampleMsg1, sampleMsg2]);
    useMessageStore.getState().removeMessage('conv-1', 'msg-1');

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('msg-2');
  });

  it('should handle loading, loadingMore, and hasMore state changes', () => {
    useMessageStore.getState().setLoading('conv-1', true);
    expect(useMessageStore.getState().messagesByConversation['conv-1'].loading).toBe(true);

    useMessageStore.getState().setLoadingMore('conv-1', true);
    expect(useMessageStore.getState().messagesByConversation['conv-1'].loadingMore).toBe(true);

    useMessageStore.getState().setHasMore('conv-1', false);
    expect(useMessageStore.getState().messagesByConversation['conv-1'].hasMore).toBe(false);
  });

  it('should select message store state using selectors', () => {
    useMessageStore.getState().setMessages('conv-1', [sampleMsg1, sampleMsg2, sampleMsg3]);

    const state = useMessageStore.getState();
    const messages = selectMessagesByConversation(state, 'conv-1');
    const data = selectConversationMessagesData(state, 'conv-1');
    const latest = selectLatestMessage(state, 'conv-1');

    expect(messages).toHaveLength(3);
    expect(data?.messages).toHaveLength(3);
    expect(latest?.id).toBe('msg-3');
  });

  it('should reset store state', () => {
    useMessageStore.getState().addMessage('conv-1', sampleMsg1);
    useMessageStore.getState().reset();

    expect(useMessageStore.getState()).toEqual({
      ...initialMessageState,
      addMessage: expect.any(Function),
      prependMessages: expect.any(Function),
      setMessages: expect.any(Function),
      updateMessage: expect.any(Function),
      removeMessage: expect.any(Function),
      setLoading: expect.any(Function),
      setLoadingMore: expect.any(Function),
      setHasMore: expect.any(Function),
      reset: expect.any(Function),
      trimInactiveConversations: expect.any(Function),
    });
  });

  it('should correctly compare messages with compareMessages', () => {
    expect(compareMessages(sampleMsg1, sampleMsg2)).toBeLessThan(0);
    expect(compareMessages(sampleMsg2, sampleMsg1)).toBeGreaterThan(0);
  });

  it('should deduplicate and sort messages with dedupAndSortMessages', () => {
    const result = dedupAndSortMessages([sampleMsg2], [sampleMsg1]);
    expect(result.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
  });
});
