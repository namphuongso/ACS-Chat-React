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

  it('should replace optimistic message when server push event arrives without clientMessageId', () => {
    const optimisticMsg: ChatMessage = {
      id: 'temp-1787195186393',
      clientMessageId: '1787195186393',
      conversationId: 'conv-1',
      type: 'text',
      content: 'eee',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sending',
    };

    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const wsPushMsg: ChatMessage = {
      id: '1787195186393',
      conversationId: 'conv-1',
      type: 'text',
      content: 'eee',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sent',
    };

    useMessageStore.getState().addMessage('conv-1', wsPushMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('1787195186393');
    expect(messages[0].status).toBe('sent');
  });

  it('should replace optimistic message even when optimistic has ACS CUI and server push has backend GUID with same displayName', async () => {
    const { useChatStore } = await import('../../store/chatStore');
    useChatStore.getState().setCurrentUser({
      id: '8:acs:99738cf7-21a4-4f0f-8f81-8b984534f3ca_0000002b',
      displayName: 'Hà Anh Thảo 2',
    });

    const optimisticMsg: ChatMessage = {
      id: 'temp-xyz-123',
      clientMessageId: 'xyz-123',
      conversationId: 'conv-1',
      type: 'text',
      content: '<div>eee</div>',
      sender: {
        id: '8:acs:99738cf7-21a4-4f0f-8f81-8b984534f3ca_0000002b',
        displayName: 'Hà Anh Thảo 2',
      },
      senderDisplayName: 'Hà Anh Thảo 2',
      createdAt: new Date(),
      status: 'sending',
    };

    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    // WebSocket push payload from backend with GUID as sender id
    const wsPushMsg: ChatMessage = {
      id: '1787195186393',
      conversationId: 'conv-1',
      type: 'html',
      content: 'eee',
      sender: {
        id: '2a53536f-a1a4-4e87-9586-86f14537ed6b',
        displayName: 'Hà Anh Thảo 2',
      },
      senderDisplayName: 'Hà Anh Thảo 2',
      createdAt: new Date(),
      status: 'sent',
    };

    useMessageStore.getState().addMessage('conv-1', wsPushMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('1787195186393');
    expect(messages[0].status).toBe('sent');
  });

  it('should not drop optimistic message when only an older confirmed message with same content exists (re-send case)', () => {
    const olderConfirmed: ChatMessage = {
      ...sampleMsg1,
      id: 'server-old',
      content: 'hello',
      createdAt: new Date(Date.now() - 55_000),
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', olderConfirmed);

    const optimisticMsg: ChatMessage = {
      id: 'temp-12345',
      clientMessageId: '12345',
      conversationId: 'conv-1',
      type: 'text',
      content: 'hello',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sending',
    };
    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.id === 'temp-12345')).toBe(true);
  });

  it('should not treat confirmed and optimistic messages with different clientMessageId as duplicates', () => {
    const confirmedFromPush: ChatMessage = {
      ...sampleMsg1,
      id: 'server-777',
      clientMessageId: 'cm-777',
      content: 'dup',
      createdAt: new Date(Date.now() - 10_000),
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', confirmedFromPush);

    const optimisticMsg: ChatMessage = {
      ...sampleMsg1,
      id: 'temp-888',
      clientMessageId: 'cm-888',
      content: 'dup',
      createdAt: new Date(Date.now() - 5_000),
      status: 'sending',
    };
    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.id === 'temp-888')).toBe(true);
  });

  it('should replace optimistic message with its own confirmation even when an older identical confirmed message exists', () => {
    const olderConfirmed: ChatMessage = {
      ...sampleMsg1,
      id: 'server-old',
      content: 'hi',
      createdAt: new Date(Date.now() - 55_000),
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', olderConfirmed);

    const optimisticMsg: ChatMessage = {
      id: 'temp-999',
      clientMessageId: '999',
      conversationId: 'conv-1',
      type: 'text',
      content: 'hi',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sending',
    };
    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const confirmation: ChatMessage = {
      id: 'server-new',
      conversationId: 'conv-1',
      type: 'text',
      content: 'hi',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', confirmation);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(2);
    expect(messages.some((m) => m.id === 'temp-999')).toBe(false);
    expect(messages.some((m) => m.id === 'server-new')).toBe(true);
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
      setContinuationToken: expect.any(Function),
      setHasFetched: expect.any(Function),
      setPinnedMessages: expect.any(Function),
      addPinnedMessage: expect.any(Function),
      removePinnedMessage: expect.any(Function),
      setLoadingPinned: expect.any(Function),
      setHasFetchedPinned: expect.any(Function),
      jumpToMessage: expect.any(Function),
      setHighlightedMessageId: expect.any(Function),
      clearJumpTarget: expect.any(Function),
      reset: expect.any(Function),
      trimInactiveConversations: expect.any(Function),
    });
  });

  it('should only addPinnedMessage and removePinnedMessage if pinned messages have been fetched/cached', () => {
    const pinnedMsg = {
      messageId: 'msg-1',
      type: 'text',
      content: 'Pinned 1',
      createdDate: '2026-01-01T10:00:00Z',
      creator: 'Alice',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    };

    // 1. When hasFetchedPinned is false/absent, addPinnedMessage should NOT modify state
    useMessageStore.getState().addPinnedMessage('conv-1', pinnedMsg);
    expect(useMessageStore.getState().messagesByConversation['conv-1']?.pinnedMessages).toBeUndefined();

    // 2. When hasFetchedPinned is true, addPinnedMessage should add the message
    useMessageStore.getState().setHasFetchedPinned('conv-1', true);
    useMessageStore.getState().addPinnedMessage('conv-1', pinnedMsg);
    expect(useMessageStore.getState().messagesByConversation['conv-1']?.pinnedMessages).toEqual([pinnedMsg]);

    // 3. Deduplicate when adding same pinned message again
    useMessageStore.getState().addPinnedMessage('conv-1', pinnedMsg);
    expect(useMessageStore.getState().messagesByConversation['conv-1']?.pinnedMessages).toHaveLength(1);

    // 4. removePinnedMessage should remove the pinned message
    useMessageStore.getState().removePinnedMessage('conv-1', 'msg-1');
    expect(useMessageStore.getState().messagesByConversation['conv-1']?.pinnedMessages).toEqual([]);
  });

  it('should setHasFetched correctly', () => {
    useMessageStore.getState().setHasFetched('conv-1', true);
    expect(useMessageStore.getState().messagesByConversation['conv-1'].hasFetched).toBe(true);

    useMessageStore.getState().setHasFetched('conv-1', false);
    expect(useMessageStore.getState().messagesByConversation['conv-1'].hasFetched).toBe(false);
  });

  it('should correctly compare messages with compareMessages', () => {
    expect(compareMessages(sampleMsg1, sampleMsg2)).toBeLessThan(0);
    expect(compareMessages(sampleMsg2, sampleMsg1)).toBeGreaterThan(0);
  });

  it('should deduplicate and sort messages with dedupAndSortMessages', () => {
    const result = dedupAndSortMessages([sampleMsg2], [sampleMsg1]);
    expect(result.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('should addMessage to both threadId and roomId aliases when conversation exists in conversationStore', async () => {
    const { useConversationStore } = await import('../../store/conversationStore');
    useConversationStore.getState().setConversations([
      {
        id: '19:cfc0c058@thread.v2',
        conversationId: 'f220f5e0-a950-45fd-b011-130ac2cca639',
        type: 'group',
        name: 'Backend Room',
        createdAt: new Date('2026-01-01'),
        unreadCount: 0,
        participants: [{ id: 'user-1', displayName: 'Alice' }],
      },
    ]);

    const msg: ChatMessage = {
      id: '1787195186393',
      conversationId: 'f220f5e0-a950-45fd-b011-130ac2cca639',
      type: 'text',
      content: '777',
      sender: sampleUser,
      createdAt: new Date('2026-08-20T03:06:26.490Z'),
      status: 'sent',
    };

    useMessageStore.getState().addMessage('f220f5e0-a950-45fd-b011-130ac2cca639', msg);

    const state = useMessageStore.getState();
    expect(state.messagesByConversation['f220f5e0-a950-45fd-b011-130ac2cca639']?.messages).toHaveLength(1);
    expect(state.messagesByConversation['19:cfc0c058@thread.v2']?.messages).toHaveLength(1);
    expect(state.messagesByConversation['19:cfc0c058@thread.v2']?.messages[0].content).toBe('777');
  });

  it('should handle jumpToMessage, setHighlightedMessageId and clearJumpTarget', () => {
    useMessageStore.getState().jumpToMessage('msg-123', 'conv-1', 3000);
    const state = useMessageStore.getState();
    expect(state.jumpTarget).toBeDefined();
    expect(state.jumpTarget?.messageId).toBe('msg-123');
    expect(state.jumpTarget?.conversationId).toBe('conv-1');
    expect(state.jumpTarget?.highlightDuration).toBe(3000);
    expect(typeof state.jumpTarget?.timestamp).toBe('number');

    useMessageStore.getState().setHighlightedMessageId('msg-123');
    expect(useMessageStore.getState().highlightedMessageId).toBe('msg-123');

    useMessageStore.getState().setHighlightedMessageId(null);
    expect(useMessageStore.getState().highlightedMessageId).toBeNull();

    useMessageStore.getState().clearJumpTarget();
    expect(useMessageStore.getState().jumpTarget).toBeNull();
  });

  it('should not drop optimistic message sent 10s after an identical confirmed message', () => {
    // 1. First message was sent and confirmed 10 seconds ago
    const confirmedMsg1: ChatMessage = {
      id: 'server-msg-1',
      conversationId: 'conv-1',
      type: 'text',
      content: 'hello',
      sender: sampleUser,
      createdAt: new Date(Date.now() - 10_000),
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', confirmedMsg1);

    // 2. User sends identical message 10s later
    const optimisticMsg2: ChatMessage = {
      id: 'temp-client-2',
      clientMessageId: 'client-2',
      conversationId: 'conv-1',
      type: 'text',
      content: 'hello',
      sender: sampleUser,
      createdAt: new Date(),
      status: 'sending',
    };
    useMessageStore.getState().addMessage('conv-1', optimisticMsg2);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(2);
    expect(messages[0].id).toBe('server-msg-1');
    expect(messages[1].id).toBe('temp-client-2');
  });

  it('should replace optimistic message when server confirmation has clock skew of 45 seconds', () => {
    const optimisticTime = new Date('2026-08-20T12:00:45.000Z');
    const serverConfirmedTime = new Date('2026-08-20T12:00:00.000Z'); // 45s earlier due to clock skew

    const optimisticMsg: ChatMessage = {
      id: 'temp-skew-1',
      conversationId: 'conv-1',
      type: 'text',
      content: 'clock skew test',
      sender: sampleUser,
      createdAt: optimisticTime,
      status: 'sending',
    };
    useMessageStore.getState().addMessage('conv-1', optimisticMsg);

    const serverConfirmation: ChatMessage = {
      id: 'server-skew-1',
      conversationId: 'conv-1',
      type: 'text',
      content: 'clock skew test',
      sender: sampleUser,
      createdAt: serverConfirmedTime,
      status: 'sent',
    };
    useMessageStore.getState().addMessage('conv-1', serverConfirmation);

    const messages = useMessageStore.getState().messagesByConversation['conv-1'].messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe('server-skew-1');
  });
});
