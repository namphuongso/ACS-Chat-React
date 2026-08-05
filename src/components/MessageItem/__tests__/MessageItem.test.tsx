import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageItem } from '../index';
import type { ChatMessage } from '../../../types/message.types';

describe('MessageItem Component', () => {
  const baseMessage: ChatMessage = {
    id: 'm1',
    content: 'Hello World',
    type: 'text',
    sender: { id: 'u1', displayName: 'Alice' },
    createdAt: new Date('2023-01-01T10:00:00Z'),
    sequenceId: '1',
    conversationId: 'c1',
    status: 'delivered',
  };

  it('should render system message', () => {
    const sysMessage: ChatMessage = {
      ...baseMessage,
      type: 'system',
      systemEvent: {
        type: 'topicUpdated',
        initiator: { id: 'u1', displayName: 'System' },
        newTopic: 'General',
      },
    };
    render(<MessageItem message={sysMessage} isOwn={false} />);
    expect(screen.getByText('System changed topic to "General"')).toBeInTheDocument();
  });

  it('should render own message correctly', () => {
    render(<MessageItem message={baseMessage} isOwn={true} />);

    // Content check
    expect(screen.getByText('Hello World')).toBeInTheDocument();

    // Status should be visible for own messages
    expect(screen.getByText('delivered')).toBeInTheDocument();

    // Avatar should not be visible
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('should render other message correctly with sender avatar and name if showSender is true', () => {
    render(<MessageItem message={baseMessage} isOwn={false} showSender={true} />);

    // Avatar fallback 'A' for Alice
    expect(screen.getByText('A')).toBeInTheDocument();

    // Sender name check
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render HTML message securely', () => {
    const htmlMessage: ChatMessage = {
      ...baseMessage,
      type: 'html',
      content: '<strong>Bold Text</strong>',
    };
    const { container } = render(<MessageItem message={htmlMessage} isOwn={true} />);
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(screen.getByText('Bold Text')).toBeInTheDocument();
  });

  it('should show (edited) if message was edited', () => {
    const editedMessage: ChatMessage = {
      ...baseMessage,
      editedAt: new Date('2023-01-01T10:05:00Z'),
    };
    render(<MessageItem message={editedMessage} isOwn={true} />);
    expect(screen.getByText('(edited)')).toBeInTheDocument();
  });

  it('should handle dropdown actions', () => {
    const onReply = vi.fn();
    const onCopy = vi.fn();

    render(<MessageItem message={baseMessage} isOwn={true} onReply={onReply} onCopy={onCopy} />);

    // Directly visible actions
    const replyBtn = screen.getByTitle('Reply');
    fireEvent.click(replyBtn);
    expect(onReply).toHaveBeenCalledWith('m1');

    // Open dropdown
    const moreBtn = screen.getByTitle('More Options');
    fireEvent.click(moreBtn);

    // Click dropdown item
    const copyBtn = screen.getByText(/Copy text/i);
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledWith('m1');

    // Dropdown should be closed now (checking if copyBtn is removed)
    expect(screen.queryByText(/Copy text/i)).not.toBeInTheDocument();
  });

  it('should allow custom renderers', () => {
    render(
      <MessageItem
        message={baseMessage}
        isOwn={true}
        renderContent={(msg) => <div data-testid="custom-content">{msg.content}</div>}
        renderStatus={(status) => <div data-testid="custom-status">{status}</div>}
        renderActions={() => <div data-testid="custom-actions">Actions</div>}
      />
    );

    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByTestId('custom-status')).toBeInTheDocument();
    expect(screen.getByTestId('custom-actions')).toBeInTheDocument();
  });
});
