import { useState, useCallback, useMemo } from 'react';
import type { PinnedMessage, ChatMessage } from '../../types/message.types';
import type { FilePreviewItem } from '../FilePreviewModal';
import { resolveMessageFileMetadata } from '../../utils/fileUtils';
import { MAX_PINNED_MESSAGES } from '../../constants';

export interface UseConversationActionsOptions {
  pinnedMessageIds?: Set<string> | string[];
  pinnedMessagesFromStore?: PinnedMessage[];
  messages: ChatMessage[];
  pinMessage: (messageId: string, pin: boolean) => Promise<{ error?: unknown }>;
  editMessage: (messageId: string, newContent: string) => void;
  deleteMessage: (messageId: string) => void;
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
  disableInternalPreview?: boolean;
}

export function useConversationActions(options: UseConversationActionsOptions) {
  const {
    pinnedMessageIds: propPinnedMessageIds,
    pinnedMessagesFromStore,
    messages,
    pinMessage,
    editMessage,
    deleteMessage,
    onOpenAttachment,
    disableInternalPreview,
  } = options;

  // ── Pinned message IDs ──────────────────────────────────────
  const effectivePinnedMessageIds = useMemo(() => {
    if (propPinnedMessageIds) return propPinnedMessageIds;
    if (pinnedMessagesFromStore) {
      return new Set(pinnedMessagesFromStore.map((m) => m.messageId));
    }
    return undefined;
  }, [propPinnedMessageIds, pinnedMessagesFromStore]);

  // ── Build PinnedMessage objects for the dialog ──────────────
  const effectivePinnedMessages = useMemo((): PinnedMessage[] => {
    if (pinnedMessagesFromStore && pinnedMessagesFromStore.length > 0) {
      return pinnedMessagesFromStore;
    }
    if (effectivePinnedMessageIds) {
      const idList =
        effectivePinnedMessageIds instanceof Set
          ? Array.from(effectivePinnedMessageIds)
          : effectivePinnedMessageIds;
      return idList.map((id) => {
        const found = messages.find((m) => m.id === id);
        const fileMeta = resolveMessageFileMetadata({
          meta: found?.metadata,
          attachments: found?.attachments,
          content: found?.content,
          type: found?.type,
        });

        return {
          messageId: id,
          type: fileMeta.resolvedType,
          content: found?.content || fileMeta.fileName || '',
          createdDate: found?.createdAt ? new Date(found.createdAt).toISOString() : '',
          creator: found?.senderDisplayName || found?.sender?.displayName || '',
          attachmentType: fileMeta.mimeType,
          attachmentUrl: fileMeta.url,
          thumbUrl: fileMeta.thumbUrl || (fileMeta.resolvedType === 'image' ? fileMeta.url : ''),
        };
      });
    }
    return [];
  }, [pinnedMessagesFromStore, effectivePinnedMessageIds, messages]);

  // ── Edit dialog state ───────────────────────────────────────
  const [editDialog, setEditDialog] = useState({
    isOpen: false,
    messageId: '',
    initialContent: '',
  });

  const handleEditMessage = useCallback(
    (messageId: string) => {
      const message = messages.find((m) => m.id === messageId);
      if (!message) return;

      const contentToEdit =
        message.type === 'html' ? message.content.replace(/<[^>]*>?/gm, '') : message.content;

      setEditDialog({
        isOpen: true,
        messageId,
        initialContent: contentToEdit,
      });
    },
    [messages]
  );

  const handleSaveEdit = useCallback(
    (newContent: string) => {
      if (editDialog.messageId) {
        editMessage(editDialog.messageId, newContent);
      }
      setEditDialog({ isOpen: false, messageId: '', initialContent: '' });
    },
    [editDialog.messageId, editMessage]
  );

  const handleCancelEdit = useCallback(() => {
    setEditDialog({ isOpen: false, messageId: '', initialContent: '' });
  }, []);

  // ── Delete dialog state ─────────────────────────────────────
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    messageId: '',
  });

  const handleDeleteMessage = useCallback((messageId: string) => {
    setDeleteDialog({ isOpen: true, messageId });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteDialog.messageId) {
      deleteMessage(deleteDialog.messageId);
    }
    setDeleteDialog({ isOpen: false, messageId: '' });
  }, [deleteDialog.messageId, deleteMessage]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ isOpen: false, messageId: '' });
  }, []);

  // ── Pin replace dialog state ────────────────────────────────
  const [pinReplaceDialog, setPinReplaceDialog] = useState<{
    isOpen: boolean;
    candidateId: string;
  }>({ isOpen: false, candidateId: '' });

  const handlePinReplace = useCallback(
    async (selectedId: string) => {
      const candidateId = pinReplaceDialog.candidateId;
      if (!candidateId || !selectedId) return;

      const unpinResult = await pinMessage(selectedId, false);
      if (unpinResult?.error) return;

      const pinResult = await pinMessage(candidateId, true);
      if (pinResult?.error) {
        await pinMessage(selectedId, true);
        return;
      }

      setPinReplaceDialog({ isOpen: false, candidateId: '' });
    },
    [pinMessage, pinReplaceDialog.candidateId]
  );

  const handleCancelPinReplace = useCallback(() => {
    setPinReplaceDialog({ isOpen: false, candidateId: '' });
  }, []);

  const handlePinMessage = useCallback(
    (messageId: string, pin: boolean) => {
      if (pin) {
        const currentCount =
          (pinnedMessagesFromStore?.length ?? 0) ||
          (effectivePinnedMessageIds instanceof Set
            ? effectivePinnedMessageIds.size
            : Array.isArray(effectivePinnedMessageIds)
              ? effectivePinnedMessageIds.length
              : 0);
        const alreadyPinned =
          effectivePinnedMessageIds instanceof Set
            ? effectivePinnedMessageIds.has(messageId)
            : Array.isArray(effectivePinnedMessageIds)
              ? effectivePinnedMessageIds.includes(messageId)
              : false;
        if (currentCount >= MAX_PINNED_MESSAGES && !alreadyPinned) {
          setPinReplaceDialog({ isOpen: true, candidateId: messageId });
          return;
        }
      }
      pinMessage(messageId, pin);
    },
    [pinMessage, pinnedMessagesFromStore, effectivePinnedMessageIds]
  );

  // ── File preview state ──────────────────────────────────────
  const [previewFile, setPreviewFile] = useState<FilePreviewItem | null>(null);

  const handleOpenAttachment = useCallback(
    (url: string, fileName?: string, metadata?: FilePreviewItem) => {
      if (onOpenAttachment) {
        if (metadata !== undefined) {
          onOpenAttachment(url, fileName, metadata);
        } else {
          onOpenAttachment(url, fileName);
        }
      }
      if (disableInternalPreview) {
        return;
      }
      const resolvedName =
        fileName ||
        metadata?.fileName ||
        url.split('?')[0].split('#')[0].split('/').pop() ||
        'file';

      setPreviewFile({
        url,
        fileName: resolvedName,
        fileSize: metadata?.fileSize,
        mimeType: metadata?.mimeType,
        senderName: metadata?.senderName,
        senderAvatarUrl: metadata?.senderAvatarUrl,
        sentAt: metadata?.sentAt,
      });
    },
    [onOpenAttachment, disableInternalPreview]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  return {
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
  };
}
