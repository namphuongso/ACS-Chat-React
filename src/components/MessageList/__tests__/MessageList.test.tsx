import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode, ComponentType } from 'react';
import { MessageList } from '../index';
import type { ChatMessage } from '../../../types/message.types';

interface MockVirtuosoProps {
  data?: ChatMessage[];
  itemContent: (index: number, item: ChatMessage) => ReactNode;
  startReached?: () => void;
  components?: {
    Header?: ComponentType;
  };
}

// Mock Virtuoso to render normally for testing
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, startReached, components }: MockVirtuosoProps) => (
    <div data-testid="virtuoso-list">
      {components?.Header && <components.Header />}
      {data?.map((item: ChatMessage, index: number) => (
        <div key={item.id || index}>
          {itemContent(index, item)}
        </div>
      ))}
      <button onClick={startReached} data-testid="start-reached-btn">Simulate Scroll Top</button>
    </div>
  )
}));

describe('MessageList Component', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'm1',
      content: 'Hello',
      type: 'text',
      sender: { id: 'u1', displayName: 'Alice' },
      createdAt: new Date('2023-01-01T10:00:00Z'),
      sequenceId: '1',
      conversationId: 'c1',
      status: 'sent'
    },
    {
      id: 'm2',
      content: 'Hi',
      type: 'text',
      sender: { id: 'u2', displayName: 'Bob' },
      createdAt: new Date('2023-01-02T11:00:00Z'), // Different date to trigger date separator
      sequenceId: '2',
      conversationId: 'c1',
      status: 'read'
    }
  ];

  const mockLoadMore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state when loading is true and no messages', () => {
    render(
      <MessageList 
        messages={[]} 
        currentUserId="u1" 
        loading={true} 
        loadingMore={false} 
        hasMore={false} 
        onLoadMore={mockLoadMore} 
      />
    );
    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('should render messages and date separators', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={false} 
        hasMore={false} 
        onLoadMore={mockLoadMore} 
      />
    );
    
    // Check if messages render
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi')).toBeInTheDocument();
    
    // Check date separators
    expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
    expect(screen.getByText('Jan 2, 2023')).toBeInTheDocument();
  });

  it('should trigger onLoadMore when start is reached and hasMore is true', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={false} 
        hasMore={true} 
        onLoadMore={mockLoadMore} 
      />
    );
    
    fireEvent.click(screen.getByTestId('start-reached-btn'));
    expect(mockLoadMore).toHaveBeenCalled();
  });

  it('should not trigger onLoadMore when loading or loadingMore is true', () => {
    const { rerender } = render(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={true} 
        loadingMore={false} 
        hasMore={true} 
        onLoadMore={mockLoadMore} 
      />
    );
    
    fireEvent.click(screen.getByTestId('start-reached-btn'));
    expect(mockLoadMore).not.toHaveBeenCalled();

    rerender(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={true} 
        hasMore={true} 
        onLoadMore={mockLoadMore} 
      />
    );
    fireEvent.click(screen.getByTestId('start-reached-btn'));
    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  it('should render loadingMore indicator when loadingMore is true', () => {
    render(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={true} 
        hasMore={true} 
        onLoadMore={mockLoadMore} 
      />
    );
    
    expect(screen.getByText('Loading previous messages...')).toBeInTheDocument();
  });

  it('should allow custom render functions', () => {
    const customRenderMessage = (msg: ChatMessage) => <div data-testid="custom-msg">{msg.content}</div>;
    const customRenderDate = (date: Date) => <div data-testid="custom-date">{date.getFullYear()}</div>;
    const customRenderLoadingMore = () => <div data-testid="custom-loading-more">Custom Loading More</div>;

    render(
      <MessageList 
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={true} 
        hasMore={true} 
        onLoadMore={mockLoadMore} 
        renderMessage={customRenderMessage}
        renderDateSeparator={customRenderDate}
        renderLoadingMore={customRenderLoadingMore}
      />
    );

    expect(screen.getAllByTestId('custom-msg')).toHaveLength(2);
    expect(screen.getAllByTestId('custom-date')).toHaveLength(2);
    expect(screen.getByTestId('custom-loading-more')).toBeInTheDocument();
  });
});
