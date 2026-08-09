import React, { ReactNode, useState, useRef, useEffect } from 'react';
import type { ChatMessage, MessageStatus } from '../../types/message.types';
import { Avatar } from '../Avatar';
import { formatTime } from '../../utils/date';
import { useTranslation } from 'react-i18next';
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
} from '../Icons';

export interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender?: boolean;
  isLastInGroup?: boolean;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (clientMessageId: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onStar?: (messageId: string) => void;
  onSelect?: (messageId: string) => void;
  onViewDetails?: (messageId: string) => void;
  onRecall?: (messageId: string) => void;
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
    onEdit,
    onDelete,
    onReply,
    onForward,
    onCopy,
    onPin,
    onStar,
    onSelect,
    onViewDetails,
    onRecall,
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

    // Handle System Messages
    if (message.type === 'system') {
      let systemText = message.content;
      if (message.systemEvent) {
        const { type, initiator, participants, newTopic } = message.systemEvent;
        const initiatorName = initiator?.displayName || initiator?.id || 'System';
        if (type === 'topicUpdated') {
          systemText = `${initiatorName} changed topic to "${newTopic}"`;
        } else if (type === 'participantAdded') {
          const addedNames = participants?.map((p) => p.displayName || p.id).join(', ');
          systemText = `${initiatorName} added ${addedNames}`;
        } else if (type === 'participantRemoved') {
          const removedNames = participants?.map((p) => p.displayName || p.id).join(', ');
          systemText = `${initiatorName} removed ${removedNames}`;
        }
      }

      return (
        <div className={`${styles.messageItem} ${styles.systemMessage}`}>
          <div className={styles.systemContent}>{systemText}</div>
        </div>
      );
    }

    // Handle standard messages
    const messageClass = isOwn ? styles.ownMessage : styles.otherMessage;
    const bubbleClass = isOwn ? styles.ownBubble : styles.otherBubble;

    const senderName =
      message.senderDisplayName || message.sender?.displayName || message.sender?.id || t('chat.unknownSender');

    const defaultRenderContent = () => {
      if (message.deletedAt) {
        return (
          <div className={styles.deletedMessage}>
            <i>{t('chat.messageDeleted')}</i>
          </div>
        );
      }
      if (message.type === 'html') {
        return <div dangerouslySetInnerHTML={{ __html: message.content }} />;
      }
      return <div>{message.content}</div>;
    };

    const handleActionClick = (actionFn?: (id: string) => void) => {
      if (actionFn) {
        actionFn(message.id);
      }
      setIsDropdownOpen(false);
    };

    return (
      <div
        className={`${styles.messageItem} ${messageClass} ${!isLastInGroup ? styles.groupedMessage : ''}`}
      >
        {/* Avatar for other users */}
        {!isOwn && showSender && (
          <div className={styles.avatarWrapper}>
            <Avatar name={senderName} />
          </div>
        )}
        {!isOwn && !showSender && <div className={styles.avatarPlaceholder} />}

        <div className={styles.contentWrapper}>
          <div className={`${styles.bubble} ${bubbleClass}`}>
            {/* Sender name inside bubble for other users */}
            {!isOwn && showSender && <div className={styles.senderName}>{senderName}</div>}

            {renderContent ? renderContent(message) : defaultRenderContent()}
            {message.editedAt && !message.deletedAt && (
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
                      <div className={`${styles.dropdownMenu} ${dropdownPosition === 'up' ? styles.dropdownMenuUp : ''}`}>
                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onCopy)}
                        >
                          <CopyIcon /> {t('chat.copyText')}
                        </button>
                        <div className={styles.dropdownDivider} />

                        <button
                          className={styles.dropdownItem}
                          onClick={() => handleActionClick(onPin)}
                        >
                          <PinIcon /> {t('chat.pinMessage')}
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

                        <button
                          className={`${styles.dropdownItem} ${styles.dangerItem}`}
                          onClick={() => handleActionClick(onDelete)}
                        >
                          <TrashIcon /> {t('chat.deleteMessage')}
                        </button>
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
