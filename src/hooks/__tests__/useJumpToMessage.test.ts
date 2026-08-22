import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useJumpToMessage } from '../useJumpToMessage';
import { useMessageStore } from '../../store/messageStore';

describe('useJumpToMessage', () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it('should initialize with null jumpTarget and highlightedMessageId', () => {
    const { result } = renderHook(() => useJumpToMessage());
    expect(result.current.jumpTarget).toBeNull();
    expect(result.current.highlightedMessageId).toBeNull();
  });

  it('should trigger jumpToMessage and update store state', () => {
    const { result } = renderHook(() => useJumpToMessage());

    act(() => {
      result.current.jumpToMessage('msg-456', 'conv-1', 2000);
    });

    expect(result.current.jumpTarget).toBeDefined();
    expect(result.current.jumpTarget?.messageId).toBe('msg-456');
    expect(result.current.jumpTarget?.conversationId).toBe('conv-1');
    expect(result.current.jumpTarget?.highlightDuration).toBe(2000);
  });

  it('should set and clear highlighted message ID', () => {
    const { result } = renderHook(() => useJumpToMessage());

    act(() => {
      result.current.setHighlightedMessageId('msg-456');
    });

    expect(result.current.highlightedMessageId).toBe('msg-456');

    act(() => {
      result.current.setHighlightedMessageId(null);
    });

    expect(result.current.highlightedMessageId).toBeNull();
  });

  it('should clear jump target', () => {
    const { result } = renderHook(() => useJumpToMessage());

    act(() => {
      result.current.jumpToMessage('msg-456');
    });

    expect(result.current.jumpTarget).not.toBeNull();

    act(() => {
      result.current.clearJumpTarget();
    });

    expect(result.current.jumpTarget).toBeNull();
  });
});
