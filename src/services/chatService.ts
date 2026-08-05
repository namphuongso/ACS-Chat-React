import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import type { ChatClient } from '@azure/communication-chat';
import { AcsClientAdapter } from '../adapters/acs/acsClientAdapter';
import { AcsEventAdapter } from '../adapters/acs/acsEventAdapter';
import { useChatStore } from '../store/chatStore';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useParticipantStore } from '../store/participantStore';
import type { ChatConfig } from '../types/config.types';
import type { ChatDomainEvent } from '../types/events.types';
import type { ChatMessage } from '../types/message.types';
import type { ConversationParticipant } from '../types/participant.types';
import type { GroupConversation } from '../types/conversation.types';
import type { ReadReceipt } from '../models/ReadReceipt';
import type { ChatUser } from '../types/chat.types';
import { AcsChatError } from '../types/errors.types';
import { unstable_batchedUpdates } from 'react-dom';

export type EventListenerFn = (event: ChatDomainEvent) => void;

/**
 * Core orchestration service for managing ACS Chat client lifecycle,
 * initializing adapters, subscribing to real-time events, and routing events to Zustand stores.
 */
export class ChatService {
  private clientAdapter: AcsClientAdapter | null = null;
  private eventAdapter: AcsEventAdapter | null = null;
  private config: ChatConfig | null = null;
  private initialized = false;
  private isInitializingFlag = false;
  private listeners = new Set<EventListenerFn>();

  /**
   * Initialize ACS Chat client, start real-time notifications, and subscribe to events.
   */
  public async initialize(config: ChatConfig): Promise<void> {
    this.validateConfig(config);

    if (this.isInitializingFlag) {
      throw new AcsChatError(
        'INVALID_INPUT',
        'ChatService initialization is already in progress.',
        { operation: 'initialize' }
      );
    }

    if (this.initialized) {
      await this.dispose();
    }

    this.isInitializingFlag = true;
    const chatStore = useChatStore.getState();
    chatStore.setInitializing(true);
    chatStore.setInitError(null);
    chatStore.setConnectionState('connecting');

    try {
      let credential: AzureCommunicationTokenCredential;
      if (typeof config.tokenRefresher === 'function') {
        credential = new AzureCommunicationTokenCredential({
          tokenRefresher: async () => {
            try {
              const newToken = await config.tokenRefresher();
              this.handleDomainEvent({
                type: 'token:refreshed',
                conversationId: '',
                timestamp: new Date(),
                payload: { token: newToken },
              });
              return newToken;
            } catch (error) {
              this.handleDomainEvent({
                type: 'token:refreshFailed',
                conversationId: '',
                timestamp: new Date(),
                payload: { error },
              });
              throw error;
            }
          },
          refreshProactively: true,
          token: config.token,
        });
      } else {
        credential = new AzureCommunicationTokenCredential(config.token);
      }

      this.clientAdapter = new AcsClientAdapter(config.endpoint, credential);
      this.eventAdapter = new AcsEventAdapter(
        this.clientAdapter.getChatClient(),
        (event: ChatDomainEvent) => this.handleDomainEvent(event)
      );

      await this.clientAdapter.startRealtimeNotifications();
      this.eventAdapter.subscribeAll();

      chatStore.setCurrentUser({
        id: config.userId,
        displayName: config.displayName,
      });
      chatStore.setConnectionState('connected');
      chatStore.setInitializing(false);

      this.config = config;
      this.initialized = true;
    } catch (error) {
      if (this.eventAdapter) {
        try {
          this.eventAdapter.unsubscribeAll();
        } catch {
          // Silent catch on error cleanup
        }
        this.eventAdapter = null;
      }

      if (this.clientAdapter) {
        try {
          this.clientAdapter.dispose();
        } catch {
          // Silent catch on error cleanup
        }
        this.clientAdapter = null;
      }

      const chatError =
        error instanceof AcsChatError
          ? error
          : new AcsChatError(
              'CONNECTION_FAILED',
              error instanceof Error ? error.message : 'Initialization failed',
              { cause: error, operation: 'initialize' }
            );

      chatStore.setInitError(chatError);
      chatStore.setConnectionState('error');
      chatStore.setInitializing(false);
      this.initialized = false;

      throw chatError;
    } finally {
      this.isInitializingFlag = false;
    }
  }

  /**
   * Stop notifications, unsubscribe events, dispose adapters, and reset all store states.
   */
  public async dispose(): Promise<void> {
    useChatStore.getState().setConnectionState('disconnected');

    if (this.eventAdapter) {
      try {
        this.eventAdapter.unsubscribeAll();
      } catch {
        // Ignore error during cleanup
      }
      this.eventAdapter = null;
    }

    if (this.clientAdapter) {
      try {
        await this.clientAdapter.stopRealtimeNotifications();
      } catch {
        // Ignore error during cleanup
      }
      try {
        this.clientAdapter.dispose();
      } catch {
        // Ignore error during cleanup
      }
      this.clientAdapter = null;
    }

    this.config = null;
    this.initialized = false;
    this.listeners.clear();

    useChatStore.getState().reset();
    useConversationStore.getState().reset();
    useMessageStore.getState().reset();
    useParticipantStore.getState().reset();
  }

  /**
   * Check whether ChatService has completed initialization.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the initialized AcsClientAdapter instance.
   */
  public getClientAdapter(): AcsClientAdapter {
    if (!this.clientAdapter || !this.initialized) {
      throw new AcsChatError('INVALID_INPUT', 'ChatService is not initialized.', {
        operation: 'getClientAdapter',
      });
    }
    return this.clientAdapter;
  }

  /**
   * Get the initialized AcsEventAdapter instance.
   */
  public getEventAdapter(): AcsEventAdapter {
    if (!this.eventAdapter || !this.initialized) {
      throw new AcsChatError('INVALID_INPUT', 'ChatService is not initialized.', {
        operation: 'getEventAdapter',
      });
    }
    return this.eventAdapter;
  }

  /**
   * Get the underlying ACS ChatClient instance.
   */
  public getChatClient(): ChatClient {
    return this.getClientAdapter().getChatClient();
  }

  /**
   * Get current ChatConfig used during initialization.
   */
  public getConfig(): ChatConfig | null {
    return this.config;
  }

  /**
   * Subscribe a listener callback to normalized domain events.
   */
  public subscribe(listener: EventListenerFn): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Handle incoming domain event and route it to the appropriate Zustand store actions.
   */
  public handleDomainEvent(event: ChatDomainEvent): void {
    unstable_batchedUpdates(() => {
      this.processDomainEvent(event);
    });
  }

  private processDomainEvent(event: ChatDomainEvent): void {
    const chatStore = useChatStore.getState();
    const convStore = useConversationStore.getState();
    const msgStore = useMessageStore.getState();
    const partStore = useParticipantStore.getState();

    switch (event.type) {
      case 'message:received': {
        const msg = event.payload as ChatMessage;
        msgStore.addMessage(event.conversationId, msg);
        convStore.updateLastMessage(event.conversationId, msg);
        if (convStore.activeConversationId !== event.conversationId) {
          convStore.incrementUnreadCount(event.conversationId, 1);
        }
        if (msg.sender?.id) {
          partStore.removeTypingUser(event.conversationId, msg.sender.id);
        }
        break;
      }

      case 'message:edited': {
        const msg = event.payload as ChatMessage;
        msgStore.updateMessage(event.conversationId, msg.id, msg);
        const conv = convStore.conversations[event.conversationId];
        if (conv?.lastMessage?.id === msg.id) {
          convStore.updateConversation(event.conversationId, {
            lastMessage: msg,
          });
        }
        break;
      }

      case 'message:deleted': {
        const payload = event.payload as { id: string };
        msgStore.removeMessage(event.conversationId, payload.id);
        break;
      }

      case 'typing:started': {
        const payload = event.payload as { user: ChatUser };
        const currentUserId = chatStore.currentUser?.id;
        if (payload.user?.id && payload.user.id !== currentUserId) {
          partStore.setTypingUser(event.conversationId, payload.user);
        }
        break;
      }

      case 'readReceipt:received': {
        const receipt = event.payload as ReadReceipt;
        partStore.addReadReceipt(event.conversationId, receipt);
        break;
      }

      case 'conversation:created': {
        const payload = event.payload as {
          id: string;
          type?: 'group';
          name: string;
          createdAt: Date;
          metadata?: Record<string, string>;
          createdBy?: ChatUser;
          participants: ConversationParticipant[];
        };

        const groupConv: GroupConversation = {
          id: payload.id,
          type: 'group',
          name: payload.name || '',
          createdAt: payload.createdAt || new Date(),
          participants: payload.participants || [],
          unreadCount: 0,
          metadata: payload.metadata,
        };

        convStore.addConversation(groupConv);
        if (payload.participants?.length > 0) {
          partStore.setParticipants(payload.id, payload.participants);
        }
        break;
      }

      case 'conversation:deleted': {
        const payload = event.payload as { id: string };
        convStore.removeConversation(payload.id);
        break;
      }

      case 'conversation:updated': {
        const payload = event.payload as {
          id: string;
          name: string;
          metadata?: Record<string, string>;
          updatedAt: Date;
        };
        convStore.updateConversation(payload.id, {
          name: payload.name,
          metadata: payload.metadata,
          updatedAt: payload.updatedAt,
        });
        break;
      }

      case 'participant:added': {
        const payload = event.payload as { participants: ConversationParticipant[] };
        if (payload.participants?.length > 0) {
          partStore.addParticipants(event.conversationId, payload.participants);
        }
        break;
      }

      case 'participant:removed': {
        const payload = event.payload as { participants: ConversationParticipant[] };
        if (payload.participants?.length > 0) {
          for (const p of payload.participants) {
            partStore.removeParticipant(event.conversationId, p.id);
          }
        }
        break;
      }

      case 'connection:connected': {
        chatStore.setConnectionState('connected');
        break;
      }

      case 'connection:disconnected': {
        chatStore.setConnectionState('disconnected');
        break;
      }

      default:
        break;
    }

    // Broadcast to custom listeners
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        // Protect loop from listener exceptions
        console.error('Error in ChatService event listener:', err);
      }
    }
  }

  private validateConfig(config: ChatConfig): void {
    if (!config || typeof config !== 'object') {
      throw new AcsChatError('INVALID_INPUT', 'ChatConfig is required.', {
        operation: 'initialize',
      });
    }

    if (!config.endpoint || typeof config.endpoint !== 'string' || config.endpoint.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Endpoint is required in ChatConfig.', {
        operation: 'initialize',
      });
    }

    if (!config.userId || typeof config.userId !== 'string' || config.userId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'UserId is required in ChatConfig.', {
        operation: 'initialize',
      });
    }

    if (!config.token || typeof config.token !== 'string' || config.token.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Token is required in ChatConfig.', {
        operation: 'initialize',
      });
    }
  }
}

/**
 * Singleton instance of ChatService for global application usage.
 */
export const chatService = new ChatService();
