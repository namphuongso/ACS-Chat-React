import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationItem } from '../index';
import type { Conversation } from '../../../types';

describe('ConversationItem Component', () => {
  const directConversation: Conversation = {
    id: 'c1',
    type: 'direct',
    otherParticipant: { id: 'u1', displayName: 'Alice' },
    lastMessage: {
      id: 'm1',
      content: 'Hello there',
      type: 'text',
      sender: { id: 'u1', displayName: 'Alice' },
      createdAt: new Date('2023-01-01T10:00:00Z'),
      sequenceId: '1',
      conversationId: 'c1',
      status: 'sent',
    },
    unreadCount: 2,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z'),
    participants: [],
    name: 'Alice',
  };

  const groupConversation: Conversation = {
    id: 'c2',
    type: 'group',
    name: 'Dev Team',
    participants: [],
    unreadCount: 0,
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-01-01T10:00:00Z'),
  };

  it('should render direct conversation correctly', () => {
    render(
      <ConversationItem conversation={directConversation} isActive={false} onClick={vi.fn()} />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('You: Hello there')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Unread count badge
  });

  it('should render group conversation correctly', () => {
    render(
      <ConversationItem conversation={groupConversation} isActive={false} onClick={vi.fn()} />
    );
    expect(screen.getByText('Dev Team')).toBeInTheDocument();
  });

  it('should handle missing display name for direct conversation', () => {
    const unnamedDirect: Conversation = {
      ...directConversation,
      otherParticipant: { id: 'u2' },
    };
    render(<ConversationItem conversation={unnamedDirect} isActive={false} onClick={vi.fn()} />);
    expect(screen.getByText('u2')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const mockClick = vi.fn();
    render(
      <ConversationItem conversation={directConversation} onClick={mockClick} isActive={false} />
    );

    fireEvent.click(screen.getByText('Alice'));
    expect(mockClick).toHaveBeenCalledTimes(1);
  });

  it('should apply active class when isActive is true', () => {
    const { container } = render(
      <ConversationItem conversation={directConversation} isActive={true} onClick={vi.fn()} />
    );
    expect(container.firstChild).toHaveClass(/active/);
  });
});
