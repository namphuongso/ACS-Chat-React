import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcsClientAdapter } from '../../adapters/acs/acsClientAdapter';
import { AcsChatError } from '../../types/errors.types';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

const mockGetChatThreadClient = vi.fn().mockReturnValue({ threadId: 'thread-123' });

vi.mock('@azure/communication-chat', () => {
  return {
    ChatClient: vi.fn().mockImplementation(() => {
      return {
        getChatThreadClient: mockGetChatThreadClient,
      };
    }),
  };
});

describe('AcsClientAdapter', () => {
  const validEndpoint = 'https://contoso.communication.azure.com';
  const mockCredential = {
    getToken: vi.fn().mockResolvedValue({ token: 'mock-token', expiresOnTimestamp: Date.now() + 3600000 }),
    dispose: vi.fn(),
  } as unknown as AzureCommunicationTokenCredential;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor & Validation', () => {
    it('should initialize successfully with valid endpoint and credential', () => {
      const adapter = new AcsClientAdapter(validEndpoint, mockCredential);
      expect(adapter).toBeDefined();
      expect(adapter.getChatClient()).toBeDefined();
    });

    it('should throw INVALID_INPUT if endpoint is empty or missing', () => {
      expect(() => new AcsClientAdapter('', mockCredential)).toThrow(AcsChatError);
      try {
        new AcsClientAdapter('', mockCredential);
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('INVALID_INPUT');
      }
    });

    it('should throw INVALID_INPUT if endpoint is an invalid URL', () => {
      expect(() => new AcsClientAdapter('not-a-valid-url', mockCredential)).toThrow(AcsChatError);
      try {
        new AcsClientAdapter('not-a-valid-url', mockCredential);
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('INVALID_INPUT');
      }
    });

    it('should throw AUTH_TOKEN_INVALID if credential is null or invalid', () => {
      expect(() => new AcsClientAdapter(validEndpoint, null as unknown as AzureCommunicationTokenCredential)).toThrow(
        AcsChatError
      );
      try {
        new AcsClientAdapter(validEndpoint, null as unknown as AzureCommunicationTokenCredential);
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('AUTH_TOKEN_INVALID');
      }
    });
  });

  describe('Thread Client Creation', () => {
    it('should create ChatThreadClient with valid threadId', () => {
      const adapter = new AcsClientAdapter(validEndpoint, mockCredential);
      const threadClient = adapter.createThreadClient('thread-123');
      expect(mockGetChatThreadClient).toHaveBeenCalledWith('thread-123');
      expect(threadClient).toEqual({ threadId: 'thread-123' });
    });

    it('should throw INVALID_INPUT if threadId is invalid or empty', () => {
      const adapter = new AcsClientAdapter(validEndpoint, mockCredential);
      expect(() => adapter.createThreadClient('')).toThrow(AcsChatError);
      try {
        adapter.createThreadClient('');
      } catch (err: unknown) {
        expect((err as AcsChatError).code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('Dispose', () => {
    it('should dispose successfully without errors', () => {
      const adapter = new AcsClientAdapter(validEndpoint, mockCredential);
      expect(() => adapter.dispose()).not.toThrow();
    });
  });
});

