import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ConversationList } from '../index';
import { useConversations } from '../../../hooks/useConversations';
import type { ConversationItemProps } from '../ConversationItem';
import type { SearchInputProps } from '../../SearchInput';
import type { Conversation } from '../../../types';

vi.mock('../../../hooks/useConversations');

vi.mock('../ConversationItem', () => ({
  ConversationItem: ({ conversation, onClick, isActive }: ConversationItemProps) => (
    <div data-testid="mock-conversation-item" data-active={isActive} onClick={onClick}>
      {conversation.type === 'group'
        ? conversation.name
        : conversation.otherParticipant?.displayName}
    </div>
  ),
}));

vi.mock('../../SearchInput', () => ({
  SearchInput: ({ onChange, value }: SearchInputProps) => (
    <input
      data-testid="mock-search-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../../EmptyState', () => ({
  EmptyState: () => <div data-testid="mock-empty-state">Empty State</div>,
}));

describe('ConversationList Component', () => {
  const mockConversations = [
    { id: '1', type: 'direct', otherParticipant: { id: 'u1', displayName: 'Alice' } },
    { id: '2', type: 'group', name: 'Dev Team' },
  ];

  const mockOpenConversation = vi.fn();
  const mockLoadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConversations).mockReturnValue({
      conversations: mockConversations as unknown as Conversation[],
      activeConversation: null,
      loading: false,
      loadingMore: false,
      hasMore: false,
      error: null,
      loadConversations: vi.fn(),
      loadMore: mockLoadMore,
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

  it('should render a list of conversations from store if props are not provided', () => {
    render(<ConversationList />);
    const items = screen.getAllByTestId('mock-conversation-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Dev Team')).toBeInTheDocument();
  });

  it('should use provided conversations and onSelect props', () => {
    const customConversations = [
      { id: '3', type: 'group', name: 'Custom Group' },
    ] as unknown as Conversation[];
    const customSelect = vi.fn();

    render(<ConversationList conversations={customConversations} onSelect={customSelect} />);
    const items = screen.getAllByTestId('mock-conversation-item');

    expect(items).toHaveLength(1);
    expect(screen.getByText('Custom Group')).toBeInTheDocument();

    fireEvent.click(items[0]);
    expect(customSelect).toHaveBeenCalledWith('3');
    expect(mockOpenConversation).not.toHaveBeenCalled();
  });

  it('should call openConversation from store when item is clicked and no onSelect prop is provided', () => {
    render(<ConversationList />);
    const items = screen.getAllByTestId('mock-conversation-item');
    fireEvent.click(items[0]);
    expect(mockOpenConversation).toHaveBeenCalledWith('1');
  });

  it('should highlight the active conversation', () => {
    render(<ConversationList activeId="2" />);
    const items = screen.getAllByTestId('mock-conversation-item');
    expect(items[0]).toHaveAttribute('data-active', 'false');
    expect(items[1]).toHaveAttribute('data-active', 'true');
  });

  it('should filter conversations based on search input', () => {
    render(<ConversationList />);
    const searchInput = screen.getByTestId('mock-search-input');

    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getAllByTestId('mock-conversation-item')).toHaveLength(1);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Dev Team')).not.toBeInTheDocument();
  });

  it('should render empty state if no conversations exist', () => {
    vi.mocked(useConversations).mockReturnValue({
      ...vi.mocked(useConversations)(),
      conversations: [],
    });
    render(<ConversationList />);
    expect(screen.getByTestId('mock-empty-state')).toBeInTheDocument();
  });

  it('should render loading indicator when loading is true', () => {
    render(<ConversationList loading={true} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should allow custom renderItem', () => {
    const customRenderItem = (conv: Conversation) => <div data-testid="custom-item">{conv.id}</div>;
    render(<ConversationList renderItem={customRenderItem} />);

    expect(screen.getAllByTestId('custom-item')).toHaveLength(2);
    expect(screen.queryByTestId('mock-conversation-item')).not.toBeInTheDocument();
  });
});
