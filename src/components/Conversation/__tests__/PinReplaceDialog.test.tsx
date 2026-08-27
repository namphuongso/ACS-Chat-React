import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PinReplaceDialog } from '../PinReplaceDialog';
import type { PinnedMessage } from '../../../types/message.types';

const mockPinnedMessages: PinnedMessage[] = [
  {
    messageId: 'msg-1',
    type: 'file',
    content: 'SURVEY.xlsx',
    creator: 'Hà Anh Thảo',
    createdDate: '2026-08-26T10:00:00Z',
    attachmentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    attachmentUrl: 'https://example.com/SURVEY.xlsx',
    thumbUrl: '',
  },
  {
    messageId: 'msg-2',
    type: 'text',
    content: '1',
    creator: 'Hà Anh Thảo',
    createdDate: '2026-08-26T09:00:00Z',
    attachmentType: '',
    attachmentUrl: '',
    thumbUrl: '',
  },
  {
    messageId: 'msg-3',
    type: 'text',
    content: '3',
    creator: 'Hà Anh Thảo',
    createdDate: '2026-08-26T08:00:00Z',
    attachmentType: '',
    attachmentUrl: '',
    thumbUrl: '',
  },
];

describe('PinReplaceDialog Component', () => {
  const mockOnReplace = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    const { container } = render(
      <PinReplaceDialog
        isOpen={false}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render default mode with the oldest pinned message and active Update button', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Title
    expect(screen.getByText('chat.updatePinList')).toBeInTheDocument();

    // Default mode description
    expect(screen.getByText('chat.pinLimitExceededDesc')).toBeInTheDocument();

    // Oldest message is msg-3 (content '3')
    expect(screen.getByText('3')).toBeInTheDocument();

    // Change button
    expect(screen.getByText('chat.change')).toBeInTheDocument();

    // Update button is enabled
    const updateBtn = screen.getByRole('button', { name: 'chat.update' });
    expect(updateBtn).not.toBeDisabled();

    // Clicking update replaces the oldest message (msg-3)
    fireEvent.click(updateBtn);
    expect(mockOnReplace).toHaveBeenCalledWith('msg-3');
  });

  it('should call onCancel when clicking Cancel button or close X button', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Click Cancel
    fireEvent.click(screen.getByRole('button', { name: 'chat.cancel' }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);

    // Click Close (X)
    const closeBtn = screen.getByRole('button', { name: 'chat.close' });
    fireEvent.click(closeBtn);
    expect(mockOnCancel).toHaveBeenCalledTimes(2);
  });

  it('should transition to select mode when clicking Change', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Click Change
    fireEvent.click(screen.getByRole('button', { name: 'chat.change' }));

    // Select mode description
    expect(screen.getByText('chat.pinLimitSelectDesc')).toBeInTheDocument();

    // All 3 messages should be visible
    expect(screen.getByText(/SURVEY\.xlsx/)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    // Update button should be disabled initially in select mode
    const updateBtn = screen.getByRole('button', { name: 'chat.update' });
    expect(updateBtn).toBeDisabled();
  });

  it('should allow selecting a message in select mode and replace it on Update', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    // Click Change
    fireEvent.click(screen.getByRole('button', { name: 'chat.change' }));

    const updateBtn = screen.getByRole('button', { name: 'chat.update' });
    expect(updateBtn).toBeDisabled();

    // Select the first message (SURVEY.xlsx / msg-1)
    const fileItem = screen.getByText(/SURVEY\.xlsx/).closest('[role="radio"]')!;
    fireEvent.click(fileItem);

    // Update button is now enabled
    expect(updateBtn).not.toBeDisabled();

    // Click Update
    fireEvent.click(updateBtn);
    expect(mockOnReplace).toHaveBeenCalledWith('msg-1');
  });

  it('should handle keyboard selection in select mode (Enter / Space)', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'chat.change' }));

    const item2 = screen.getByText('1').closest('[role="radio"]')!;
    fireEvent.keyDown(item2, { key: 'Enter' });

    const updateBtn = screen.getByRole('button', { name: 'chat.update' });
    expect(updateBtn).not.toBeDisabled();

    fireEvent.click(updateBtn);
    expect(mockOnReplace).toHaveBeenCalledWith('msg-2');
  });

  it('should render file document icon and text format for file attachments', () => {
    render(
      <PinReplaceDialog
        isOpen={true}
        pinnedMessages={mockPinnedMessages}
        onReplace={mockOnReplace}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'chat.change' }));

    expect(screen.getByTestId('document-icon-excel')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file/)).toBeInTheDocument();
  });
});
