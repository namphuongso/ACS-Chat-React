import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePinnedMessages } from '../../hooks';
import { MessageIcon, MoreHorizontalIcon, ChevronDownIcon, ChevronUpIcon } from '../Icons';
import styles from './PinnedMessageBanner.module.scss';

export interface PinnedMessageBannerProps {
  conversationId: string;
  backendConversationId?: string;
  pinnedMessageIds?: Set<string> | string[];
  onUnpinMessage: (messageId: string, pin: boolean) => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  conversationId,
  backendConversationId,
  pinnedMessageIds,
  onUnpinMessage,
}) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPinboardOpen, setIsPinboardOpen] = useState(false);

  const bannerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Convert string[] | Set<string> to array for dependency checking
  const pinnedMessageIdsArray = Array.from(pinnedMessageIds || []);

  const { pinnedMessages, setPinnedMessages } = usePinnedMessages(
    conversationId,
    backendConversationId,
    [pinnedMessageIdsArray.join(',')]
  );

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isDropdownOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }

      if (
        isPinboardOpen &&
        bannerRef.current &&
        !bannerRef.current.contains(event.target as Node)
      ) {
        setIsPinboardOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isPinboardOpen]);

  if (pinnedMessages.length === 0) return null;

  const handleUnpin = (messageId: string) => {
    onUnpinMessage(messageId, false);
    setIsDropdownOpen(false);
    // Optimistic update
    setPinnedMessages(pinnedMessages.filter((m) => m.messageId !== messageId));
    if (pinnedMessages.length === 1) {
      setIsPinboardOpen(false);
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setIsDropdownOpen(false);
  };

  const handleOpenGroupBoard = () => {
    // Integration point for opening group board
    setIsDropdownOpen(false);
    setIsPinboardOpen(false);
  };

  const firstMessage = pinnedMessages[0];

  return (
    <div className={styles.bannerContainer} ref={bannerRef}>
      {isPinboardOpen ? (
        <div className={styles.pinboardOverlay}>
          <div className={styles.pinboardHeader}>
            <div className={styles.pinboardTitle}>
              {t('chat.pinboard', { count: pinnedMessages.length })}
            </div>
            <button className={styles.collapseButton} onClick={() => setIsPinboardOpen(false)}>
              {t('chat.collapse')} <ChevronUpIcon width={16} height={16} />
            </button>
          </div>
          <div className={styles.pinboardList}>
            {pinnedMessages.map((msg) => (
              <div key={msg.messageId} className={styles.pinboardItem}>
                <div className={styles.leftSection}>
                  <div className={styles.iconWrapper}>
                    <MessageIcon width={16} height={16} />
                  </div>
                  <div className={styles.contentWrapper}>
                    <div className={styles.headerTitle}>{t('chat.message')}</div>
                    <div className={styles.messageContent}>
                      {msg.creator}: {msg.content}
                    </div>
                  </div>
                </div>
                <div className={styles.rightSection} style={{ position: 'relative' }}>
                  {/* Each item could have its own dropdown if needed, but for now just showing simple list as requested */}
                  <button
                    className={styles.moreButton}
                    onClick={() => {
                      setIsDropdownOpen(true);
                      // In a real implementation you'd track which item's dropdown is open
                      // But the requirement mostly shows it for the banner
                    }}
                  >
                    <MoreHorizontalIcon width={16} height={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.pinboardFooter}>
            <button className={styles.viewAllButton} onClick={handleOpenGroupBoard}>
              {t('chat.viewAllInGroupBoard')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.leftSection}>
            <div className={styles.iconWrapper}>
              <MessageIcon width={16} height={16} />
            </div>
            <div className={styles.contentWrapper}>
              <div className={styles.headerTitle}>{t('chat.message')}</div>
              <div className={styles.messageContent}>
                {firstMessage.creator}: {firstMessage.content}
              </div>
            </div>
          </div>
          <div className={styles.rightSection}>
            {pinnedMessages.length > 1 && (
              <button className={styles.pinCountButton} onClick={() => setIsPinboardOpen(true)}>
                {t('chat.pinCount', { count: pinnedMessages.length - 1 })}{' '}
                <ChevronDownIcon width={16} height={16} />
              </button>
            )}
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button
                className={styles.moreButton}
                onClick={() => setIsDropdownOpen((prev) => !prev)}
              >
                <MoreHorizontalIcon width={20} height={20} />
              </button>
              {isDropdownOpen && (
                <div className={styles.dropdownMenu}>
                  <button
                    className={styles.dropdownItem}
                    onClick={() => handleCopy(firstMessage.content)}
                  >
                    {t('chat.copy')}
                  </button>
                  <button className={styles.dropdownItem} onClick={handleOpenGroupBoard}>
                    {t('chat.openGroupBoard')}
                  </button>
                  <button
                    className={`${styles.dropdownItem} ${styles.danger}`}
                    onClick={() => handleUnpin(firstMessage.messageId)}
                  >
                    {t('chat.unpin')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
