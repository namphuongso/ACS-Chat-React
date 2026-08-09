import { useState, useEffect } from 'react';
import { useConversations } from './useConversations';
import type { Conversation } from '../models/Conversation';
import type { RoomMember } from '../types/participant.types';
import type { AcsChatError } from '../types/errors.types';

export const useRoomMembers = (conversation?: Conversation | null) => {
  const { joinRoom } = useConversations();
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [roomType, setRoomType] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<AcsChatError | null>(null);

  useEffect(() => {
    if (!conversation?.conversationId && !conversation?.id) return;

    const joinId = conversation.conversationId || conversation.id;

    if (joinId) {
      setLoading(true);
      setError(null);
      joinRoom(joinId)
        .then((res) => {
          if (res?.members) {
            setRoomMembers(res.members);
          }
          if (res?.roomType) {
            setRoomType(res.roomType);
          }
        })
        .catch((err: unknown) => {
          console.warn('Failed to join room', err);
          setError(err as AcsChatError);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [joinRoom, conversation?.conversationId, conversation?.id]);

  return { roomMembers, roomType, loading, error };
};
