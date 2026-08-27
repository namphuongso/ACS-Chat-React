import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PinnedMessageBanner } from '../PinnedMessageBanner';
import { usePinnedMessages } from '../../../hooks/usePinnedMessages';
import { useMessageStore } from '../../../store/messageStore';
import type { PinnedMessage } from '../../../types/message.types';

vi.mock('../../../hooks/usePinnedMessages');

describe('PinnedMessageBanner Component', () => {
  const mockUnpinMessage = vi.fn();
  const mockJumpToMessage = vi.fn();

  const mockPinnedMessages: PinnedMessage[] = [
    {
      messageId: 'pin-1',
      type: 'text',
      content: 'Important Announcement',
      createdDate: '2026-01-01T10:00:00Z',
      creator: 'Alice',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    },
    {
      messageId: 'pin-2',
      type: 'text',
      content: 'Second Announcement',
      createdDate: '2026-01-02T10:00:00Z',
      creator: 'Bob',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useMessageStore.getState().reset();

    vi.mocked(usePinnedMessages).mockReturnValue({
      pinnedMessages: mockPinnedMessages,
      setPinnedMessages: vi.fn(),
      loading: false,
      error: null,
      loadPinnedMessages: vi.fn(),
    });
  });

  it('should render nothing if pinnedMessages is empty', () => {
    vi.mocked(usePinnedMessages).mockReturnValue({
      pinnedMessages: [],
      setPinnedMessages: vi.fn(),
      loading: false,
      error: null,
      loadPinnedMessages: vi.fn(),
    });

    const { container } = render(
      <PinnedMessageBanner
        conversationId="conv-1"
        onUnpinMessage={mockUnpinMessage}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render the first pinned message content', () => {
    render(
      <PinnedMessageBanner
        conversationId="conv-1"
        onUnpinMessage={mockUnpinMessage}
      />
    );

    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByText('Important Announcement')).toBeInTheDocument();
  });

  it('should call onJumpToMessage when banner leftSection is clicked', async () => {
    render(
      <PinnedMessageBanner
        conversationId="conv-1"
        onUnpinMessage={mockUnpinMessage}
        onJumpToMessage={mockJumpToMessage}
      />
    );

    const messageText = screen.getByText('Important Announcement');
    await act(async () => {
      fireEvent.click(messageText);
    });

    expect(mockJumpToMessage).toHaveBeenCalledWith('pin-1');
  });

  it('should trigger store jumpToMessage if onJumpToMessage is not provided', async () => {
    render(
      <PinnedMessageBanner
        conversationId="conv-1"
        onUnpinMessage={mockUnpinMessage}
      />
    );

    const messageText = screen.getByText('Important Announcement');
    await act(async () => {
      fireEvent.click(messageText);
    });

    const state = useMessageStore.getState();
    expect(state.jumpTarget?.messageId).toBe('pin-1');
    expect(state.jumpTarget?.conversationId).toBe('conv-1');
  });

  it('should open pinboard overlay and jump to message when pinboard item is clicked', () => {
    render(
      <PinnedMessageBanner
        conversationId="conv-1"
        onUnpinMessage={mockUnpinMessage}
        onJumpToMessage={mockJumpToMessage}
      />
    );

    // Open pinboard overlay
    const countButton = screen.getByText(/chat\.pinCount/);
    fireEvent.click(countButton);

    // Check second announcement in pinboard list
    const secondItem = screen.getByText('Second Announcement');
    expect(secondItem).toBeInTheDocument();

    fireEvent.click(secondItem);
    expect(mockJumpToMessage).toHaveBeenCalledWith('pin-2');
  });
});
