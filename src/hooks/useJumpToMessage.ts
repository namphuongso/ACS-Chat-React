import { useCallback } from 'react';
import { useMessageStore } from '../store/messageStore';

export interface UseJumpToMessageResult {
  /** Jump to a specific message by its ID, with optional conversationId and highlight duration in ms */
  jumpToMessage: (messageId: string, conversationId?: string, highlightDuration?: number) => void;
  /** Currently highlighted message ID */
  highlightedMessageId: string | null;
  /** Active jump target details */
  jumpTarget: {
    conversationId?: string;
    messageId: string;
    timestamp: number;
    highlightDuration?: number;
  } | null;
  /** Set currently highlighted message ID */
  setHighlightedMessageId: (messageId: string | null) => void;
  /** Clear active jump target */
  clearJumpTarget: () => void;
}

/**
 * Reusable hook to jump/scroll to a message and control highlight state.
 * Can be used anywhere (pinned message banner, search results, quote reply, custom components).
 */
export const useJumpToMessage = (): UseJumpToMessageResult => {
  const jumpTarget = useMessageStore((state) => state.jumpTarget);
  const highlightedMessageId = useMessageStore((state) => state.highlightedMessageId);
  const storeJumpToMessage = useMessageStore((state) => state.jumpToMessage);
  const setHighlightedMessageId = useMessageStore((state) => state.setHighlightedMessageId);
  const clearJumpTarget = useMessageStore((state) => state.clearJumpTarget);

  const jumpToMessage = useCallback(
    (messageId: string, conversationId?: string, highlightDuration?: number) => {
      storeJumpToMessage(messageId, conversationId, highlightDuration);
    },
    [storeJumpToMessage]
  );

  return {
    jumpToMessage,
    highlightedMessageId,
    jumpTarget,
    setHighlightedMessageId,
    clearJumpTarget,
  };
};
