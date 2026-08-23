import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConversationView } from '../index';
import { useConversations } from '../../../hooks/useConversations';
import { useMessages } from '../../../hooks/useMessages';
import { useChat } from '../../../hooks/useChat';

vi.mock('../../../hooks/useConversations');
vi.mock('../../../hooks/useMessages');
vi.mock('../../../hooks/useChat');
vi.mock('../../../hooks/useRoomMembers', () => ({
  useRoomMembers: () => ({
    members: [],
    loading: false,
    error: null,
    joinRoom: vi.fn().mockResolvedValue({}),
  })
}));

vi.mock('../../MessageList', () => ({
  MessageList: (props: {
    messages?: unknown[];
    onLoadMore?: () => void;
    onOpenAttachment?: (url: string, fileName?: string) => void;
    onDownloadAttachment?: (url: string, fileName?: string) => void;
  }) => (
    <div data-testid="mock-message-list">
      {props.messages?.length || 0} messages
      <button onClick={props.onLoadMore}>Load More</button>
      {props.onOpenAttachment && (
        <button
          onClick={() => props.onOpenAttachment?.('https://example.com/test.pdf', 'test.pdf')}
          data-testid="open-attach-btn"
        >
          Open
        </button>
      )}
      {props.onDownloadAttachment && (
        <button
          onClick={() => props.onDownloadAttachment?.('https://example.com/test.pdf', 'test.pdf')}
          data-testid="download-attach-btn"
        >
          Download
        </button>
      )}
    </div>
  ),
}));

vi.mock('../../MessageInput', () => ({
  MessageInput: ({ onSend, disabled }: { onSend: (msg: string) => void; disabled?: boolean }) => (
    <div data-testid="mock-message-input">
      <button disabled={disabled} onClick={() => onSend('test msg')}>chat.send</button>
    </div>
  ),
}));

describe('ConversationView Component', () => {
  const mockSendMessage = vi.fn();
  const mockLoadMore = vi.fn();
  const mockLoadMessages = vi.fn().mockResolvedValue([]);
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(useChat).mockReturnValue({
      currentUser: { id: 'u1' } as never,
      connectionState: 'connected',
    } as unknown as ReturnType<typeof useChat>);

    vi.mocked(useConversations).mockReturnValue({
      activeConversation: { id: 'conv-1', type: 'direct', otherParticipant: { displayName: 'Alice' } } as never,
      conversations: [
        { id: 'conv-1', type: 'direct', otherParticipant: { displayName: 'Alice' } },
        { id: 'conv-2', type: 'group', name: 'Dev Team' }
      ] as never,
    } as unknown as ReturnType<typeof useConversations>);

    vi.mocked(useMessages).mockReturnValue({
      messages: [{ id: 'm1' }, { id: 'm2' }] as never,
      loading: false,
      loadingMore: false,
      hasMore: true,
      hasFetched: true,
      loadMore: mockLoadMore,
      loadMessages: mockLoadMessages,
      sendMessage: mockSendMessage,
    } as unknown as ReturnType<typeof useMessages>);
  });

  it('should render select conversation message if no conversation is active or found', () => {
    vi.mocked(useConversations).mockReturnValue({
      activeConversation: null,
      conversations: [],
    } as unknown as ReturnType<typeof useConversations>);
    
    render(<ConversationView />);
    expect(screen.getByText('chat.selectConversation')).toBeInTheDocument();
  });

  it('should render header with other participant name for direct conversation', () => {
    render(<ConversationView />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render header with group name for group conversation', () => {
    render(<ConversationView conversationId="conv-2" />);
    expect(screen.getByText('Dev Team')).toBeInTheDocument();
  });

  it('should render MessageList and MessageInput', () => {
    render(<ConversationView />);
    expect(screen.getByTestId('mock-message-list')).toBeInTheDocument();
    expect(screen.getByText('2 messages')).toBeInTheDocument();
    expect(screen.getByTestId('mock-message-input')).toBeInTheDocument();
  });

  it('should call sendMessage when MessageInput triggers onSend', () => {
    render(<ConversationView />);
    fireEvent.click(screen.getByText('chat.send'));
    expect(mockSendMessage).toHaveBeenCalledWith('test msg', expect.any(Object));
  });

  it('should pass loading state to disable MessageInput', () => {
    vi.mocked(useMessages).mockReturnValue({
      ...vi.mocked(useMessages)('conv-1'),
      loading: true,
    } as unknown as ReturnType<typeof useMessages>);
    
    render(<ConversationView />);
    expect(screen.getByText('chat.send')).toBeDisabled();
  });

  it('should call loadMessages when hasFetched is false even if messages already contain a received message', () => {
    vi.mocked(useMessages).mockReturnValue({
      messages: [{ id: 'realtime-msg-1' }] as never,
      loading: false,
      loadingMore: false,
      hasMore: true,
      hasFetched: false,
      loadMore: mockLoadMore,
      loadMessages: mockLoadMessages,
      sendMessage: mockSendMessage,
    } as unknown as ReturnType<typeof useMessages>);

    render(<ConversationView conversationId="conv-1" />);
    expect(mockLoadMessages).toHaveBeenCalledTimes(1);
  });

  it('should forward onOpenAttachment and onDownloadAttachment to MessageList', () => {
    const onOpenAttachment = vi.fn();
    const onDownloadAttachment = vi.fn();

    render(
      <ConversationView
        onOpenAttachment={onOpenAttachment}
        onDownloadAttachment={onDownloadAttachment}
      />
    );

    fireEvent.click(screen.getByTestId('open-attach-btn'));
    expect(onOpenAttachment).toHaveBeenCalledWith('https://example.com/test.pdf', 'test.pdf');

    fireEvent.click(screen.getByTestId('download-attach-btn'));
    expect(onDownloadAttachment).toHaveBeenCalledWith('https://example.com/test.pdf', 'test.pdf');
  });
});
