import React from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, Video, Search, PanelRight } from 'lucide-react';
import { Avatar } from '../Avatar';
import type { Conversation } from '../../types/conversation.types';
import styles from './ConversationHeader.module.scss';

export interface ConversationHeaderProps {
  conversation: Conversation;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export const ConversationHeader: React.FC<ConversationHeaderProps> = React.memo(
  ({ conversation, onToggleSidebar, isSidebarOpen = false }) => {
    const { t } = useTranslation();
    const displayName = conversation.name || 
      (conversation.type === 'direct' 
        ? conversation.otherParticipant?.displayName || conversation.otherParticipant?.id || t('chat.unknownUser')
        : t('chat.unknownGroup'));
    const avatarUrl = conversation.avatarUrl;

    return (
      <div className={styles.header}>
        <div className={styles.left}>
          <Avatar name={displayName} url={avatarUrl} className={styles.avatar} />
          <div className={styles.info}>
            <div className={styles.name}>{displayName}</div>
          </div>
        </div>
        <div className={styles.actions}>
          <button className={styles.actionBtn} aria-label="Call">
            <Phone size={20} />
          </button>
          <button className={styles.actionBtn} aria-label="Video Call">
            <Video size={20} />
          </button>
          <button className={styles.actionBtn} aria-label="Search">
            <Search size={20} />
          </button>
          <button
            className={`${styles.actionBtn} ${isSidebarOpen ? styles.active : ''}`}
            onClick={onToggleSidebar}
            aria-label="Toggle Sidebar"
          >
            <PanelRight size={20} />
          </button>
        </div>
      </div>
    );
  }
);
