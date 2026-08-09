import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { ChatProvider } from '../../components/ChatProvider';
import { useChat } from '../../hooks/useChat';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { chatService } from '../../services/chatService';
import { conversationService } from '../../services/conversationService';
import { messageService } from '../../services/messageService';


vi.mock('../../services/chatService', () => ({
  chatService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockReturnValue({ id: 'user-1', displayName: 'Test User' }),
  },
}));

vi.mock('../../services/connectionService', () => ({
  connectionService: {
    setupNetworkListeners: vi.fn(),
    teardownNetworkListeners: vi.fn(),
  },
}));

vi.mock('../../services/typingService', () => ({
  typingService: {
    setChatService: vi.fn(),
  },
}));

vi.mock('../../services/readReceiptService', () => ({
  readReceiptService: {
    setChatService: vi.fn(),
  },
}));

vi.mock('../../services/conversationService', () => ({
  conversationService: {
    loadConversations: vi.fn().mockResolvedValue(undefined),
    setChatService: vi.fn(),
  },
}));

vi.mock('../../services/messageService', () => ({
  messageService: {
    loadMore: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
    setChatService: vi.fn(),
  },
}));

describe('Headless API Integration', () => {
  const mockConfig = {
    endpoint: 'https://test.communication.azure.com',
    token: 'fake-token',
    tokenRefresher: async () => 'fake-token',
    userId: 'user-1',
    displayName: 'Test User',
    backendUrl: 'https://api.example.com',
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ChatProvider config={mockConfig}>{children}</ChatProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize chat successfully via useChat', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });

    await waitFor(() => {
      expect(chatService.initialize).toHaveBeenCalledWith(mockConfig);
    });

    // In a real scenario with full mock, we might need to mock store state.
    // Here we mainly test the hook invocation.
    expect(result.current).toBeDefined();
  });

  it('should load conversations via useConversations', async () => {
    const { result } = renderHook(() => useConversations(), { wrapper });

    result.current.loadConversations();

    await waitFor(() => {
      expect(conversationService.loadConversations).toHaveBeenCalled();
    });
  });

  it('should load and send messages via useMessages', async () => {
    const threadId = 'thread-1';
    const { result } = renderHook(() => useMessages(threadId), { wrapper });

    result.current.loadMore();

    await waitFor(() => {
      expect(messageService.loadMore).toHaveBeenCalledWith(threadId, undefined);
    });

    result.current.sendMessage('Hello');

    await waitFor(() => {
      expect(messageService.sendMessage).toHaveBeenCalledWith(
        threadId,
        'Hello',
        undefined
      );
    });
  });
});
