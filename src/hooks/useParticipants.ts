import { useState, useCallback } from 'react';
import { useParticipantStore } from '../store/participantStore';
import { selectParticipantsByConversation } from '../store/selectors';
import { participantService } from '../services/participantService';
import type { AddParticipantOptions } from '../types/participant.types';
import type { AcsChatError } from '../types/errors.types';

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

  return {
    participants,
    loading,
    error,
    addParticipant,
    removeParticipant,
    loadParticipants,
  };
};
