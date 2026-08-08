import React, { useCallback, useMemo, useEffect } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../MessageList';
import { ConversationFooter } from './ConversationFooter';
import { ConversationHeader } from '../ConversationHeader';
import styles from './ConversationView.module.scss';

export interface ConversationViewProps {
  conversationId?: string;
}

export const ConversationView: React.FC<ConversationViewProps> = React.memo(({ conversationId }) => {
  const { activeConversation, conversations, joinRoom } = useConversations();
  const { currentUser } = useChat();

  const idToUse = conversationId || activeConversation?.id;
  
  const conversation = useMemo(() => {
    return conversations.find((c) => c.id === idToUse);
  }, [conversations, idToUse]);

  useEffect(() => {
    const joinId = conversation?.conversationId || idToUse;
    if (joinId) {
      joinRoom(joinId).catch((err) => {
        console.warn('Failed to join room', err);
      });
    }
  }, [idToUse, joinRoom, conversation?.conversationId]);

  // Call hooks unconditionally
  const {
    messages,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    sendMessage,
  } = useMessages(idToUse || '');

  const handleSend = useCallback(
    (content: string) => {
      if (idToUse) {
        sendMessage(content);
      }
    },
    [idToUse, sendMessage]
  );

  const handleTyping = useCallback(() => {
    // Integration point for typing indicators
  }, []);

  if (!idToUse || !conversation) {
    return null;
  }

  return (
    <div className={styles.container}>
      <ConversationHeader conversation={conversation} />
      
      <div className={styles.messageListWrapper}>
        <MessageList
          messages={messages}
          currentUserId={currentUser?.id || ''}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>

        <ConversationFooter 
          onSend={handleSend} 
          onTyping={handleTyping} 
          disabled={loading}
        />
    </div>
  );
});
