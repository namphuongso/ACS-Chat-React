import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChatContainer } from '../ChatContainer';
import { useConversations } from '../../hooks/useConversations';
import type { Conversation } from '../../types';

vi.mock('../../hooks/useConversations');

// Mock child components to isolate ChatContainer testing
vi.mock('../ConversationList', () => ({
  ConversationList: () => <div data-testid="mock-conversation-list">Conversation List</div>,
}));

vi.mock('../Conversation', () => ({
  ConversationView: () => <div data-testid="mock-conversation-view">Conversation View</div>,
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

  it('should auto-open the first conversation if none is active but conversations exist', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      conversations: [{ id: 'conv-1' }, { id: 'conv-2' }] as unknown as Conversation[],
      activeConversation: null,
      loading: false,
    });

    render(<ChatContainer />);

    expect(mockOpenConversation).toHaveBeenCalledWith('conv-1');
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
});
