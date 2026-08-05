import { render, screen, waitFor } from '@testing-library/react';
import { useContext } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatContext } from '../../providers/ChatContext';
import { chatService } from '../../services/chatService';
import { connectionService } from '../../services/connectionService';
import type { ChatConfig } from '../../types/config.types';
import { ChatProvider } from '../ChatProvider';

vi.mock('../../services/chatService', () => ({
  chatService: {
    initialize: vi.fn(),
    dispose: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/connectionService', () => ({
  connectionService: {
    setupNetworkListeners: vi.fn(),
    teardownNetworkListeners: vi.fn(),
  },
}));

describe('ChatProvider', () => {
  const mockConfig: ChatConfig = {
    endpoint: 'https://test.communication.azure.com',
    userId: 'test-user',
    displayName: 'Test User',
    token: 'test-token',
    tokenRefresher: vi.fn().mockResolvedValue('test-token'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize chatService and connectionService on mount', async () => {
    vi.mocked(chatService.initialize).mockResolvedValue(undefined);

    const TestComponent = () => {
      const context = useContext(ChatContext);
      return <div data-testid="test-child">{context ? 'Has Context' : 'No Context'}</div>;
    };

    render(
      <ChatProvider config={mockConfig}>
        <TestComponent />
      </ChatProvider>
    );

    await waitFor(() => {
      expect(chatService.initialize).toHaveBeenCalledWith(mockConfig);
      expect(connectionService.setupNetworkListeners).toHaveBeenCalled();
    });

    expect(screen.getByTestId('test-child').textContent).toBe('Has Context');
  });

  it('should teardown and dispose on unmount', async () => {
    vi.mocked(chatService.initialize).mockResolvedValue(undefined);

    const { unmount } = render(
      <ChatProvider config={mockConfig}>
        <div>Test</div>
      </ChatProvider>
    );

    await waitFor(() => {
      expect(chatService.initialize).toHaveBeenCalled();
    });

    unmount();

    expect(connectionService.teardownNetworkListeners).toHaveBeenCalled();
    expect(chatService.dispose).toHaveBeenCalled();
  });
});
