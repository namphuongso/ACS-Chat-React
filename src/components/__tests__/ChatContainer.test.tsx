import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatContainer } from '../ChatContainer';
import { useConversations } from '../../hooks/useConversations';
import type { Conversation } from '../../types';

vi.mock('../../hooks/useConversations');

vi.mock('../../hooks/usePinnedMessages', () => ({
  usePinnedMessages: vi.fn(() => ({ loading: false })),
}));

vi.mock('../../store/messageStore', () => ({
  useMessageStore: vi.fn((selector) => selector({
    messagesByConversation: {
      'conv-1': { hasFetchedPinned: true }
    }
  })),
}));

// Mock child components to isolate ChatContainer testing
vi.mock('../ConversationList', () => ({
  ConversationList: () => <div data-testid="mock-conversation-list">Conversation List</div>,
}));

vi.mock('../Conversation', () => ({
  ConversationView: (props: {
    onOpenAttachment?: (url: string, fileName?: string) => void;
    onDownloadAttachment?: (url: string, fileName?: string) => void;
    disableInternalPreview?: boolean;
  }) => (
    <div
      data-testid="mock-conversation-view"
      data-disable-preview={props.disableInternalPreview ? 'true' : 'false'}
    >
      Conversation View
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

vi.mock('../EmptyState', () => ({
  EmptyState: ({ type }: { type: string }) => (
    <div data-testid={`mock-empty-state-${type}`}>Empty State</div>
  ),
}));

describe('ChatContainer Component', () => {
  const mockOpenConversation = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConversations).mockReturnValue({
      conversations: [],
      activeConversation: null,
      openingConversation: false,
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadConversations: vi.fn(),
      loadMore: vi.fn(),
      openConversation: mockOpenConversation,
      closeConversation: vi.fn(),
      createDirectConversation: vi.fn(),
      createGroupConversation: vi.fn(),
      updateTopic: vi.fn(),
      deleteConversation: vi.fn(),
      leaveConversation: vi.fn(),
      joinRoom: vi.fn(),
      createGroupRoom: vi.fn(),
    });
  });

  it('should render default layout with sidebar and main area', () => {
    render(<ChatContainer />);
    const container = screen.getByTestId('mock-conversation-list').parentElement?.parentElement;
    expect(container).toHaveClass('acs-chat-container');
    expect(screen.getByTestId('mock-conversation-list')).toBeInTheDocument();
  });

  it('should render empty state in main area when no active conversation', () => {
    render(<ChatContainer />);
    expect(screen.getByTestId('mock-empty-state-no-conversations')).toBeInTheDocument();
  });

  it('should render ConversationView when there is an active conversation', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      activeConversation: { id: 'conv-1' } as unknown as Conversation,
    });

    render(<ChatContainer />);
    expect(screen.getByTestId('mock-conversation-view')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-empty-state-no-conversations')).not.toBeInTheDocument();
  });

  it('should allow custom renderers', () => {
    const customList = () => <div data-testid="custom-list">Custom List</div>;
    const customMain = () => <div data-testid="custom-main">Custom Main</div>;
    const customEmpty = () => <div data-testid="custom-empty">Custom Empty</div>;

    // Test with active conversation
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      activeConversation: { id: 'conv-1' } as unknown as Conversation,
    });

    const { unmount } = render(
      <ChatContainer
        renderConversationList={customList}
        renderConversation={customMain}
        renderEmpty={customEmpty}
      />
    );
    expect(screen.getByTestId('custom-list')).toBeInTheDocument();
    expect(screen.getByTestId('custom-main')).toBeInTheDocument();

    unmount(); // Unmount to bypass React.memo bailout for the next render

    // Test with empty state
    vi.mocked(useConversations).mockReturnValue({
      conversations: [],
      activeConversation: null,
      openingConversation: false,
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadConversations: vi.fn(),
      loadMore: vi.fn(),
      openConversation: vi.fn(),
      closeConversation: vi.fn(),
      createDirectConversation: vi.fn(),
      createGroupConversation: vi.fn(),
      updateTopic: vi.fn(),
      deleteConversation: vi.fn(),
      leaveConversation: vi.fn(),
      joinRoom: vi.fn(),
      createGroupRoom: vi.fn(),
    });

    render(
      <ChatContainer
        renderConversationList={customList}
        renderConversation={customMain}
        renderEmpty={customEmpty}
      />
    );
    expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
  });

  it('should forward onOpenAttachment and onDownloadAttachment to ConversationView', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      activeConversation: { id: 'conv-1' } as unknown as Conversation,
    });

    const onOpenAttachment = vi.fn();
    const onDownloadAttachment = vi.fn();

    render(
      <ChatContainer
        onOpenAttachment={onOpenAttachment}
        onDownloadAttachment={onDownloadAttachment}
      />
    );

    fireEvent.click(screen.getByTestId('open-attach-btn'));
    expect(onOpenAttachment).toHaveBeenCalledWith('https://example.com/test.pdf', 'test.pdf');

    fireEvent.click(screen.getByTestId('download-attach-btn'));
    expect(onDownloadAttachment).toHaveBeenCalledWith('https://example.com/test.pdf', 'test.pdf');
  });

  it('should forward disableInternalPreview to ConversationView', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      activeConversation: { id: 'conv-1' } as unknown as Conversation,
    });

    render(
      <ChatContainer
        disableInternalPreview={true}
      />
    );

    const convView = screen.getByTestId('mock-conversation-view');
    expect(convView).toHaveAttribute('data-disable-preview', 'true');
  });
});

