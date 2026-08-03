import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcsThreadAdapter } from '../../adapters/acs/acsThreadAdapter';
import { AcsChatError } from '../../types/errors.types';
import type { GroupConversation } from '../../types';
import type { ChatThreadClient } from '@azure/communication-chat';

describe('AcsThreadAdapter', () => {
  const mockThreadId = 'thread-123';
  const currentUserId = '8:acs:current-user';

  const createMockThreadClient = () => {
    return {
      threadId: mockThreadId,
      sendMessage: vi.fn().mockResolvedValue({ id: 'msg-1' }),
      getMessage: vi.fn().mockResolvedValue({
        id: 'msg-1',
        type: 'text',
        sequenceId: '1',
        version: '1',
        content: { message: 'Hello World' },
        senderDisplayName: 'Sender',
        createdOn: new Date(),
        sender: { communicationUserId: '8:acs:sender' },
      }),
      listMessages: vi.fn().mockReturnValue({
        byPage: vi.fn().mockImplementation(async function* () {
          yield [
            {
              id: 'msg-1',
              type: 'text',
              sequenceId: '1',
              version: '1',
              content: { message: 'Hello 1' },
              sender: { communicationUserId: '8:acs:sender' },
            },
          ];
        }),
      }),
      updateMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      addParticipants: vi.fn().mockResolvedValue(undefined),
      removeParticipant: vi.fn().mockResolvedValue(undefined),
      listParticipants: vi.fn().mockReturnValue({
        byPage: vi.fn().mockImplementation(async function* () {
          yield [
            {
              id: { communicationUserId: '8:acs:user-2' },
              displayName: 'User Two',
              shareHistoryTime: new Date(),
            },
          ];
        }),
      }),
      sendReadReceipt: vi.fn().mockResolvedValue(undefined),
      listReadReceipts: vi.fn().mockReturnValue({
        byPage: vi.fn().mockImplementation(async function* () {
          yield [
            {
              chatMessageId: 'msg-1',
              sender: { communicationUserId: '8:acs:user-2' },
              readOn: new Date(),
            },
          ];
        }),
      }),
      sendTypingNotification: vi.fn().mockResolvedValue(undefined),
      updateTopic: vi.fn().mockResolvedValue(undefined),
      getProperties: vi.fn().mockResolvedValue({
        id: mockThreadId,
        topic: 'Test Topic',
        createdOn: new Date(),
      }),
    } as unknown as ChatThreadClient;
  };

  let mockClient: ChatThreadClient;
  let adapter: AcsThreadAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockThreadClient();
    adapter = new AcsThreadAdapter(mockClient, currentUserId);
  });

  describe('Constructor & Validation', () => {
    it('should initialize successfully with valid parameters', () => {
      expect(adapter).toBeDefined();
      expect(adapter.threadId).toBe(mockThreadId);
      expect(adapter.getChatThreadClient()).toBe(mockClient);
    });

    it('should throw INVALID_INPUT if chatThreadClient is missing', () => {
      expect(
        () => new AcsThreadAdapter(null as unknown as ChatThreadClient, currentUserId)
      ).toThrow(AcsChatError);
    });

    it('should throw INVALID_INPUT if currentUserId is empty', () => {
      expect(() => new AcsThreadAdapter(mockClient, '')).toThrow(AcsChatError);
      expect(() => new AcsThreadAdapter(mockClient, '   ')).toThrow(AcsChatError);
    });
  });

  describe('Messages Operations', () => {
    it('should sendMessage successfully', async () => {
      const msgId = await adapter.sendMessage('Hello', { type: 'text' });
      expect(msgId).toBe('msg-1');
      expect(mockClient.sendMessage).toHaveBeenCalledWith(
        { content: 'Hello' },
        { type: 'text', metadata: undefined }
      );
    });

    it('should throw INVALID_INPUT on sendMessage with empty content', async () => {
      await expect(adapter.sendMessage('')).rejects.toThrow(AcsChatError);
      await expect(adapter.sendMessage('   ')).rejects.toThrow(AcsChatError);
    });

    it('should getMessage successfully', async () => {
      const msg = await adapter.getMessage('msg-1');
      expect(msg.id).toBe('msg-1');
      expect(msg.content).toBe('Hello World');
      expect(mockClient.getMessage).toHaveBeenCalledWith('msg-1');
    });

    it('should throw INVALID_INPUT on getMessage with empty messageId', async () => {
      await expect(adapter.getMessage('')).rejects.toThrow(AcsChatError);
    });

    it('should listMessages successfully', async () => {
      const pages = [];
      for await (const page of adapter.listMessages()) {
        pages.push(page);
      }
      expect(pages).toHaveLength(1);
      expect(pages[0]).toHaveLength(1);
      expect(pages[0][0].id).toBe('msg-1');
    });

    it('should updateMessage successfully', async () => {
      await adapter.updateMessage('msg-1', 'Updated content');
      expect(mockClient.updateMessage).toHaveBeenCalledWith('msg-1', {
        content: 'Updated content',
      });
    });

    it('should throw INVALID_INPUT on updateMessage with empty parameters', async () => {
      await expect(adapter.updateMessage('', 'Updated')).rejects.toThrow(AcsChatError);
      await expect(adapter.updateMessage('msg-1', '')).rejects.toThrow(AcsChatError);
    });

    it('should deleteMessage successfully', async () => {
      await adapter.deleteMessage('msg-1');
      expect(mockClient.deleteMessage).toHaveBeenCalledWith('msg-1');
    });

    it('should throw INVALID_INPUT on deleteMessage with empty messageId', async () => {
      await expect(adapter.deleteMessage('')).rejects.toThrow(AcsChatError);
    });
  });

  describe('Participants Operations', () => {
    it('should addParticipants successfully', async () => {
      await adapter.addParticipants([{ userId: '8:acs:user-2', displayName: 'User Two' }]);
      expect(mockClient.addParticipants).toHaveBeenCalledWith({
        participants: [
          {
            id: { communicationUserId: '8:acs:user-2' },
            displayName: 'User Two',
            shareHistoryTime: undefined,
          },
        ],
      });
    });

    it('should throw INVALID_INPUT on addParticipants with invalid array or user IDs', async () => {
      await expect(adapter.addParticipants([])).rejects.toThrow(AcsChatError);
      await expect(adapter.addParticipants([{ userId: '' }])).rejects.toThrow(AcsChatError);
    });

    it('should removeParticipant successfully', async () => {
      await adapter.removeParticipant('8:acs:user-2');
      expect(mockClient.removeParticipant).toHaveBeenCalledWith({
        communicationUserId: '8:acs:user-2',
      });
    });

    it('should throw INVALID_INPUT on removeParticipant with empty userId', async () => {
      await expect(adapter.removeParticipant('')).rejects.toThrow(AcsChatError);
    });

    it('should listParticipants successfully', async () => {
      const pages = [];
      for await (const page of adapter.listParticipants()) {
        pages.push(page);
      }
      expect(pages).toHaveLength(1);
      expect(pages[0][0].id).toBe('8:acs:user-2');
    });
  });

  describe('Read Receipts & Typing & Topic Operations', () => {
    it('should sendReadReceipt successfully', async () => {
      await adapter.sendReadReceipt('msg-1');
      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith({
        chatMessageId: 'msg-1',
      });
    });

    it('should throw INVALID_INPUT on sendReadReceipt with empty messageId', async () => {
      await expect(adapter.sendReadReceipt('')).rejects.toThrow(AcsChatError);
    });

    it('should listReadReceipts successfully', async () => {
      const pages = [];
      for await (const page of adapter.listReadReceipts()) {
        pages.push(page);
      }
      expect(pages).toHaveLength(1);
      expect(pages[0][0].messageId).toBe('msg-1');
    });

    it('should sendTypingNotification successfully', async () => {
      await adapter.sendTypingNotification();
      expect(mockClient.sendTypingNotification).toHaveBeenCalled();
    });

    it('should updateTopic successfully', async () => {
      await adapter.updateTopic('New Topic');
      expect(mockClient.updateTopic).toHaveBeenCalledWith('New Topic');
    });

    it('should throw INVALID_INPUT on updateTopic with empty topic', async () => {
      await expect(adapter.updateTopic('')).rejects.toThrow(AcsChatError);
    });

    it('should getProperties successfully', async () => {
      const props = await adapter.getProperties();
      expect(props.id).toBe(mockThreadId);
      expect((props as Partial<GroupConversation>).name).toBe('Test Topic');
    });
  });

  describe('Error Mapping', () => {
    it('should map ACS rest errors to AcsChatError', async () => {
      const restError = { statusCode: 404, message: 'Thread not found' };
      (mockClient.sendMessage as ReturnType<typeof vi.fn>).mockRejectedValue(restError);

      try {
        await adapter.sendMessage('Test');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AcsChatError);
        expect((err as AcsChatError).code).toBe('ACS_NOT_FOUND');
        expect((err as AcsChatError).operation).toBe('sendMessage');
      }
    });
  });
});
