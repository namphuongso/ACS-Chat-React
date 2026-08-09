import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Conversation } from '../../types';
import { formatTime } from '../../utils/date';
import { Avatar } from '../Avatar';
import { PinIcon, VerifiedIcon, MoreHorizontalIcon, ChevronRightIcon } from '../Icons';
import { useTranslation } from 'react-i18next';
import { DropdownItem, DropdownDivider } from '../Dropdown';
import dropdownStyles from '../Dropdown/Dropdown.module.scss';
import styles from './ConversationList.module.scss';


export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  isDropdownOpen?: boolean;
  onDropdownOpenChange?: (isOpen: boolean) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = React.memo(
  ({
    conversation,
    isActive,
    onClick,
    isDropdownOpen: isDropdownOpenProp,
    onDropdownOpenChange,
  }) => {
    const { t } = useTranslation();
    const [isDropdownOpenState, setIsDropdownOpenState] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
    const actionsRef = useRef<HTMLDivElement>(null);

    const isDropdownOpen =
      isDropdownOpenProp !== undefined ? isDropdownOpenProp : isDropdownOpenState;

    const setIsDropdownOpen = useCallback(
      (isOpen: boolean) => {
        setIsDropdownOpenState(isOpen);
        if (onDropdownOpenChange) {
          onDropdownOpenChange(isOpen);
        }
      },
      [onDropdownOpenChange]
    );

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
    }, [isDropdownOpen, setIsDropdownOpen]);

    const handleDropdownClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      if (window.innerHeight - rect.bottom < 350) {
        setDropdownPosition('up');
      } else {
        setDropdownPosition('down');
      }
      setIsDropdownOpen(!isDropdownOpen);
    };

    const handleActionClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsDropdownOpen(false);
    };

    const displayName =
      conversation.name ||
      (conversation.type === 'direct'
        ? conversation.otherParticipant?.displayName ||
          conversation.otherParticipant?.id ||
          t('chat.unknownUser')
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
        className={`${styles.conversationItem} ${isActive ? styles.active : ''} ${isDropdownOpen ? styles.hasDropdownOpen : ''}`}
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

        <div
          ref={actionsRef}
          className={`${styles.actions} ${isDropdownOpen ? styles.dropdownOpen : ''}`}
        >
          <button
            className={styles.actionIconBtn}
            onClick={handleDropdownClick}
            title={t('chat.moreOptions', 'More options')}
          >
            <MoreHorizontalIcon />
          </button>

          {isDropdownOpen && (
            <div
              className={`${dropdownStyles.dropdownMenu} ${dropdownPosition === 'up' ? dropdownStyles.dropdownMenuUp : ''}`}
            >
              <DropdownItem onClick={handleActionClick}>
                {t('chat.pinConversation', 'Pin this conversation')}
              </DropdownItem>
              <DropdownDivider />

              <DropdownItem onClick={handleActionClick}>
                {t('chat.moveToOtherTab', 'Move to Other tab')}
              </DropdownItem>
              <DropdownItem onClick={handleActionClick} rightContent={<ChevronRightIcon />}>
                {t('chat.labels', 'Labels')}
              </DropdownItem>
              <DropdownItem onClick={handleActionClick}>
                {t('chat.markAsUnread', 'Mark as unread')}
              </DropdownItem>
              <DropdownDivider />

              <DropdownItem onClick={handleActionClick}>
                {t('chat.addToGroup', 'Add to group')}
              </DropdownItem>
              <DropdownItem onClick={handleActionClick} rightContent={<ChevronRightIcon />}>
                {t('chat.turnNotificationOff', 'Turn notification off')}
              </DropdownItem>
              <DropdownDivider />

              <DropdownItem onClick={handleActionClick}>
                {t('chat.hideConversation', 'Hide conversation')}
              </DropdownItem>
              <DropdownDivider />

              <DropdownItem onClick={handleActionClick} danger>
                {t('chat.deleteConversation', 'Delete conversation')}
              </DropdownItem>
              <DropdownDivider />

              <DropdownItem onClick={handleActionClick}>
                {t('chat.report', 'Report')}
              </DropdownItem>
            </div>
          )}
        </div>
      </div>
    );
  }
);
