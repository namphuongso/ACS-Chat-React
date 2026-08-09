import React, { useCallback, useMemo, useEffect } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useChat } from '../../hooks/useChat';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { MessageList } from '../MessageList';
import { ConversationFooter } from './ConversationFooter';
import { ConversationHeader } from '../ConversationHeader';
import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';
import styles from './ConversationView.module.scss';

export interface ConversationViewProps {
  conversationId?: string;
}

export const ConversationView: React.FC<ConversationViewProps> = React.memo(
  ({ conversationId }) => {
    const { activeConversation, conversations } = useConversations();
    const { currentUser, connectionState } = useChat();

    const idToUse = conversationId || activeConversation?.id;

    const conversation = useMemo(() => {
      return conversations.find((c) => c.id === idToUse);
    }, [conversations, idToUse]);

    const { roomMembers, roomType } = useRoomMembers(conversation);

    // Call hooks unconditionally
    const { messages, loading, loadingMore, hasMore, loadMore, loadMessages, sendMessage } =
      useMessages(idToUse || '');

    useEffect(() => {
      if (idToUse && messages.length === 0 && !loading) {
        loadMessages().catch((err) => {
          console.warn('Failed to load messages', err);
        });
      }
    }, [idToUse, loadMessages, messages.length, loading]);

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
      if (loading && conversations.length === 0) {
        return <LoadingState />;
      }
      return (
        <EmptyState type="no-conversations" message="Chọn một cuộc hội thoại để bắt đầu nhắn tin" />
      );
    }

    return (
      <div className={styles.container}>
        <ConversationHeader conversation={conversation} />

        <div className={styles.messageListWrapper}>
          <MessageList
            key={idToUse}
            messages={messages}
            currentUserId={currentUser?.id || ''}
            loading={loading}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            roomMembers={roomMembers}
            roomType={roomType || conversation.type}
          />
        </div>

        <ConversationFooter
          onSend={handleSend}
          onTyping={handleTyping}
          disabled={loading || connectionState !== 'connected'}
        />
      </div>
    );
  }
);
