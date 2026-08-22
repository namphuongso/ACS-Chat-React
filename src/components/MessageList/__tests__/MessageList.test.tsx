import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode, ComponentType } from 'react';
import { MessageList } from '../index';
import type { ChatMessage } from '../../../types/message.types';
import { useMessageStore } from '../../../store/messageStore';

import React from 'react';

interface MockVirtuosoProps {
  data?: ChatMessage[];
  firstItemIndex?: number;
  followOutput?: ((isAtBottom: boolean) => 'auto' | 'smooth' | boolean) | boolean;
  itemContent: (index: number, item: ChatMessage) => ReactNode;
  startReached?: () => void;
  components?: {
    Header?: ComponentType;
  };
}

const { mockScrollToIndex, capturedVirtuosoProps } = vi.hoisted(() => ({
  mockScrollToIndex: vi.fn(),
  capturedVirtuosoProps: { current: {} as Partial<MockVirtuosoProps> },
}));

// Mock Virtuoso to render normally for testing with ref support
vi.mock('react-virtuoso', async () => {
  const React = await import('react');
  return {
    Virtuoso: React.forwardRef(
      (props: MockVirtuosoProps, ref: unknown) => {
        capturedVirtuosoProps.current = props;
        const { data, itemContent, startReached, components } = props;

        React.useImperativeHandle(ref as React.Ref<unknown>, () => ({
          scrollToIndex: mockScrollToIndex,
          scrollIntoView: vi.fn(),
          scrollTo: vi.fn(),
          scrollBy: vi.fn(),
          autoscrollToBottom: vi.fn(),
          getState: vi.fn(),
        }));

        return (
          <div data-testid="virtuoso-list">
            {components?.Header && <components.Header />}
            {data?.map((item: ChatMessage, index: number) => (
              <div key={item.id || index}>{itemContent(index, item)}</div>
            ))}
            <button onClick={startReached} data-testid="start-reached-btn">
              Simulate Scroll Top
            </button>
          </div>
        );
      }
    ),
  };
});

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
    useMessageStore.getState().reset();
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
    expect(screen.getByText('chat.loading')).toBeInTheDocument();
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
    expect(screen.getByText('01/01/2023')).toBeInTheDocument();
    expect(screen.getByText('02/01/2023')).toBeInTheDocument();
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

  it('should scroll to message and trigger highlight when jumpTarget is set in messageStore', async () => {
    const { useMessageStore } = await import('../../../store/messageStore');
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

    act(() => {
      useMessageStore.getState().jumpToMessage('m2');
    });

    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        align: 'center',
      })
    );
    expect(useMessageStore.getState().highlightedMessageId).toBe('m2');
  });

  it('should expose imperative handle methods via ref', async () => {
    const ref = React.createRef<{
      scrollToMessage: (id: string) => Promise<boolean>;
      scrollToIndex: (index: number) => void;
      scrollToBottom: () => void;
      highlightMessage: (id: string) => void;
    }>();

    render(
      <MessageList 
        ref={ref}
        messages={mockMessages} 
        currentUserId="u1" 
        loading={false} 
        loadingMore={false} 
        hasMore={false} 
        onLoadMore={mockLoadMore} 
      />
    );

    expect(ref.current).toBeDefined();
    await act(async () => {
      await ref.current?.scrollToMessage('m1');
    });
    expect(mockScrollToIndex).toHaveBeenCalled();
  });

  it('should pass correct 0-based data index to scrollToIndex', async () => {
    const ref = React.createRef<{
      scrollToMessage: (id: string) => Promise<boolean>;
      scrollToIndex: (index: number) => void;
      scrollToBottom: () => void;
      highlightMessage: (id: string) => void;
    }>();

    render(
      <MessageList
        ref={ref}
        messages={mockMessages}
        currentUserId="u1"
        loading={false}
        loadingMore={false}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    );

    // items = [date-sep, m1, date-sep, m2]
    act(() => {
      ref.current?.scrollToIndex(0);
    });
    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({ index: 0 })
    );

    mockScrollToIndex.mockClear();
    act(() => {
      ref.current?.scrollToBottom();
    });
    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({ index: 4 - 1 })
    );

    mockScrollToIndex.mockClear();
    await act(async () => {
      await ref.current?.scrollToMessage('m1');
    });
    expect(mockScrollToIndex).toHaveBeenCalledWith(
      expect.objectContaining({ index: 1 })
    );
  });

  it('should ignore jumpTarget targeting another conversation', async () => {
    mockScrollToIndex.mockClear();

    render(
      <MessageList
        conversationId="conv-active"
        messages={[mockMessages[0]]}
        currentUserId="user-1"
        loading={false}
        loadingMore={false}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    );

    mockScrollToIndex.mockClear();

    // Trigger a jump target intended for a DIFFERENT conversation
    act(() => {
      useMessageStore.getState().jumpToMessage('msg-foreign', 'conv-other', 1000);
    });

    expect(mockScrollToIndex).not.toHaveBeenCalled();
    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  it('should decrease firstItemIndex and not auto-scroll to bottom when older messages are prepended', () => {
    // Initial render with m2 where sender is current user (u1)
    const initialMessages: ChatMessage[] = [
      {
        id: 'm2',
        content: 'Hi from me',
        type: 'text',
        sender: { id: 'u1', displayName: 'Alice' },
        createdAt: new Date('2023-01-02T11:00:00Z'),
        sequenceId: '2',
        conversationId: 'c1',
        status: 'sent',
      },
    ];

    const { rerender } = render(
      <MessageList
        conversationId="c1"
        messages={initialMessages}
        currentUserId="u1"
        loading={false}
        loadingMore={false}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    );

    const initialFirstItemIndex = capturedVirtuosoProps.current.firstItemIndex;
    expect(initialFirstItemIndex).toBe(1000000);

    // Prepend older message m1 (same date or earlier date)
    const olderMessage: ChatMessage = {
      id: 'm1',
      content: 'Older message',
      type: 'text',
      sender: { id: 'u2', displayName: 'Bob' },
      createdAt: new Date('2023-01-01T10:00:00Z'),
      sequenceId: '1',
      conversationId: 'c1',
      status: 'sent',
    };

    rerender(
      <MessageList
        conversationId="c1"
        messages={[olderMessage, ...initialMessages]}
        currentUserId="u1"
        loading={false}
        loadingMore={false}
        hasMore={true}
        onLoadMore={mockLoadMore}
      />
    );

    // firstItemIndex should decrease because items were prepended
    expect(capturedVirtuosoProps.current.firstItemIndex).toBeLessThan(1000000);

    // followOutput should return false when not at bottom, even though the last message was sent by u1
    const followOutput = capturedVirtuosoProps.current.followOutput as (isAtBottom: boolean) => unknown;
    expect(typeof followOutput).toBe('function');
    expect(followOutput(false)).toBe(false);
  });

  it('should auto-scroll to bottom when a new own message is appended', () => {
    const initialMessages: ChatMessage[] = [
      {
        id: 'm1',
        content: 'Hello',
        type: 'text',
        sender: { id: 'u2', displayName: 'Bob' },
        createdAt: new Date('2023-01-01T10:00:00Z'),
        sequenceId: '1',
        conversationId: 'c1',
        status: 'sent',
      },
    ];

    const { rerender } = render(
      <MessageList
        conversationId="c1"
        messages={initialMessages}
        currentUserId="u1"
        loading={false}
        loadingMore={false}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    );

    // User sends a new message appended at bottom
    const newOwnMessage: ChatMessage = {
      id: 'temp-123',
      content: 'My new message',
      type: 'text',
      sender: { id: 'u1', displayName: 'Alice' },
      createdAt: new Date('2023-01-01T10:05:00Z'),
      conversationId: 'c1',
      status: 'sending',
    };

    rerender(
      <MessageList
        conversationId="c1"
        messages={[...initialMessages, newOwnMessage]}
        currentUserId="u1"
        loading={false}
        loadingMore={false}
        hasMore={false}
        onLoadMore={mockLoadMore}
      />
    );

    const followOutput = capturedVirtuosoProps.current.followOutput as (isAtBottom: boolean) => unknown;
    expect(typeof followOutput).toBe('function');
    // For own new message appended at bottom, it should return 'auto'
    expect(followOutput(false)).toBe('auto');
  });
});
