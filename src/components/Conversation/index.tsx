import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useChat } from '../../hooks/useChat';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { MessageList } from '../MessageList';
import { ConversationFooter } from './ConversationFooter';
import { ConversationHeader } from '../ConversationHeader';
import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';
import { EditMessageDialog } from './EditMessageDialog';
import { ConfirmDialog } from './ConfirmDialog';
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
    const { messages, loading, loadingMore, hasMore, loadMore, loadMessages, sendMessage, editMessage, deleteMessage } =
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

    const [editDialog, setEditDialog] = useState({
      isOpen: false,
      messageId: '',
      initialContent: '',
    });

    const handleEditMessage = useCallback(
      (messageId: string) => {
        const message = messages.find((m) => m.id === messageId);
        if (!message) return;
        
        // Strip HTML if message is HTML type before prompting
        const contentToEdit = message.type === 'html' 
          ? message.content.replace(/<[^>]*>?/gm, '') 
          : message.content;

        setEditDialog({
          isOpen: true,
          messageId,
          initialContent: contentToEdit,
        });
      },
      [messages]
    );

    const handleSaveEdit = useCallback((newContent: string) => {
      if (editDialog.messageId) {
        editMessage(editDialog.messageId, newContent);
      }
      setEditDialog({ isOpen: false, messageId: '', initialContent: '' });
    }, [editDialog.messageId, editMessage]);

    const handleCancelEdit = useCallback(() => {
      setEditDialog({ isOpen: false, messageId: '', initialContent: '' });
    }, []);

    const [deleteDialog, setDeleteDialog] = useState({
      isOpen: false,
      messageId: '',
    });

    const handleDeleteMessage = useCallback(
      (messageId: string) => {
        setDeleteDialog({ isOpen: true, messageId });
      },
      []
    );

    const handleConfirmDelete = useCallback(() => {
      if (deleteDialog.messageId) {
        deleteMessage(deleteDialog.messageId);
      }
      setDeleteDialog({ isOpen: false, messageId: '' });
    }, [deleteDialog.messageId, deleteMessage]);

    const handleCancelDelete = useCallback(() => {
      setDeleteDialog({ isOpen: false, messageId: '' });
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
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
        </div>

        <ConversationFooter
          onSend={handleSend}
          onTyping={handleTyping}
          disabled={loading || connectionState !== 'connected'}
        />

        <EditMessageDialog
          isOpen={editDialog.isOpen}
          initialContent={editDialog.initialContent}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />

        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          title="Xoá tin nhắn"
          message="Bạn có chắc chắn muốn xoá tin nhắn này không? Hành động này không thể hoàn tác."
          confirmText="Xoá"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </div>
    );
  }
);
