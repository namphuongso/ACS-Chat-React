import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReadReceipt } from '../useReadReceipt';
import { readReceiptService } from '../../services/readReceiptService';
import { useChatStore } from '../../store/chatStore';
import { useParticipantStore } from '../../store/participantStore';
import { useMessageStore } from '../../store/messageStore';

describe('useReadReceipt', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useParticipantStore.getState().reset();
    useMessageStore.getState().reset();
    useChatStore.getState().setCurrentUser({ id: 'user-1', displayName: 'Alice' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call readReceiptService.sendReadReceipt when sendReadReceipt is invoked', async () => {
    const sendSpy = vi.spyOn(readReceiptService, 'sendReadReceipt').mockResolvedValue(undefined);

    const { result } = renderHook(() => useReadReceipt('conv-1'));

    await act(async () => {
      await result.current.sendReadReceipt('msg-100');
    });

    expect(sendSpy).toHaveBeenCalledWith('conv-1', 'msg-100');
  });

  it('should not call readReceiptService if conversationId is empty', async () => {
    const sendSpy = vi.spyOn(readReceiptService, 'sendReadReceipt').mockResolvedValue(undefined);

    const { result } = renderHook(() => useReadReceipt(''));

    await act(async () => {
      await result.current.sendReadReceipt('msg-100');
    });

    expect(sendSpy).not.toHaveBeenCalled();
  });
});
