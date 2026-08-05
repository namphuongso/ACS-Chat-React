import React, { useCallback, useMemo } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useChat } from '../../hooks/useChat';
import { MessageList } from '../MessageList';
import { MessageInput } from '../MessageInput';
import styles from './ConversationView.module.scss';

export interface ConversationViewProps {
  conversationId?: string;
}

export const ConversationView: React.FC<ConversationViewProps> = ({ conversationId }) => {
  const { activeConversation, conversations } = useConversations();
  const { currentUser } = useChat();

  const idToUse = conversationId || activeConversation?.id;
  
  const conversation = useMemo(() => {
    return conversations.find((c) => c.id === idToUse);
  }, [conversations, idToUse]);

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
      <div className={styles.header}>
        {conversation.type === 'group' 
          ? conversation.name 
          : conversation.otherParticipant?.displayName || 'Direct Conversation'}
      </div>
      
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

      <div className={styles.inputWrapper}>
        <MessageInput 
          onSend={handleSend} 
          onTyping={handleTyping} 
          disabled={loading}
        />
      </div>
    </div>
  );
};
