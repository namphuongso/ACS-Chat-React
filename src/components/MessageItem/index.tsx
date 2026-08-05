import React, { ReactNode, useState, useRef, useEffect } from 'react';
import type { ChatMessage, MessageStatus } from '../../types/message.types';
import { Avatar } from '../Avatar';
import { formatTime } from '../../utils/date';
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
} from '../Icons';

export interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender?: boolean;
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

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwn,
  showSender = false,
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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
    message.senderDisplayName || message.sender?.displayName || message.sender?.id || 'Unknown';

  const defaultRenderContent = () => {
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
    <div className={`${styles.messageItem} ${messageClass}`}>
      {/* Avatar for other users */}
      {!isOwn && showSender && (
        <div className={styles.avatarWrapper}>
          <Avatar name={senderName} />
        </div>
      )}

      <div className={styles.contentWrapper}>
        {/* Sender name for other users */}
        {!isOwn && showSender && <div className={styles.senderName}>{senderName}</div>}

        <div className={`${styles.bubble} ${bubbleClass}`}>
          {renderContent ? renderContent(message) : defaultRenderContent()}
          {message.editedAt && <span className={styles.edited}>(edited)</span>}
        </div>

        {/* Message Meta: Time & Status */}
        <div className={styles.meta}>
          <span className={styles.time}>{formatTime(message.createdAt)}</span>
          {isOwn && (
            <span
              className={`${styles.status} ${message.status === 'failed' ? styles.statusError : ''}`}
            >
              {renderStatus ? renderStatus(message.status) : message.status}
            </span>
          )}
        </div>
      </div>

      {/* Actions container (hover to reveal) */}
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
              title="Reply"
            >
              <QuoteIcon />
            </button>
            <button
              className={styles.actionIconBtn}
              onClick={() => handleActionClick(onForward)}
              title="Forward"
            >
              <ForwardIcon />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className={styles.actionIconBtn}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="More Options"
              >
                <MoreHorizontalIcon />
              </button>

              {isDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <button className={styles.dropdownItem} onClick={() => handleActionClick(onCopy)}>
                    <CopyIcon /> Copy text
                  </button>
                  <div className={styles.dropdownDivider} />

                  <button className={styles.dropdownItem} onClick={() => handleActionClick(onPin)}>
                    <PinIcon /> Pin message
                  </button>
                  <button className={styles.dropdownItem} onClick={() => handleActionClick(onStar)}>
                    <StarIcon /> Star this message
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleActionClick(onSelect)}
                  >
                    <ListChecksIcon /> Select messages
                  </button>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleActionClick(onViewDetails)}
                  >
                    <InfoIcon /> View details
                  </button>

                  <div className={styles.dropdownDivider} />
                  <button className={styles.dropdownItem}>
                    Other options
                    <div className={styles.rightContent}>
                      <ChevronRightIcon />
                    </div>
                  </button>
                  <div className={styles.dropdownDivider} />

                  {isOwn && (
                    <button
                      className={`${styles.dropdownItem} ${styles.dangerItem}`}
                      onClick={() => handleActionClick(onRecall)}
                    >
                      <UndoIcon /> Recall
                    </button>
                  )}

                  <button
                    className={`${styles.dropdownItem} ${styles.dangerItem}`}
                    onClick={() => handleActionClick(onDelete)}
                  >
                    <TrashIcon /> Delete for me only
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
