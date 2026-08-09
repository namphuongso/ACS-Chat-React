import type { ChatClient } from '@azure/communication-chat';
import {
  mapAcsErrorToChatError,
  mapAcsParticipantToParticipant,
  mapAcsThreadItemToConversation,
} from '../adapters/acs/acsMappers';
import { useChatStore } from '../store/chatStore';
import { useConversationStore } from '../store/conversationStore';
import { useParticipantStore } from '../store/participantStore';
import { useMessageStore } from '../store/messageStore';
import { fetchBackend } from '../utils/apiClient';
import type {
  BaseConversation,
  Conversation,
  CreateDirectConversationOptions,
  CreateGroupConversationOptions,
  GroupConversation,
  DirectConversation,
} from '../types/conversation.types';
import type { ConversationParticipant } from '../types/participant.types';
import type { Contact } from '../types/contact.types';
import type { ChatError } from '../types/errors.types';
import { AcsChatError } from '../types/errors.types';
import { logger } from '../utils/logger';
import type { ChatService } from './chatService';

export interface BackendConversationItem {
  id: string;
  type: string;
  topic?: string;
  createdAt?: string | Date | number;
  updatedAt?: string | Date | number;
  participants?: ConversationParticipant[];
  pid?: string;
  hostId?: string;
  roomName?: string;
  description?: string;
  threadId?: string;
  avatarUrl?: string;
  created?: string;
  modified?: string | null;
  creator?: string;
  modifier?: string;
  pin?: boolean;
  isMuted?: boolean;
  lastMessage?: string;
  lastMessageTime?: string | null;
  lastViewedDate?: string | null;
  isRead?: boolean;
}

export interface CreateRoomResponse {
  id?: string;
  roomId?: string;
  threadId: string;
  members?: Array<{
    cui: string;
    contactName?: string;
    isAdmin?: boolean;
  }>;
}

export interface JoinRoomResponse {
  roomId?: string;
  roomType?: string;
  roomName?: string;
  avatarUrl?: string;
  threadId?: string;
  cui?: string;
  token?: string;
  tokenUtcExp?: string;
  members?: Array<{
    userId?: string;
    contactName?: string;
    avatarUrl?: string;
    cui?: string;
    isAdmin?: boolean;
  }>;
}

/**
 * Options for listing conversations with pagination support.
 */
export interface ListConversationsOptions {
  /** Maximum number of conversations per page (default: 50) */
  maxPageSize?: number;
  /** Page number for backend pagination (default: 1) */
  page?: number;
}

/**
 * Result of a conversation operation containing the conversation data and optional error.
 */
export interface ConversationResult {
  /** The conversation entity if operation succeeded */
  conversation?: Conversation;
  /** Error details if operation failed */
  error?: ChatError;
}

/**
 * Service for managing conversation CRUD operations.
 * Works with ACS ChatClient adapters and Zustand conversation store.
 */
export class ConversationService {
  private chatServiceRef: ChatService | null = null;

  /**
   * Set the ChatService reference (injected after initialization).
   */
  public setChatService(service: ChatService): void {
    this.chatServiceRef = service;
  }

  /**
   * Get the underlying ACS ChatClient instance from ChatService.
   */
  private getChatClient(): ChatClient {
    if (!this.chatServiceRef || !this.chatServiceRef.isInitialized()) {
      throw new AcsChatError('INVALID_INPUT', 'ChatService is not initialized.', {
        operation: 'getChatClient',
      });
    }
    return this.chatServiceRef.getChatClient();
  }

  /**
   * Load conversations from ACS backend with pagination.
   * Updates the conversation store with fetched conversations.
   */
  public async loadConversations(
    options?: ListConversationsOptions
  ): Promise<ConversationResult[]> {
    const store = useConversationStore.getState();
    const maxPageSize = options?.maxPageSize || 50;

    store.setLoading(true);
    store.setError(null);

    try {
      const chatClient = this.getChatClient();
      const currentUserId = useChatStore.getState().currentUser?.id;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'loadConversations',
        });
      }

      const conversations: Conversation[] = [];
      const config = this.chatServiceRef?.getConfig();

      if (config?.backendUrl) {
        // Backend pagination
        const pageIndex = options?.page || 1;
        const res = await fetchBackend<BackendConversationItem[]>(
          config,
          `/api/chat/get-room-chats?keyword=&pageIndex=${pageIndex}`,
          {
            method: 'GET',
          }
        );

        const data = Array.isArray(res?.data) ? res.data : [];
        for (const item of data) {
          if (item.type === 'U' || item.type === 'direct') {
            conversations.push({
              id: item.threadId || item.id,
              conversationId: item.id,
              type: 'direct',
              createdAt: new Date(item.created || item.createdAt || Date.now()),
              updatedAt:
                item.modified || item.updatedAt
                  ? new Date((item.modified || item.updatedAt) as string | number | Date)
                  : undefined,
              unreadCount: item.isRead === false ? 1 : 0,
              participants: [],
              otherParticipant: {
                id: item.pid || 'unknown',
                displayName: item.roomName || 'Unknown',
              },
              avatarUrl: item.avatarUrl || undefined,
              name: item.roomName || 'Unknown',
            });
          } else {
            conversations.push({
              id: item.threadId || item.id,
              conversationId: item.id,
              type: 'group',
              name: item.roomName || item.topic || 'Group',
              createdAt: new Date(item.created || item.createdAt || Date.now()),
              updatedAt:
                item.modified || item.updatedAt
                  ? new Date((item.modified || item.updatedAt) as string | number | Date)
                  : undefined,
              unreadCount: item.isRead === false ? 1 : 0,
              participants: [],
              avatarUrl: item.avatarUrl || undefined,
            });
          }
        }

        if (pageIndex === 1) {
          store.setConversations(conversations);
        } else {
          store.appendConversations(conversations);
        }
        store.setLoading(false);
        store.setHasMore(data.length > 0);
        store.setCursor((pageIndex + 1).toString());
      } else {
        // ACS native fetch
        const threads = chatClient.listChatThreads({ maxPageSize });

        for await (const page of threads.byPage()) {
          for (const thread of page) {
            const partialConv = mapAcsThreadItemToConversation(thread);
            const convId = partialConv.id!;

            // Fetch participants for this thread to determine conversation type
            try {
              const threadClient = chatClient.getChatThreadClient(convId);
              const participants: ConversationParticipant[] = [];
              const participantIterator = threadClient.listParticipants();
              for await (const partPage of participantIterator.byPage()) {
                for (const acsPart of partPage) {
                  participants.push(mapAcsParticipantToParticipant(acsPart));
                }
              }

              const isDirect = participants.length === 2;
              const otherParticipant = participants.find((p) => p.id !== currentUserId);

              if (isDirect && otherParticipant) {
                const directConv = {
                  id: convId,
                  type: 'direct' as const,
                  createdAt: partialConv.createdAt || new Date(),
                  updatedAt: partialConv.updatedAt,
                  unreadCount: 0,
                  participants,
                  otherParticipant,
                  name: otherParticipant.displayName || 'Unknown',
                };
                conversations.push(directConv);
              } else {
                const groupConv: GroupConversation = {
                  id: convId,
                  type: 'group',
                  name: (partialConv as GroupConversation).name || 'Group',
                  createdAt: partialConv.createdAt || new Date(),
                  updatedAt: partialConv.updatedAt,
                  unreadCount: 0,
                  participants,
                };
                conversations.push(groupConv);
              }

              // Set participants in store
              if (participants.length > 0) {
                useParticipantStore.getState().setParticipants(convId, participants);
              }
            } catch (error) {
              // If fetching participants fails, still add as a basic conversation
              const basicConv: BaseConversation = {
                id: convId,
                type: 'group',
                createdAt: partialConv.createdAt || new Date(),
                updatedAt: partialConv.updatedAt,
                unreadCount: 0,
                participants: [],
                name: (partialConv as GroupConversation).name || 'Group',
                avatarUrl: (partialConv as GroupConversation).avatarUrl,
              };
              conversations.push(basicConv as Conversation);
              logger.warn(`Failed to fetch participants for thread ${convId}`, error);
            }
          }
          // Break after first page for initial load; pagination handled separately
          break;
        }

        const page = options?.page || 1;
        if (page === 1) {
          store.setConversations(conversations);
        } else {
          store.appendConversations(conversations);
        }
        store.setLoading(false);
        store.setHasMore(false);
      }

      return conversations.map((conv) => ({ conversation: conv }));
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'loadConversations');
      store.setError(chatError);
      store.setLoading(false);
      throw chatError;
    }
  }

  /**
   * Create a direct (1-on-1) conversation with another user.
   * Creates an ACS chat thread and returns the conversation.
   * Note: ACS SDK automatically adds the current user as a participant.
   */
  public async createDirectConversation(
    options: CreateDirectConversationOptions
  ): Promise<ConversationResult> {
    const store = useConversationStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const chatClient = this.getChatClient();
      const currentUserId = useChatStore.getState().currentUser?.id;
      const currentDisplayName = useChatStore.getState().currentUser?.displayName;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'createDirectConversation',
        });
      }

      if (!options.targetUserId || options.targetUserId.trim() === '') {
        throw new AcsChatError('INVALID_INPUT', 'targetUserId is required.', {
          operation: 'createDirectConversation',
        });
      }

      const config = this.chatServiceRef?.getConfig();
      let threadId: string;

      const participants: ConversationParticipant[] = [
        { id: currentUserId, displayName: currentDisplayName || undefined, role: 'owner' },
        { id: options.targetUserId, displayName: options.displayName, role: 'member' },
      ];
      const otherParticipant: ConversationParticipant = {
        id: options.targetUserId,
        displayName: options.displayName,
      };

      if (config?.backendUrl) {
        // Backend creates 1-1 to prevent duplicates
        const res = await fetchBackend<BackendConversationItem>(
          config,
          '/api/conversations/direct',
          {
            method: 'POST',
            body: JSON.stringify({ participantId: options.targetUserId }),
          }
        );

        threadId = res?.data?.id as string;
        if (!threadId) {
          throw new AcsChatError('UNKNOWN_ERROR', 'Failed to get thread ID from created thread.', {
            operation: 'createDirectConversation',
          });
        }

        // Use returned participants if any, otherwise default
        if (Array.isArray(res?.data?.participants) && res.data.participants.length > 0) {
          // Mapping would happen here if we cared to override
        }
      } else {
        // Direct ACS creation
        const topic = `Direct chat with ${options.displayName || options.targetUserId}`;

        // ACS SDK automatically adds the current user; only add the target user
        const result = await chatClient.createChatThread(
          { topic },
          {
            participants: [
              {
                id: { communicationUserId: options.targetUserId },
                displayName: options.displayName,
              },
            ],
          }
        );

        threadId = result.chatThread?.id as string;
        if (!threadId) {
          throw new AcsChatError('UNKNOWN_ERROR', 'Failed to get thread ID from created thread.', {
            operation: 'createDirectConversation',
          });
        }
      }

      const directConv = {
        id: threadId,
        type: 'direct' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        unreadCount: 0,
        participants,
        otherParticipant,
        name: options.displayName || 'Unknown',
      };

      store.addConversation(directConv);
      useParticipantStore.getState().setParticipants(threadId, participants);
      store.setLoading(false);

      return { conversation: directConv };
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'createDirectConversation');
      store.setError(chatError);
      store.setLoading(false);
      return { error: chatError };
    }
  }

  /**
   * Create a group conversation with multiple participants.
   * Note: ACS SDK automatically adds the current user as a participant.
   */
  public async createGroupConversation(
    options: CreateGroupConversationOptions
  ): Promise<ConversationResult> {
    const store = useConversationStore.getState();
    store.setLoading(true);
    store.setError(null);

    try {
      const chatClient = this.getChatClient();
      const currentUserId = useChatStore.getState().currentUser?.id;
      const currentDisplayName = useChatStore.getState().currentUser?.displayName;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'createGroupConversation',
        });
      }

      if (!options.name || options.name.trim() === '') {
        throw new AcsChatError('INVALID_INPUT', 'Group name is required.', {
          operation: 'createGroupConversation',
        });
      }

      if (!options.participants || options.participants.length === 0) {
        throw new AcsChatError('INVALID_INPUT', 'At least one participant is required.', {
          operation: 'createGroupConversation',
        });
      }

      // Build participant list (ACS SDK auto-adds the current user)
      const acsParticipants = options.participants.map((p) => ({
        id: { communicationUserId: p.userId } as const,
        displayName: p.displayName,
      }));

      const result = await chatClient.createChatThread(
        { topic: options.name },
        {
          participants: acsParticipants,
        }
      );

      const threadId = result.chatThread?.id;
      if (!threadId) {
        throw new AcsChatError('UNKNOWN_ERROR', 'Failed to get thread ID from created thread.', {
          operation: 'createGroupConversation',
        });
      }

      // Update topic if description is provided
      if (options.description) {
        try {
          const threadClient = chatClient.getChatThreadClient(threadId);
          await threadClient.updateTopic(options.name);
        } catch {
          logger.warn(`Failed to update topic for thread ${threadId}`);
        }
      }

      const participants: ConversationParticipant[] = [
        { id: currentUserId, displayName: currentDisplayName || undefined, role: 'owner' },
        ...options.participants.map(
          (p) =>
            ({
              id: p.userId,
              displayName: p.displayName,
              role: 'member',
            }) as ConversationParticipant
        ),
      ];

      const groupConv = {
        id: threadId,
        type: 'group' as const,
        name: options.name,
        description: options.description,
        createdAt: new Date(),
        updatedAt: new Date(),
        unreadCount: 0,
        participants,
      };

      store.addConversation(groupConv);
      useParticipantStore.getState().setParticipants(threadId, participants);
      store.setLoading(false);

      return { conversation: groupConv };
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'createGroupConversation');
      store.setError(chatError);
      store.setLoading(false);
      return { error: chatError };
    }
  }

  /**
   * Open a conversation by setting it as the active conversation.
   * Resets unread count for the conversation.
   */
  public async openConversation(conversationId: string, contact?: Contact): Promise<void> {
    const store = useConversationStore.getState();

    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'openConversation',
      });
    }

    if (store.conversations[conversationId]) {
      store.setActiveConversation(conversationId);
      store.resetUnreadCount(conversationId);
      useMessageStore.getState().trimInactiveConversations(conversationId, 50);
      logger.info(`Conversation ${conversationId} opened`);
      return;
    }

    try {
      const config = this.chatServiceRef?.getConfig();
      if (!config) {
        throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
          operation: 'openConversation',
        });
      }

      const roomName = contact?.fullName || 'New Conversation';
      const payload = {
        participantIds: [conversationId],
        roomType: 'U',
      };

      const res = await fetchBackend<CreateRoomResponse>(config, '/api/chat/create-room', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const threadId = res?.data?.threadId;
      if (!threadId) {
        throw new AcsChatError('UNKNOWN_ERROR', 'Failed to get thread ID from backend.', {
          operation: 'openConversation',
        });
      }

      const members = Array.isArray(res?.data?.members) ? res.data.members : [];

      const directConv: DirectConversation = {
        id: threadId,
        conversationId: res?.data?.roomId || res?.data?.id,
        type: 'direct',
        createdAt: new Date(),
        updatedAt: new Date(),
        unreadCount: 0,
        participants: members.map((m) => ({
          id: m.cui,
          displayName: m.contactName,
          role: m.isAdmin ? 'owner' : 'member',
        })),
        otherParticipant: {
          id: conversationId,
          displayName: roomName,
        },
        name: roomName,
        avatarUrl: contact?.avatarUrl,
      };

      store.addConversation(directConv);
      store.setActiveConversation(threadId);
      store.resetUnreadCount(threadId);

      useMessageStore.getState().trimInactiveConversations(threadId, 50);
      logger.info(`Conversation ${threadId} created and opened for contact ${conversationId}`);
    } catch (e) {
      const chatError = mapAcsErrorToChatError(e, 'openConversation', { conversationId });
      store.setError(chatError);
      throw chatError;
    }
  }

  /**
   * Close the currently active conversation by clearing the active conversation ID.
   */
  public closeConversation(): void {
    const store = useConversationStore.getState();
    const activeId = store.activeConversationId;

    if (!activeId) {
      logger.warn('No active conversation to close');
      return;
    }

    store.setActiveConversation(null);

    // Memory optimization: trim cached messages for inactive conversations
    useMessageStore.getState().trimInactiveConversations(null, 50);

    logger.info(`Conversation ${activeId} closed`);
  }

  /**
   * Delete a conversation entirely (ACS thread deletion).
   * This deletes the thread for ALL participants.
   */
  public async deleteConversation(conversationId: string): Promise<{ error?: ChatError }> {
    const store = useConversationStore.getState();

    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'deleteConversation',
      });
    }

    if (!store.conversations[conversationId]) {
      return {
        error: new AcsChatError(
          'CONVERSATION_NOT_FOUND',
          `Conversation ${conversationId} not found.`,
          {
            operation: 'deleteConversation',
            conversationId,
          }
        ),
      };
    }

    store.setError(null);

    try {
      const chatClient = this.getChatClient();

      // Delete the chat thread via ACS
      await chatClient.deleteChatThread(conversationId);

      // Remove from store
      store.removeConversation(conversationId);

      // Clean up participants in store
      useParticipantStore.getState().clearTypingUsers(conversationId);

      logger.info(`Conversation ${conversationId} deleted`);
      return {};
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'deleteConversation');
      store.setError(chatError);
      return { error: chatError };
    }
  }

  /**
   * Leave a conversation by removing the current user from the thread.
   */
  public async leaveConversation(conversationId: string): Promise<{ error?: ChatError }> {
    const store = useConversationStore.getState();

    if (!conversationId || conversationId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'conversationId is required.', {
        operation: 'leaveConversation',
      });
    }

    if (!store.conversations[conversationId]) {
      return {
        error: new AcsChatError(
          'CONVERSATION_NOT_FOUND',
          `Conversation ${conversationId} not found.`,
          {
            operation: 'leaveConversation',
            conversationId,
          }
        ),
      };
    }

    store.setError(null);

    try {
      const currentUserId = useChatStore.getState().currentUser?.id;

      if (!currentUserId) {
        throw new AcsChatError('AUTH_UNAUTHORIZED', 'Current user is not set.', {
          operation: 'leaveConversation',
        });
      }

      const chatClient = this.getChatClient();
      const threadClient = chatClient.getChatThreadClient(conversationId);

      // Remove current user from the thread
      await threadClient.removeParticipant({
        communicationUserId: currentUserId,
      });

      // Remove user from participants in store
      useParticipantStore.getState().removeParticipant(conversationId, currentUserId);

      // Since the user left, remove conversation from their view
      store.removeConversation(conversationId);

      logger.info(`User ${currentUserId} left conversation ${conversationId}`);
      return {};
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'leaveConversation');
      store.setError(chatError);
      return { error: chatError };
    }
  }

  /**
   * Update a group conversation topic
   */
  public async updateGroupTopic(
    conversationId: string,
    topic: string
  ): Promise<{ error?: ChatError }> {
    const store = useConversationStore.getState();

    if (!conversationId || !topic) {
      throw new AcsChatError('INVALID_INPUT', 'conversationId and topic are required.', {
        operation: 'updateGroupTopic',
      });
    }

    store.setError(null);

    try {
      const config = this.chatServiceRef?.getConfig();

      if (config?.backendUrl) {
        await fetchBackend(config, `/api/conversations/group/${conversationId}/topic`, {
          method: 'PATCH',
          body: JSON.stringify({ topic }),
        });
      } else {
        const chatClient = this.getChatClient();
        const threadClient = chatClient.getChatThreadClient(conversationId);
        await threadClient.updateTopic(topic);
      }

      store.updateConversation(conversationId, { name: topic });
      return {};
    } catch (error) {
      const chatError = mapAcsErrorToChatError(error, 'updateGroupTopic');
      store.setError(chatError);
      return { error: chatError };
    }
  }

  /**
   * Join an existing room to get threadId and other details.
   */
  public async joinRoom(conversationId: string): Promise<JoinRoomResponse | undefined> {
    const config = this.chatServiceRef?.getConfig();
    if (!config) {
      throw new AcsChatError('INVALID_INPUT', 'Chat config not initialized', {
        operation: 'joinRoom',
      });
    }

    try {
      const res = await fetchBackend<JoinRoomResponse>(
        config,
        `/api/chat/join-room/${conversationId}`,
        {
          method: 'POST',
          body: '',
        }
      );
      return res?.data;
    } catch (e) {
      const chatError = mapAcsErrorToChatError(e, 'joinRoom', { conversationId });
      throw chatError;
    }
  }
}

/**
 * Singleton instance of ConversationService for global application usage.
 */
export const conversationService = new ConversationService();
