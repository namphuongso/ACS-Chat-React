import React, { useCallback, useMemo, useEffect } from 'react';
import type { SendMessageOptions } from '../../types/message.types';
import { useConversations } from '../../hooks/useConversations';
import { useMessages } from '../../hooks/useMessages';
import { useChat } from '../../hooks/useChat';
import { useChatStore } from '../../store/chatStore';
import { useMessageStore } from '../../store/messageStore';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { MessageList } from '../MessageList';
import { ConversationFooter } from './ConversationFooter';
import { ConversationHeader } from '../ConversationHeader';
import { EmptyState } from '../EmptyState';
import { LoadingState } from '../LoadingState';
import { EditMessageDialog } from './EditMessageDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { PinReplaceDialog } from './PinReplaceDialog';
import { FilePreviewModal, type FilePreviewItem } from '../FilePreviewModal';
import { useConversationActions } from './useConversationActions';
import { useTranslation } from 'react-i18next';
import styles from './ConversationView.module.scss';

export interface ConversationViewProps {
  conversationId?: string;
  pinnedMessageIds?: Set<string> | string[];
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
  onDownloadAttachment?: (url: string, fileName?: string) => void;
  disableOfficeOnlineViewer?: boolean;
  disableInternalPreview?: boolean;
}

export const ConversationView: React.FC<ConversationViewProps> = React.memo(
  ({
    conversationId,
    pinnedMessageIds,
    onOpenAttachment,
    onDownloadAttachment,
    disableOfficeOnlineViewer,
    disableInternalPreview,
  }) => {
    const { activeConversation, conversations } = useConversations();
    const { currentUser, connectionState } = useChat();
    const setIsSearching = useChatStore((state) => state.setIsSearching);
    const setSearchTerm = useChatStore((state) => state.setSearchTerm);
    const { t } = useTranslation();

    const idToUse = conversationId || activeConversation?.id;

    const conversation = useMemo(() => {
      if (!idToUse) return undefined;
      return (
        conversations.find(
          (c) =>
            c.id === idToUse ||
            c.conversationId === idToUse ||
            (c as unknown as Record<string, unknown>).threadId === idToUse ||
            (c as unknown as Record<string, unknown>).roomId === idToUse
        ) || activeConversation
      );
    }, [conversations, idToUse, activeConversation]);

    const { roomMembers, roomType } = useRoomMembers(conversation);

    const pinnedMessagesFromStore = useMessageStore((state) =>
      idToUse ? state.messagesByConversation[idToUse]?.pinnedMessages : undefined
    );

    // Call hooks unconditionally
    const {
      messages,
      loading,
      loadingMore,
      hasMore,
      hasFetched,
      loadMore,
      loadMessages,
      sendMessage,
      editMessage,
      deleteMessage,
      pinMessage,
      jumpToMessage,
    } = useMessages(idToUse || '');

    const {
      effectivePinnedMessageIds,
      effectivePinnedMessages,
      editDialog,
      handleEditMessage,
      handleSaveEdit,
      handleCancelEdit,
      deleteDialog,
      handleDeleteMessage,
      handleConfirmDelete,
      handleCancelDelete,
      pinReplaceDialog,
      handlePinReplace,
      handleCancelPinReplace,
      handlePinMessage,
      previewFile,
      handleOpenAttachment,
      handleClosePreview,
    } = useConversationActions({
      pinnedMessageIds,
      pinnedMessagesFromStore,
      messages,
      pinMessage,
      editMessage,
      deleteMessage,
      onOpenAttachment,
      disableInternalPreview,
    });

    useEffect(() => {
      if (idToUse && !hasFetched && !loading) {
        loadMessages().catch((err) => {
          console.warn('Failed to load messages', err);
        });
      }
    }, [idToUse, loadMessages, hasFetched, loading]);

    const handleSend = useCallback(
      (content: string, options?: SendMessageOptions) => {
        if (idToUse) {
          let senderDisplayName = currentUser?.displayName;
          if ((!senderDisplayName || senderDisplayName === 'Unknown') && currentUser?.id) {
            const member = roomMembers?.find((m) => m.cui === currentUser.id);
            if (member && member.contactName) {
              senderDisplayName = member.contactName;
            }
          }

          let metadata = options?.metadata;
          if (options?.type === 'html') {
            metadata = {
              ...metadata,
              type: 'html',
            };
          }

          sendMessage(content, { senderDisplayName, ...options, metadata });
          setIsSearching(false);
          setSearchTerm('');
        }
      },
      [idToUse, sendMessage, currentUser, roomMembers, setIsSearching, setSearchTerm]
    );

    const handleTyping = useCallback(() => {
      // Integration point for typing indicators
    }, []);

    if (!idToUse || !conversation) {
      if (loading && conversations.length === 0) {
        return <LoadingState />;
      }
      return <EmptyState type="no-conversations" message={t('chat.selectConversation')} />;
    }

    return (
      <div className={styles.container}>
        <ConversationHeader conversation={conversation} />

        <PinnedMessageBanner
          conversationId={idToUse}
          backendConversationId={conversation.conversationId || conversation.id}
          pinnedMessageIds={effectivePinnedMessageIds}
          isGroup={roomType === 'group' || conversation.type === 'group'}
          onUnpinMessage={handlePinMessage}
          onJumpToMessage={jumpToMessage}
        />

        <div className={styles.messageListWrapper}>
          <MessageList
            key={idToUse}
            conversationId={idToUse}
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
            onPinMessage={handlePinMessage}
            pinnedMessageIds={effectivePinnedMessageIds}
            onOpenAttachment={handleOpenAttachment}
            onDownloadAttachment={onDownloadAttachment}
          />
        </div>

        <ConversationFooter
          key={idToUse}
          conversationId={idToUse}
          onSend={handleSend}
          onTyping={handleTyping}
          disabled={loading || connectionState !== 'connected'}
          autoFocus={true}
        />

        <EditMessageDialog
          isOpen={editDialog.isOpen}
          initialContent={editDialog.initialContent}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />

        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          title={t('chat.deleteMessage')}
          message={t('chat.confirmDeleteMessage')}
          confirmText={t('chat.delete')}
          cancelText={t('chat.cancel')}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />

        <PinReplaceDialog
          isOpen={pinReplaceDialog.isOpen}
          pinnedMessages={effectivePinnedMessages}
          onReplace={handlePinReplace}
          onCancel={handleCancelPinReplace}
        />

        <FilePreviewModal
          isOpen={Boolean(previewFile)}
          file={previewFile}
          onClose={handleClosePreview}
          onDownload={onDownloadAttachment}
          disableOfficeOnlineViewer={disableOfficeOnlineViewer}
        />
      </div>
    );
  }
);
