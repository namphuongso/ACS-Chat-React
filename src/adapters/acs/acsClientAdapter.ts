import { ChatClient, ChatThreadClient } from '@azure/communication-chat';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { AcsChatError } from '../../types/errors.types';

/**
 * Adapter wrapping ACS ChatClient initialization and lifecycle operations.
 */
export class AcsClientAdapter {
  private chatClient: ChatClient;
  private isNotificationsStarted = false;

  constructor(endpoint: string, credential: AzureCommunicationTokenCredential) {
    this.validateEndpoint(endpoint);
    this.validateCredential(credential);

    try {
      this.chatClient = new ChatClient(endpoint, credential);
    } catch (error) {
      if (error instanceof AcsChatError) {
        throw error;
      }
      throw new AcsChatError('INVALID_INPUT', 'Failed to initialize ChatClient.', {
        cause: error,
        operation: 'constructor',
      });
    }
  }

  /**
   * Validate the endpoint string format.
   */
  private validateEndpoint(endpoint: string): void {
    if (!endpoint || typeof endpoint !== 'string' || endpoint.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Endpoint is required and must be a non-empty string.', {
        operation: 'constructor',
      });
    }

    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Invalid URL protocol');
      }
    } catch (error) {
      throw new AcsChatError('INVALID_INPUT', `Invalid endpoint URL: "${endpoint}".`, {
        cause: error,
        operation: 'constructor',
      });
    }
  }

  /**
   * Validate the Azure Communication Token Credential.
   */
  private validateCredential(credential: AzureCommunicationTokenCredential): void {
    if (!credential || typeof (credential as unknown as { getToken: unknown })?.getToken !== 'function') {
      throw new AcsChatError('AUTH_TOKEN_INVALID', 'Invalid or missing communication token credential.', {
        operation: 'constructor',
      });
    }
  }

  /**
   * Get the underlying ACS ChatClient instance.
   */
  public getChatClient(): ChatClient {
    return this.chatClient;
  }

  /**
   * Create a ChatThreadClient for a specific thread ID.
   */
  public createThreadClient(threadId: string): ChatThreadClient {
    if (!threadId || typeof threadId !== 'string' || threadId.trim() === '') {
      throw new AcsChatError('INVALID_INPUT', 'Thread ID is required and must be a non-empty string.', {
        operation: 'createThreadClient',
      });
    }

    try {
      return this.chatClient.getChatThreadClient(threadId);
    } catch (error) {
      if (error instanceof AcsChatError) {
        throw error;
      }
      throw new AcsChatError('INVALID_INPUT', `Failed to create ChatThreadClient for threadId: "${threadId}".`, {
        cause: error,
        operation: 'createThreadClient',
      });
    }
  }

  /**
   * Start receiving real-time notifications from ACS.
   */
  public async startRealtimeNotifications(): Promise<void> {
    try {
      await this.chatClient.startRealtimeNotifications();
      this.isNotificationsStarted = true;
    } catch (error) {
      throw new AcsChatError('CONNECTION_FAILED', 'Failed to start realtime notifications.', {
        cause: error,
        operation: 'startRealtimeNotifications',
      });
    }
  }

  /**
   * Stop receiving real-time notifications from ACS.
   */
  public async stopRealtimeNotifications(): Promise<void> {
    try {
      await this.chatClient.stopRealtimeNotifications();
    } catch (error) {
      throw new AcsChatError('CONNECTION_FAILED', 'Failed to stop realtime notifications.', {
        cause: error,
        operation: 'stopRealtimeNotifications',
      });
    } finally {
      this.isNotificationsStarted = false;
    }
  }

  /**
   * Dispose and cleanup resources.
   */
  public dispose(): void {
    if (this.isNotificationsStarted) {
      this.stopRealtimeNotifications().catch(() => {
        // Silently catch errors during dispose cleanup
      });
    }
    this.isNotificationsStarted = false;
  }
}
