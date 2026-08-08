import React from 'react';
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
    const name =
      conversation.type === 'group'
        ? conversation.name
        : conversation.otherParticipant?.displayName || 'Direct Conversation';

    const avatarUrl = conversation.type === 'group' ? conversation.avatarUrl : undefined;

    return (
      <div className={styles.header}>
        <div className={styles.left}>
          <Avatar name={name} url={avatarUrl} className={styles.avatar} />
          <div className={styles.info}>
            <div className={styles.name}>{name}</div>
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
