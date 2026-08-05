import { chatService } from './chatService';
import { useParticipantStore } from '../store/participantStore';
import { mapAcsParticipantToParticipant, mapAcsErrorToChatError } from '../adapters/acs/acsMappers';
import type { ConversationParticipant, AddParticipantOptions } from '../types/participant.types';

export class ParticipantService {
  /**
   * Load all participants for a given conversation.
   * Updates the store and returns the list.
   */
  public async loadParticipants(conversationId: string): Promise<ConversationParticipant[]> {
    try {
      const client = chatService.getChatClient().getChatThreadClient(conversationId);
      const iterator = client.listParticipants();
      const participants: ConversationParticipant[] = [];

      for await (const acsPartPage of iterator.byPage()) {
        for (const p of acsPartPage) {
          participants.push(mapAcsParticipantToParticipant(p));
        }
      }

      useParticipantStore.getState().setParticipants(conversationId, participants);
      return participants;
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'loadParticipants', { conversationId });
    }
  }

  /**
   * Add a participant to a conversation.
   */
  public async addParticipant(conversationId: string, options: AddParticipantOptions): Promise<void> {
    try {
      const client = chatService.getChatClient().getChatThreadClient(conversationId);
      
      const acsParticipant = {
        id: { communicationUserId: options.userId },
        displayName: options.displayName,
        shareHistoryTime: options.shareHistoryTime
      };

      await client.addParticipants({
        participants: [acsParticipant]
      });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'addParticipant', { conversationId });
    }
  }

  /**
   * Remove a participant from a conversation.
   */
  public async removeParticipant(conversationId: string, userId: string): Promise<void> {
    try {
      const client = chatService.getChatClient().getChatThreadClient(conversationId);
      
      await client.removeParticipant({ communicationUserId: userId });
    } catch (error) {
      throw mapAcsErrorToChatError(error, 'removeParticipant', { conversationId });
    }
  }
}

export const participantService = new ParticipantService();
