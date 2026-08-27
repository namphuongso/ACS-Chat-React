import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useConversationActions } from '../useConversationActions';
import { MAX_PINNED_MESSAGES } from '../../../constants';
import type { ChatMessage, PinnedMessage } from '../../../types/message.types';

function createMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    sender: { id: 'user-1', displayName: 'Alice' },
    senderDisplayName: 'Alice',
    content: 'Hello',
    type: 'text',
    status: 'sent',
    createdAt: new Date('2026-08-26T10:00:00Z'),
    ...overrides,
  } as ChatMessage;
}

describe('useConversationActions', () => {
  const pinMessage = vi.fn().mockResolvedValue({});
  const editMessage = vi.fn();
  const deleteMessage = vi.fn();
  const onOpenAttachment = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass through pinnedMessagesFromStore directly when provided', () => {
    const messages = [
      createMessage({ id: 'msg-pin-1', content: 'report.pdf' }),
    ];
    const pinnedMessagesFromStore: PinnedMessage[] = [
      {
        messageId: 'msg-pin-1',
        type: 'file',
        content: 'report.pdf',
        creator: 'Alice',
        createdDate: '2026-08-26T10:00:00Z',
        attachmentType: 'application/pdf',
        attachmentUrl: 'https://example.com/report.pdf',
        thumbUrl: '',
      },
    ];

    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessagesFromStore,
        messages,
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    expect(result.current.effectivePinnedMessages).toHaveLength(1);
    expect(result.current.effectivePinnedMessages[0].attachmentUrl).toBe(
      'https://example.com/report.pdf'
    );
    expect(result.current.effectivePinnedMessages[0].attachmentType).toBe('application/pdf');
  });

  it('should derive effectivePinnedMessages from id list when no store list is provided', () => {
    const messages = [
      createMessage({
        id: 'msg-1',
        content: 'photo.png',
        metadata: {
          type: 'image',
          fileName: 'photo.png',
          mimeType: 'image/png',
          url: 'https://example.com/photo.png',
        },
      }),
    ];

    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessageIds: ['msg-1'],
        messages,
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    expect(result.current.effectivePinnedMessageIds).toEqual(['msg-1']);
    const pinned = result.current.effectivePinnedMessages;
    expect(pinned).toHaveLength(1);
    expect(pinned[0].attachmentUrl).toBe('https://example.com/photo.png');
    expect(pinned[0].thumbUrl).toBe('https://example.com/photo.png');
  });

  it('should pin message directly when under the limit', () => {
    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessageIds: new Set(['msg-1']),
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    act(() => {
      result.current.handlePinMessage('msg-2', true);
    });

    expect(pinMessage).toHaveBeenCalledWith('msg-2', true);
    expect(result.current.pinReplaceDialog.isOpen).toBe(false);
  });

  it('should open replace dialog when pinning would exceed the limit', () => {
    const ids = Array.from({ length: MAX_PINNED_MESSAGES }, (_, i) => `msg-${i}`);
    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessageIds: new Set(ids),
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    act(() => {
      result.current.handlePinMessage('msg-new', true);
    });

    expect(pinMessage).not.toHaveBeenCalled();
    expect(result.current.pinReplaceDialog.isOpen).toBe(true);
    expect(result.current.pinReplaceDialog.candidateId).toBe('msg-new');
  });

  it('should replace an existing pinned message via handlePinReplace', async () => {
    pinMessage.mockResolvedValueOnce({});
    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessageIds: new Set(['old-1', 'old-2', 'old-3']),
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    // Open the replace dialog through handlePinMessage (sets pinReplaceDialog state)
    await act(async () => {
      result.current.handlePinMessage('new-1', true);
    });
    expect(result.current.pinReplaceDialog.candidateId).toBe('new-1');

    await act(async () => {
      await result.current.handlePinReplace('old-3');
    });

    expect(pinMessage).toHaveBeenNthCalledWith(1, 'old-3', false);
    expect(pinMessage).toHaveBeenNthCalledWith(2, 'new-1', true);
    expect(result.current.pinReplaceDialog.isOpen).toBe(false);
  });

  it('should restore the old pin if re-pinning the candidate fails', async () => {
    pinMessage
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ error: 'failed to pin' });
    const { result } = renderHook(() =>
      useConversationActions({
        pinnedMessageIds: new Set(['old-1', 'old-2', 'old-3']),
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    // Open the replace dialog through handlePinMessage (sets pinReplaceDialog state)
    await act(async () => {
      result.current.handlePinMessage('new-1', true);
    });
    expect(result.current.pinReplaceDialog.candidateId).toBe('new-1');

    await act(async () => {
      await result.current.handlePinReplace('old-3');
    });

    expect(pinMessage).toHaveBeenNthCalledWith(3, 'old-3', true);
    expect(result.current.pinReplaceDialog.isOpen).toBe(true);
  });

  it('should open edit dialog with stripped HTML content', () => {
    const messages = [
      createMessage({ id: 'msg-1', type: 'html', content: '<p>Hello <b>world</b></p>' }),
    ];
    const { result } = renderHook(() =>
      useConversationActions({
        messages,
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    act(() => {
      result.current.handleEditMessage('msg-1');
    });

    expect(result.current.editDialog.isOpen).toBe(true);
    expect(result.current.editDialog.messageId).toBe('msg-1');
    expect(result.current.editDialog.initialContent).toBe('Hello world');

    act(() => {
      result.current.handleSaveEdit('Edited content');
    });

    expect(editMessage).toHaveBeenCalledWith('msg-1', 'Edited content');
    expect(result.current.editDialog.isOpen).toBe(false);
  });

  it('should open delete dialog and confirm deletion', () => {
    const { result } = renderHook(() =>
      useConversationActions({
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    act(() => {
      result.current.handleDeleteMessage('msg-1');
    });

    expect(result.current.deleteDialog.isOpen).toBe(true);
    expect(result.current.deleteDialog.messageId).toBe('msg-1');

    act(() => {
      result.current.handleConfirmDelete();
    });

    expect(deleteMessage).toHaveBeenCalledWith('msg-1');
    expect(result.current.deleteDialog.isOpen).toBe(false);
  });

  it('should open a file preview when no external onOpenAttachment is provided', () => {
    const { result } = renderHook(() =>
      useConversationActions({
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
      })
    );

    act(() => {
      result.current.handleOpenAttachment('https://example.com/file.pdf', 'file.pdf', {
        url: 'https://example.com/file.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
      });
    });

    expect(result.current.previewFile?.fileName).toBe('file.pdf');
    expect(result.current.previewFile?.fileSize).toBe(1024);

    act(() => {
      result.current.handleClosePreview();
    });

    expect(result.current.previewFile).toBeNull();
  });

  it('should delegate to external onOpenAttachment when provided', () => {
    const { result } = renderHook(() =>
      useConversationActions({
        messages: [],
        pinMessage,
        editMessage,
        deleteMessage,
        onOpenAttachment,
      })
    );

    act(() => {
      result.current.handleOpenAttachment('https://example.com/file.pdf', 'file.pdf');
    });

    expect(onOpenAttachment).toHaveBeenCalledWith('https://example.com/file.pdf', 'file.pdf');
  });
});
