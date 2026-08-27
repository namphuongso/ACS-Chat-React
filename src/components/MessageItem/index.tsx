import React, { ReactNode, useMemo } from 'react';
import type { ChatMessage, MessageStatus } from '../../types/message.types';
import { Avatar } from '../Avatar';
import { formatTime } from '../../utils/date';
import { normalizeFormattingHtml, sanitizeHtml } from '../../utils/htmlUtils';
import { isLargeImage, getImageMimeType } from '../../utils/imageUtils';
import { parseMessageFilesMetadata } from '../../utils/fileUtils';
import {
  containsUrl,
  extractUrls,
  extractUrlsFromHtml,
  isEmptyLinkPreview,
  linkifyHtml,
  parseLinkPreview,
} from '../../utils/linkUtils';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import { useTranslation } from 'react-i18next';
import styles from './MessageItem.module.scss';
import { LargeImageCard } from './LargeImageCard';
import { LinkPreviewCard } from './LinkPreviewCard';
import { VideoCard } from './VideoCard';
import { SystemMessage } from './SystemMessage';
import { MessageActions } from './MessageActions';
import { ImageGrid } from './ImageGrid';
import type { FilePreviewItem } from '../FilePreviewModal';

export interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender?: boolean;
  isLastInGroup?: boolean;
  currentUserId?: string;
  senderDisplayName?: string;
  roomMembers?: Array<{ userId?: string; contactName?: string; avatarUrl?: string; cui?: string }>;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (clientMessageId: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  onPin?: (messageId: string, pin: boolean) => void;
  isPinned?: boolean;
  isHighlighted?: boolean;
  onStar?: (messageId: string) => void;
  onSelect?: (messageId: string) => void;
  onViewDetails?: (messageId: string) => void;
  onRecall?: (messageId: string) => void;
  onDownloadAttachment?: (url: string, fileName?: string) => void;
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
  renderContent?: (message: ChatMessage) => ReactNode;
  renderActions?: (message: ChatMessage) => ReactNode;
  renderStatus?: (status: MessageStatus) => ReactNode;
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(
  ({
    message,
    isOwn,
    showSender = false,
    isLastInGroup = true,
    currentUserId,
    senderDisplayName,
    roomMembers,
    onEdit,
    onDelete,
    onReply,
    onForward,
    onCopy,
    onPin,
    isPinned = false,
    isHighlighted = false,
    onStar,
    onSelect,
    onViewDetails,
    onRecall,
    onDownloadAttachment,
    onOpenAttachment,
    renderContent,
    renderActions,
    renderStatus,
  }) => {
    const { t } = useTranslation();

    const imageFiles = useMemo(() => {
      if (message.metadata?.type !== 'image') return [];

      if (message.metadata?.files) {
        const files = parseMessageFilesMetadata(message.metadata.files);
        if (files.length > 0) {
          return files
            .map((f) => ({
              url: String(f.url || ''),
              fileName: f.fileName,
              size: f.size !== undefined ? Number(f.size) : undefined,
              width: f.width,
              height: f.height,
              isLarge: f.isLarge === true || f.isLarge === 'true',
              mimeType: f.mimeType,
            }))
            .filter((f) => Boolean(f.url));
        }
      }

      if (message.metadata?.url) {
        return [
          {
            url: String(message.metadata.url),
            fileName: message.metadata.fileName ? String(message.metadata.fileName) : undefined,
            size: message.metadata.size !== undefined ? Number(message.metadata.size) : undefined,
            width: typeof message.metadata.width === "number" || typeof message.metadata.width === "string" ? message.metadata.width : undefined,
            height: typeof message.metadata.height === "number" || typeof message.metadata.height === "string" ? message.metadata.height : undefined,
            isLarge: String(message.metadata.isLarge) === 'true',
            mimeType: message.metadata.mimeType ? String(message.metadata.mimeType) : undefined,
          },
        ];
      }

      return [];
    }, [message.metadata]);

    const isVideoMessage = useMemo(() => {
      if (message.metadata?.type === 'video') return true;
      const fileName =
        (message.metadata?.fileName as string) || (message.metadata?.name as string) || '';
      const mimeType = (message.metadata?.mimeType as string) || '';
      if (mimeType.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(fileName)) {
        return Boolean(message.metadata?.url);
      }
      return false;
    }, [message.metadata]);

    const isFileMessage = useMemo(() => {
      if (isVideoMessage) return false;
      if (message.metadata?.type === 'file') return true;
      if (
        message.metadata?.type !== 'image' &&
        Boolean(message.metadata?.url) &&
        Boolean(message.metadata?.fileName)
      ) {
        return true;
      }
      return false;
    }, [message.metadata, isVideoMessage]);

    const isSingleLargeImage = useMemo(() => {
      if (imageFiles.length !== 1) return false;
      const single = imageFiles[0];
      const size =
        single.size ?? (message.metadata?.size ? Number(message.metadata.size) : undefined);
      return Boolean(
        single.isLarge || isLargeImage(size) || String(message.metadata?.isLarge) === 'true'
      );
    }, [imageFiles, message.metadata]);

    const isImageMessage = imageFiles.length > 0;
    const isNormalImageMessage = isImageMessage && !isSingleLargeImage;

    const linkPreviewFromMetadata = useMemo(
      () => parseLinkPreview(message.metadata?.linkPreview),
      [message.metadata]
    );

    const linkPreviewUrlToFetch = useMemo(() => {
      if (message.type === 'system' || message.deletedAt) return null;
      if (isVideoMessage || isFileMessage || isImageMessage || isSingleLargeImage) {
        return null;
      }
      if (linkPreviewFromMetadata && !isEmptyLinkPreview(linkPreviewFromMetadata)) {
        return null;
      }
      const sourceUrl = linkPreviewFromMetadata?.url;
      if (sourceUrl) return sourceUrl;
      if (message.type === 'html' || message.metadata?.type === 'html') {
        return extractUrlsFromHtml(message.content)[0] || null;
      }
      return extractUrls(message.content)[0] || null;
    }, [
      message.type,
      message.content,
      message.deletedAt,
      message.metadata,
      linkPreviewFromMetadata,
      isVideoMessage,
      isFileMessage,
      isImageMessage,
      isSingleLargeImage,
    ]);

    const fetchedLinkPreview = useLinkPreview(linkPreviewUrlToFetch);

    const linkPreview = fetchedLinkPreview || linkPreviewFromMetadata;

    const hasAttachments = Boolean(message.attachments && message.attachments.length > 0);

    // Handle System Messages via dedicated component
    if (message.type === 'system') {
      return (
        <SystemMessage
          message={message}
          currentUserId={currentUserId}
          roomMembers={roomMembers}
        />
      );
    }

    // Handle standard messages
    const messageClass = isOwn ? styles.ownMessage : styles.otherMessage;
    const bubbleClass = `${isOwn ? styles.ownBubble : styles.otherBubble} ${
      isNormalImageMessage ? styles.imageBubble : ''
    } ${isSingleLargeImage || isFileMessage || isVideoMessage || hasAttachments ? styles.largeImageBubble : ''} ${
      isHighlighted ? styles.highlightedBubble : ''
    }`;

    const senderId = message.sender?.id;
    const senderMember = roomMembers?.find((m) => m.cui === senderId || m.userId === senderId);

    const senderName =
      senderDisplayName ||
      senderMember?.contactName ||
      message.senderDisplayName ||
      message.sender?.displayName ||
      senderId ||
      t('chat.unknownSender');

    const senderAvatarUrl = senderMember?.avatarUrl;

    const defaultRenderContent = () => {
      if (message.deletedAt) {
        return (
          <div className={styles.deletedMessage}>
            <i>{t('chat.messageDeleted')}</i>
          </div>
        );
      }

      if (isVideoMessage) {
        const fileName =
          (message.metadata?.fileName as string) ||
          (message.metadata?.name as string) ||
          'video.mp4';
        const size = message.metadata?.size ? Number(message.metadata.size) : undefined;
        const url = (message.metadata?.url as string) || '';
        const mimeType = message.metadata?.mimeType as string | undefined;

        return (
          <div>
            <VideoCard
              fileName={fileName}
              fileSize={size}
              url={url}
              mimeType={mimeType}
              onDownload={onDownloadAttachment}
              onOpen={(u, fn) =>
                onOpenAttachment?.(u, fn, {
                  url: u,
                  fileName: fn,
                  fileSize: size,
                  mimeType: mimeType || 'video/mp4',
                  senderName,
                  senderAvatarUrl,
                  sentAt: message.createdAt,
                })
              }
            />
            {message.content && message.content !== url ? (
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : null}
          </div>
        );
      }

      if (isSingleLargeImage) {
        const singleImg = imageFiles[0];
        const fileName =
          singleImg.fileName || (message.metadata?.fileName as string) || 'image.jpg';
        const size =
          singleImg.size ?? (message.metadata?.size ? Number(message.metadata.size) : undefined);
        const url = singleImg.url || (message.metadata?.url as string) || '';
        const mimeType = getImageMimeType(
          fileName,
          singleImg.mimeType || (message.metadata?.mimeType as string)
        );

        return (
          <LargeImageCard
            showStatus={false}
            showOpenFolder={false}
            fileName={fileName}
            fileSize={size}
            url={url}
            mimeType={mimeType}
            onDownload={onDownloadAttachment}
            disablePreview={true}
          />
        );
      }

      if (isFileMessage) {
        const fileName =
          (message.metadata?.fileName as string) || (message.metadata?.name as string) || 'file';
        const size = message.metadata?.size ? Number(message.metadata.size) : undefined;
        const url = (message.metadata?.url as string) || '';
        const mimeType = message.metadata?.mimeType as string | undefined;

        return (
          <div>
            <LargeImageCard
              showStatus={false}
              showOpenFolder={false}
              fileName={fileName}
              fileSize={size}
              url={url}
              mimeType={mimeType}
              onDownload={onDownloadAttachment}
              onOpen={(u, fn) =>
                onOpenAttachment?.(u, fn, {
                  url: u,
                  fileName: fn,
                  fileSize: size,
                  mimeType,
                  senderName,
                  senderAvatarUrl,
                  sentAt: message.createdAt,
                })
              }
            />
            {message.content ? (
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : null}
          </div>
        );
      }

      if (hasAttachments && message.attachments) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {message.attachments.map((att) => {
              const isAttVideo =
                att.mimeType?.startsWith('video/') ||
                /\.(mp4|mov|webm|m4v|avi|mkv|3gp)$/i.test(att.name || '');
              if (isAttVideo) {
                return (
                  <VideoCard
                    key={att.id || att.url}
                    fileName={att.name}
                    fileSize={att.size}
                    url={att.url}
                    mimeType={att.mimeType}
                    onDownload={onDownloadAttachment}
                    onOpen={(u, fn) =>
                      onOpenAttachment?.(u, fn, {
                        url: u,
                        fileName: fn,
                        fileSize: att.size,
                        mimeType: att.mimeType,
                        senderName,
                        senderAvatarUrl,
                        sentAt: message.createdAt,
                      })
                    }
                  />
                );
              }
              const isAttImage =
                att.mimeType?.startsWith('image/') ||
                /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|heic)$/i.test(att.name || '');
              const isAttLargeImage = isAttImage && isLargeImage(att.size);

              return (
                <LargeImageCard
                  showStatus={false}
                  showOpenFolder={false}
                  key={att.id || att.url}
                  fileName={att.name}
                  fileSize={att.size}
                  url={att.url}
                  mimeType={att.mimeType}
                  onDownload={onDownloadAttachment}
                  disablePreview={isAttLargeImage}
                  onOpen={
                    isAttLargeImage
                      ? undefined
                      : (u, fn) =>
                          onOpenAttachment?.(u, fn, {
                            url: u,
                            fileName: fn,
                            fileSize: att.size,
                            mimeType: att.mimeType,
                            senderName,
                            senderAvatarUrl,
                            sentAt: message.createdAt,
                          })
                  }
                />
              );
            })}
            {message.content ? (
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{message.content}</div>
            ) : null}
          </div>
        );
      }

      if (isImageMessage) {
        return (
          <ImageGrid
            files={imageFiles}
            mimeType={message.metadata?.mimeType as string | undefined}
            senderName={senderName}
            senderAvatarUrl={senderAvatarUrl}
            sentAt={message.createdAt}
            onOpenAttachment={onOpenAttachment}
          />
        );
      }

      if (message.type === 'html' || message.metadata?.type === 'html') {
        const sanitized = normalizeFormattingHtml(sanitizeHtml(message.content)) || '';
        return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
      }
      if (containsUrl(message.content)) {
        const linkified = sanitizeHtml(linkifyHtml(message.content)) || '';
        return (
          <div
            className={styles.linkifiedContent}
            dangerouslySetInnerHTML={{ __html: linkified }}
          />
        );
      }
      return <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>;
    };

    return (
      <div
        id={`acs-msg-${message.id}`}
        className={`${styles.messageItem} ${messageClass} ${!isLastInGroup ? styles.groupedMessage : ''} ${isImageMessage ? styles.imageMessageItem : ''} ${isHighlighted ? styles.highlighted : ''}`}
      >
        {/* Avatar for other users */}
        {!isOwn && showSender && (
          <div className={styles.avatarWrapper}>
            <Avatar name={senderName} url={senderAvatarUrl} />
          </div>
        )}
        {!isOwn && !showSender && <div className={styles.avatarPlaceholder} />}

        <div className={styles.contentWrapper}>
          <div className={`${styles.bubble} ${bubbleClass}`}>
            {/* Sender name inside bubble for other users */}
            {!isOwn && showSender && <div className={styles.senderName}>{senderName}</div>}

            {renderContent ? renderContent(message) : defaultRenderContent()}
            {!renderContent && linkPreview && !message.deletedAt && !message.recalledAt && (
              <LinkPreviewCard preview={linkPreview} />
            )}
            {message.editedAt && !message.deletedAt && !message.recalledAt && (
              <span className={styles.edited}>{t('chat.edited')}</span>
            )}

            {/* Message Meta: Time & Status */}
            {isLastInGroup && (
              <div className={styles.meta}>
                <span className={styles.time}>{formatTime(message.createdAt)}</span>
                {isOwn && message.status && (
                  <span
                    className={`${styles.status} ${message.status === 'failed' ? styles.statusError : ''}`}
                  >
                    {renderStatus ? renderStatus(message.status) : message.status}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions container (hover to reveal) */}
          {!message.deletedAt && (
            <MessageActions
              message={message}
              isOwn={isOwn}
              isPinned={isPinned}
              renderActions={renderActions}
              onReply={onReply}
              onForward={onForward}
              onCopy={onCopy}
              onPin={onPin}
              onStar={onStar}
              onSelect={onSelect}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onRecall={onRecall}
              onDelete={onDelete}
            />
          )}
        </div>
      </div>
    );
  }
);

export { LargeImageCard, FileCard } from './LargeImageCard';
export type { LargeImageCardProps, FileCardProps } from './LargeImageCard';
export { DocumentIcon, getDocumentFileType } from './DocumentIcon';
export type { DocumentIconProps, DocumentFileType } from './DocumentIcon';
export { ChatImage } from './ChatImage';
export { LinkPreviewCard } from './LinkPreviewCard';
export type { LinkPreviewCardProps } from './LinkPreviewCard';
export { VideoCard } from './VideoCard';
export type { VideoCardProps } from './VideoCard';
export { SystemMessage } from './SystemMessage';
export type { SystemMessageProps } from './SystemMessage';
export { MessageActions } from './MessageActions';
export type { MessageActionsProps } from './MessageActions';
export { ImageGrid } from './ImageGrid';
export type { ImageGridProps, ImageGridFile } from './ImageGrid';
