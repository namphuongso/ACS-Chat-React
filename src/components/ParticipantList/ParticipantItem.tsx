import React, { useState, useRef, useEffect } from 'react';
import styles from './ParticipantList.module.scss';
import { Avatar } from '../Avatar';
import { MoreHorizontalIcon, KeyIcon } from '../Icons';
import { useTranslation } from 'react-i18next';
import type { ConversationParticipant } from '../../types/participant.types';

export interface ParticipantItemProps {
  participant: ConversationParticipant;
  isCurrentUser: boolean;
  onRemove?: (userId: string) => void;
}

export const ParticipantItem: React.FC<ParticipantItemProps> = React.memo(({ participant, isCurrentUser, onRemove }) => {
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const displayName = isCurrentUser ? t('chat.you') : participant.displayName || participant.id;
  const showRoleIcon = participant.role === 'owner' || participant.role === 'admin';

  return (
    <div className={styles.participantItem}>
      <div className={styles.participantInfo}>
        <div className={styles.avatarWrapper}>
          <Avatar name={displayName} className={styles.avatar} />
          {showRoleIcon && (
            <div className={styles.roleIconWrapper}>
              <KeyIcon width={12} height={12} />
            </div>
          )}
        </div>
        <div className={styles.details}>
          <span className={styles.name}>{displayName}</span>
          {participant.role && <span className={styles.role}>{participant.role}</span>}
        </div>
      </div>

      {onRemove && (
        <div className={styles.actions} ref={dropdownRef}>
          <button className={styles.moreListBtn} onClick={() => setShowDropdown(!showDropdown)}>
            <MoreHorizontalIcon width={20} height={20} />
          </button>

          {showDropdown && (
            <div className={styles.dropdown}>
              <button
                className={styles.dropdownItem}
                onClick={() => {
                  onRemove(participant.id);
                  setShowDropdown(false);
                }}
              >
                {isCurrentUser ? t('chat.leaveGroup') : t('chat.removeFromGroup')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
