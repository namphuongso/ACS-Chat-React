import React from 'react';
import type { Conversation } from '../../types';
import { formatTime } from '../../utils/date';
import { Avatar } from '../Avatar';
import { PinIcon, VerifiedIcon } from '../Icons';
import { useTranslation } from 'react-i18next';
import styles from './ConversationList.module.scss';

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = React.memo(
  ({ conversation, isActive, onClick }) => {
    const { t } = useTranslation();
    const displayName = conversation.name || 
      (conversation.type === 'direct' 
        ? conversation.otherParticipant?.displayName || conversation.otherParticipant?.id || t('chat.unknownUser')
        : t('chat.unknownGroup'));
    const avatarUrl = conversation.avatarUrl;

    const lastMessage = conversation.lastMessage;
    let previewText = '';
    if (lastMessage) {
      if (lastMessage.senderDisplayName) {
        previewText = `${lastMessage.senderDisplayName}: `;
      } else {
        previewText = `${t('chat.you')}: `;
      }

      if (lastMessage.attachments && lastMessage.attachments.length > 0) {
        previewText += `📎 ${lastMessage.attachments[0].name || 'Attachment'}`;
      } else {
        previewText += lastMessage.content;
      }
    }

    // Extract metadata (mocking the features from the image like pin and verified)
    const isPinned = conversation.metadata?.pinned === 'true';
    const isVerified = conversation.metadata?.verified === 'true';
    const timestamp = conversation.updatedAt || conversation.createdAt;

    return (
      <div
        className={`${styles.conversationItem} ${isActive ? styles.active : ''}`}
        onClick={onClick}
      >
        <Avatar url={avatarUrl} name={displayName} className={styles.avatarContainer} />

        <div className={styles.content}>
          <div className={styles.header}>
            <div className={`${styles.name} ${conversation.unreadCount > 0 ? styles.unread : ''}`}>
              {displayName}
              {isVerified && <VerifiedIcon />}
            </div>
            <div className={`${styles.time} ${conversation.unreadCount > 0 ? styles.unread : ''}`}>
              {formatTime(timestamp)}
            </div>
          </div>

          <div className={styles.previewRow}>
            <div className={styles.previewLeft}>
              <div
                className={`${styles.preview} ${conversation.unreadCount > 0 ? styles.unread : ''}`}
              >
                {previewText}
              </div>
            </div>
            <div className={styles.previewRight}>
              {isPinned && <PinIcon />}
              {conversation.unreadCount > 0 && (
                <div className={styles.unreadBadge}>
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
