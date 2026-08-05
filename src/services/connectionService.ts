import { useChatStore } from '../store/chatStore';
import { useConversationStore } from '../store/conversationStore';
import { chatService } from './chatService';
import { conversationService } from './conversationService';
import { messageService } from './messageService';
import { readReceiptService } from './readReceiptService';
import type { ReconnectPolicy } from '../types/config.types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  maxRetries: 10,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export class ConnectionService {
  private networkListenersBound = false;
  private reconnecting = false;
  private chatServiceUnsubscribe?: () => void;

  private handleOnline = () => {
    // Attempt reconnect when network is restored
    if (!this.reconnecting && useChatStore.getState().connectionState !== 'connected') {
      const config = chatService.getConfig();
      this.reconnect(config?.reconnectPolicy);
    }
  };

  private handleOffline = () => {
    useChatStore.getState().setConnectionState('disconnected');
    // We don't attempt reconnect while offline
  };

  public setupNetworkListeners(): void {
    if (this.networkListenersBound) return;
    
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    this.chatServiceUnsubscribe = chatService.subscribe((event) => {
      if (event.type === 'connection:disconnected' && !this.reconnecting) {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        if (isOnline) {
          const config = chatService.getConfig();
          this.reconnect(config?.reconnectPolicy).catch(console.error);
        }
      }
    });

    this.networkListenersBound = true;
  }

  public teardownNetworkListeners(): void {
    if (!this.networkListenersBound) return;

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    if (this.chatServiceUnsubscribe) {
      this.chatServiceUnsubscribe();
      this.chatServiceUnsubscribe = undefined;
    }

    this.networkListenersBound = false;
  }

  public async reconnect(policy?: ReconnectPolicy): Promise<void> {
    if (this.reconnecting) return;

    const chatStore = useChatStore.getState();
    const chatConfig = chatService.getConfig();
    
    if (!chatConfig) {
      chatStore.setConnectionState('error');
      return;
    }

    const activePolicy = policy || chatConfig.reconnectPolicy || DEFAULT_RECONNECT_POLICY;
    
    let attempt = 0;
    let delay = activePolicy.initialDelayMs;
    
    this.reconnecting = true;

    while (attempt < activePolicy.maxRetries) {
      chatStore.setConnectionState('reconnecting');
      attempt++;
      
      try {
        // Attempt to restart realtime notifications
        const clientAdapter = chatService.getClientAdapter();
        await clientAdapter.startRealtimeNotifications();

        // Ensure subscriptions are active
        const eventAdapter = chatService.getEventAdapter();
        eventAdapter.subscribeAll();

        // Refresh conversation list to catch any new conversations while disconnected
        await conversationService.loadConversations();
        
        // Resync active conversation if we have one
        const convStore = useConversationStore.getState();
        const activeConversationId = convStore.activeConversationId;
        if (activeConversationId) {
          await messageService.loadMessages(activeConversationId);
        }

        // Background resync for inactive conversations
        const conversations = convStore.conversations;
        const resyncPromises = Object.keys(conversations).map(async (convId) => {
          // Sync read receipts for all conversations
          try {
            await readReceiptService.loadReadReceipts(convId);
          } catch (err) {
            console.warn(`[ConnectionService] Failed to load read receipts for ${convId}:`, err);
          }

          // Sync latest message only for inactive conversations (active already loaded all msgs)
          if (convId !== activeConversationId) {
            try {
              const res = await messageService.loadLatestMessage(convId);
              if (res.message) {
                useConversationStore.getState().updateLastMessage(convId, res.message);
              }
            } catch (err) {
              console.warn(`[ConnectionService] Failed to load latest message for ${convId}:`, err);
            }
          }
        });

        // Fire and forget to not block the connected state
        Promise.allSettled(resyncPromises).catch(console.error);

        chatStore.setConnectionState('connected');
        this.reconnecting = false;
        return;
      } catch (error) {
        console.error(`Reconnect attempt ${attempt} failed:`, error);
        delay = Math.min(delay * activePolicy.backoffMultiplier, activePolicy.maxDelayMs);
        await sleep(delay);
      }
    }
    
    chatStore.setConnectionState('error');
    this.reconnecting = false;
  }
}

export const connectionService = new ConnectionService();
