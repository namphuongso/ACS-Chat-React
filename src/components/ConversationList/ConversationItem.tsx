import React from 'react';
import type { Conversation } from '../../types';
import styles from './ConversationList.module.scss';
import { formatTime } from '../../utils/date';
import { PinIcon, MessageIcon, VerifiedIcon } from '../Icons';
import { Avatar } from '../Avatar';

export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = React.memo(({
  conversation,
  isActive,
  onClick,
}) => {
  const isGroup = conversation.type === 'group';
  const name = isGroup
    ? conversation.name
    : conversation.otherParticipant.displayName || conversation.otherParticipant.id;
  const avatarUrl = isGroup ? conversation.avatarUrl : undefined;

  const lastMessage = conversation.lastMessage;
  let previewText = '';
  if (lastMessage) {
    if (lastMessage.senderDisplayName) {
      previewText = `${lastMessage.senderDisplayName}: `;
    } else {
      previewText = 'You: ';
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
      <Avatar url={avatarUrl} name={name} className={styles.avatarContainer} />

      <div className={styles.content}>
        <div className={styles.header}>
          <div className={`${styles.name} ${conversation.unreadCount > 0 ? styles.unread : ''}`}>
            {name}
            {isVerified && <VerifiedIcon />}
          </div>
          <div className={`${styles.time} ${conversation.unreadCount > 0 ? styles.unread : ''}`}>
            {formatTime(timestamp)}
          </div>
        </div>

        <div className={styles.previewRow}>
          <div className={styles.previewLeft}>
            <MessageIcon />
            <div className={`${styles.preview} ${conversation.unreadCount > 0 ? styles.unread : ''}`}>
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
});
