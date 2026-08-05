import { useState, useCallback, useMemo } from 'react';
import { useParticipantStore } from '../store/participantStore';
import { selectParticipantsByConversation } from '../store/selectors';
import { participantService } from '../services/participantService';
import type { AddParticipantOptions } from '../types/participant.types';
import type { AcsChatError } from '../types/errors.types';

/**
 * Hook to manage participants for a specific conversation.
 * @param {string} conversationId - The ID of the conversation
 * @returns {Object} Participant state and methods
 * @property {ChatParticipant[]} participants - The list of participants in the conversation
 * @property {boolean} loading - True if participants are currently loading
 * @property {AcsChatError | null} error - Any error that occurred during participant operations
 * @property {Function} addParticipant - Method to add a new participant to the conversation
 * @property {Function} removeParticipant - Method to remove a participant from the conversation
 * @property {Function} loadParticipants - Method to fetch the latest participants list
 */
export const useParticipants = (conversationId: string) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AcsChatError | null>(null);

  const participants = useParticipantStore((state) => 
    selectParticipantsByConversation(state, conversationId)
  );

  const loadParticipants = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      await participantService.loadParticipants(conversationId);
    } catch (err) {
      setError(err as AcsChatError);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const addParticipant = useCallback(async (options: AddParticipantOptions) => {
    if (!conversationId) return;
    setError(null);
    try {
      await participantService.addParticipant(conversationId, options);
    } catch (err) {
      setError(err as AcsChatError);
      throw err;
    }
  }, [conversationId]);

  const removeParticipant = useCallback(async (userId: string) => {
    if (!conversationId) return;
    setError(null);
    try {
      await participantService.removeParticipant(conversationId, userId);
    } catch (err) {
      setError(err as AcsChatError);
      throw err;
    }
  }, [conversationId]);

  return useMemo(() => ({
    participants,
    loading,
    error,
    addParticipant,
    removeParticipant,
    loadParticipants,
  }), [participants, loading, error, addParticipant, removeParticipant, loadParticipants]);
};
