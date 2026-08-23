import React, { ReactNode, useState, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage, MessageStatus } from '../../types/message.types';
import { Avatar } from '../Avatar';
import { formatTime } from '../../utils/date';
import { normalizeFormattingHtml, sanitizeHtml } from '../../utils/htmlUtils';
import { isLargeImage } from '../../utils/imageUtils';
import {
  containsUrl,
  extractUrls,
  extractUrlsFromHtml,
  isEmptyLinkPreview,
  linkifyHtml,
  parseLinkPreview,
} from '../../utils/linkUtils';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import { useTranslation, Trans } from 'react-i18next';
import styles from './MessageItem.module.scss';
import {
  QuoteIcon,
  ForwardIcon,
  MoreHorizontalIcon,
  CopyIcon,
  PinIcon,
  StarIcon,
  ListChecksIcon,
  InfoIcon,
  ChevronRightIcon,
  UndoIcon,
  TrashIcon,
  EditIcon,
  PinOffIcon,
} from '../Icons';
import { ChatImage } from './ChatImage';
import { LargeImageCard } from './LargeImageCard';
import { LinkPreviewCard } from './LinkPreviewCard';
import { VideoCard } from './VideoCard';

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
  onOpenAttachment?: (url: string, fileName?: string) => void;
  renderContent?: (message: ChatMessage) => ReactNode;
  renderActions?: (message: ChatMessage) => ReactNode;
  renderStatus?: (status: MessageStatus) => ReactNode;
}

const getImageGridContainerStyle = (count: number): React.CSSProperties => {
  if (count === 2) {
    return {
      gridTemplateColumns: 'repeat(2, 1fr)',
      maxWidth: 420,
    };
  }
  if (count === 3) {
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      maxWidth: 460,
    };
  }
  if (count === 4) {
    return {
      gridTemplateColumns: 'repeat(4, 1fr)',
      maxWidth: 480,
    };
  }
  if (count === 5) {
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      maxWidth: 460,
    };
  }
  // 6 or more
  return {
    gridTemplateColumns: 'repeat(3, 1fr)',
    maxWidth: 460,
  };
};

const getImageGridItemStyle = (count: number, index: number): React.CSSProperties => {
  if (count === 2) {
    return {
      height: 190,
    };
  }
  if (count === 3) {
    return {
      height: 160,
    };
  }
  if (count === 4) {
    return {
      height: 130,
    };
  }
  if (count === 5) {
    if (index < 3) {
      return {
        gridColumn: 'span 1',
        height: 130,
      };
    }
    if (index === 3) {
      return {
        gridColumn: 'span 1',
        height: 170,
      };
    }
    return {
      gridColumn: 'span 2',
      height: 170,
    };
  }
  // 6 or more
  return {
    gridColumn: 'span 1',
    height: 130,
  };
};

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
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
    const actionsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      if (isDropdownOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isDropdownOpen]);

    const imageFiles = useMemo(() => {
      if (message.metadata?.type !== 'image') return [];

      if (message.metadata?.files) {
        let files = message.metadata.files;
        if (typeof files === 'string') {
          try {
            files = JSON.parse(files);
          } catch {
            files = [];
          }
        }
        if (Array.isArray(files) && files.length > 0) {
          return (files as unknown[])
            .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
            .map((f) => ({
              url: String(f.url || ''),
              fileName: f.fileName ? String(f.fileName) : undefined,
              size: f.size !== undefined ? Number(f.size) : undefined,
              width: f.width as string | number | undefined,
              height: f.height as string | number | undefined,
              isLarge: f.isLarge === true || f.isLarge === 'true',
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
            width: message.metadata.width as string | number | undefined,
            height: message.metadata.height as string | number | undefined,
            isLarge: String(message.metadata.isLarge) === 'true',
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

    // Handle System Messages
    if (message.type === 'system') {
      let systemNode: React.ReactNode = message.content;
      if (message.systemEvent) {
        const { type, initiator, participants, newTopic } = message.systemEvent;

        const getMemberName = (id?: string, defaultName?: string) => {
          if (!id) return defaultName || 'System';
          if (id === currentUserId) return t('chat.you', 'You');
          const member = roomMembers?.find((m) => m.cui === id || m.userId === id);
          return member?.contactName || defaultName || id;
        };

        const isInitiatorMe = initiator?.id === currentUserId;
        const initiatorName = isInitiatorMe
          ? t('chat.you_lowercase', 'you')
          : getMemberName(initiator?.id, initiator?.displayName);

        if (type === 'topicUpdated') {
          const topicInitiator = isInitiatorMe ? t('chat.you', 'You') : initiatorName;
          systemNode = (
            <Trans
              i18nKey="chat.system.topicUpdated"
              defaults='<b>{{initiator}}</b> changed topic to <b>"{{newTopic}}"</b>'
              values={{ initiator: topicInitiator, newTopic }}
              components={{ b: <b /> }}
            />
          );
        } else if (type === 'participantAdded') {
          const addedNames = participants
            ?.filter((p) => p.id !== initiator?.id)
            .map((p) => getMemberName(p.id, p.displayName))
            ?.join(', ');
          if (isInitiatorMe) {
            systemNode = (
              <Trans
                i18nKey="chat.system.youAddedParticipants"
                defaults="<b>{{participants}}</b> were added to the group by <b>you</b>"
                values={{ participants: addedNames }}
                components={{ b: <b /> }}
              />
            );
          } else {
            systemNode = (
              <Trans
                i18nKey="chat.system.participantsAddedBy"
                defaults="<b>{{participants}}</b> were added to the group by <b>{{initiator}}</b>"
                values={{ participants: addedNames, initiator: initiatorName }}
                components={{ b: <b /> }}
              />
            );
          }
        } else if (type === 'participantRemoved') {
          const removedNames = participants
            ?.filter((p) => p.id !== initiator?.id)
            .map((p) => getMemberName(p.id, p.displayName))
            ?.join(', ');
          if (isInitiatorMe) {
            systemNode = (
              <Trans
                i18nKey="chat.system.youRemovedParticipants"
                defaults="<b>{{participants}}</b> were removed from the group by <b>you</b>"
                values={{ participants: removedNames }}
                components={{ b: <b /> }}
              />
            );
          } else {
            systemNode = (
              <Trans
                i18nKey="chat.system.participantsRemovedBy"
                defaults="<b>{{participants}}</b> were removed from the group by <b>{{initiator}}</b>"
                values={{ participants: removedNames, initiator: initiatorName }}
                components={{ b: <b /> }}
              />
            );
          }
        }
      }

      return (
        <div className={`${styles.messageItem} ${styles.systemMessage}`}>
          <div className={styles.systemContent}>{systemNode}</div>
        </div>
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

        return (
          <LargeImageCard
            showStatus={false}
            showOpenFolder={false}
            fileName={fileName}
            fileSize={size}
            url={url}
            onDownload={onDownloadAttachment}
            onOpen={onOpenAttachment}
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
              onOpen={onOpenAttachment}
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
                  />
                );
              }
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
                  onOpen={onOpenAttachment}
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
        if (imageFiles.length === 1) {
          const singleImg = imageFiles[0];
          return (
            <div className={styles.imageContainer}>
              <div className={styles.hdBadge}>HD</div>
              <ChatImage
                src={singleImg.url}
                alt={singleImg.fileName || 'image'}
                className={styles.imageContent}
                style={{
                  aspectRatio:
                    singleImg.width &&
                    singleImg.height &&
                    Number(singleImg.width) > 0 &&
                    Number(singleImg.height) > 0
                      ? `${singleImg.width} / ${singleImg.height}`
                      : '4 / 3',
                }}
              />
            </div>
          );
        }

        const count = imageFiles.length;

        return (
          <div className={styles.imageGrid} style={getImageGridContainerStyle(count)}>
            {imageFiles.map((img, idx) => (
              <div
                key={img.url || idx}
                className={styles.imageGridItem}
                style={getImageGridItemStyle(count, idx)}
              >
                <div className={styles.hdBadge}>HD</div>
                <ChatImage
                  src={img.url}
                  alt={img.fileName || `image-${idx}`}
                  className={styles.imageContent}
                />
              </div>
            ))}
          </div>
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

    const handleActionClick = (actionFn?: (id: string) => void) => {
      if (actionFn) {
        actionFn(message.id);
      }
      setIsDropdownOpen(false);
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
            <div
              ref={actionsRef}
              className={`${styles.actions} ${isDropdownOpen ? styles.dropdownOpen : ''}`}
            >
              {renderActions ? (
                renderActions(message)
              ) : (
                <>
                  <button
                    className={styles.actionIconBtn}
                    onClick={() => handleActionClick(onReply)}
                    title={t('chat.reply')}
                  >
                    <QuoteIcon />
                  </button>
                  <button
                    className={styles.actionIconBtn}
                    onClick={() => handleActionClick(onForward)}
                    title={t('chat.forward')}
                  >
                    <ForwardIcon />
                  </button>
                  <div style={{ position: 'relative' }}>
                    <button
                      className={styles.actionIconBtn}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (window.innerHeight - rect.bottom < 350) {
                          setDropdownPosition('up');
                        } else {
                          setDropdownPosition('down');
                        }
                        setIsDropdownOpen(!isDropdownOpen);
                      }}
                      title={t('chat.moreOptions')}
                    >
                      <MoreHorizontalIcon />
                    </button>

                    {isDropdownOpen && (
                      <div
                        className={`${styles.dropdownMenu} ${dropdownPosition === 'up' ? styles.dropdownMenuUp : ''}`}
                      >
                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onCopy)}
                        >
                          <CopyIcon /> {t('chat.copyText')}
                        </button>
                        <div className={styles.dropdownDivider} />

                        <button
                          className={styles.dropdownItem}
                          onClick={() => {
                            if (onPin) onPin(message.id, !isPinned);
                            setIsDropdownOpen(false);
                          }}
                        >
                          {isPinned ? (
                            <>
                              <PinOffIcon /> {t('chat.unpinMessage', 'Bỏ ghim')}
                            </>
                          ) : (
                            <>
                              <PinIcon /> {t('chat.pinMessage')}
                            </>
                          )}
                        </button>
                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onStar)}
                        >
                          <StarIcon /> {t('chat.starMessage')}
                        </button>
                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onSelect)}
                        >
                          <ListChecksIcon /> {t('chat.selectMessages')}
                        </button>
                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onViewDetails)}
                        >
                          <InfoIcon /> {t('chat.viewDetails')}
                        </button>

                        <div className={styles.dropdownDivider} />
                        <button className={styles.dropdownItem}>
                          {t('chat.otherOptions')}
                          <div className={styles.rightContent}>
                            <ChevronRightIcon />
                          </div>
                        </button>
                        <div className={styles.dropdownDivider} />

                        {isOwn && (
                          <>
                            <button
                              className={styles.dropdownItem}
                              onClick={() => handleActionClick(onEdit)}
                            >
                              <EditIcon /> {t('chat.editMessage')}
                            </button>
                            <button
                              className={`${styles.dropdownItem} ${styles.dangerItem}`}
                              onClick={() => handleActionClick(onRecall)}
                            >
                              <UndoIcon /> {t('chat.recall')}
                            </button>
                          </>
                        )}

                        {isOwn && (
                          <button
                            className={`${styles.dropdownItem} ${styles.dangerItem}`}
                            onClick={() => handleActionClick(onDelete)}
                          >
                            <TrashIcon /> {t('chat.deleteMessage')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
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
