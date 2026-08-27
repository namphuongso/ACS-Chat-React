import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePinnedMessages, useJumpToMessage } from '../../hooks';
import { MessageIcon, MoreHorizontalIcon, ChevronDownIcon, ChevronUpIcon } from '../Icons';
import { PinDropdownMenu } from './PinDropdownMenu';
import { PinnedItemView } from './PinnedItemView';
import styles from './PinnedMessageBanner.module.scss';

export interface PinnedMessageBannerProps {
  conversationId: string;
  backendConversationId?: string;
  pinnedMessageIds?: Set<string> | string[];
  isGroup?: boolean;
  onUnpinMessage: (messageId: string, pin: boolean) => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const PinnedMessageBanner: React.FC<PinnedMessageBannerProps> = ({
  conversationId,
  backendConversationId,
  pinnedMessageIds,
  isGroup,
  onUnpinMessage,
  onJumpToMessage,
}) => {
  const { t } = useTranslation();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right: number } | null>(
    null
  );
  const [isPinboardOpen, setIsPinboardOpen] = useState(false);

  const bannerRef = useRef<HTMLDivElement>(null);

  // Convert string[] | Set<string> to array for dependency checking
  const pinnedMessageIdsArray = Array.from(pinnedMessageIds || []);

  const { pinnedMessages, setPinnedMessages } = usePinnedMessages(
    conversationId,
    backendConversationId,
    [pinnedMessageIdsArray.join(',')]
  );

  const { jumpToMessage } = useJumpToMessage();

  // Click outside handler for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        openDropdownId &&
        !(event.target as Element).closest(`.${styles.dropdownMenu}`) &&
        !(event.target as Element).closest(`.${styles.moreButton}`)
      ) {
        setOpenDropdownId(null);
        setDropdownPosition(null);
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
  }, [openDropdownId, isPinboardOpen]);

  if (pinnedMessages.length === 0) return null;

  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    if (openDropdownId === id) {
      setOpenDropdownId(null);
      setDropdownPosition(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setOpenDropdownId(id);
    }
  };

  const handleUnpin = (messageId: string) => {
    onUnpinMessage(messageId, false);
    setOpenDropdownId(null);
    setDropdownPosition(null);
    // Optimistic update
    setPinnedMessages(pinnedMessages.filter((m) => m.messageId !== messageId));
    if (pinnedMessages.length === 1) {
      setIsPinboardOpen(false);
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    jumpToMessage(messageId, conversationId);
    if (onJumpToMessage) {
      onJumpToMessage(messageId);
    }
    setIsPinboardOpen(false);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setOpenDropdownId(null);
    setDropdownPosition(null);
  };

  const handleOpenGroupBoard = () => {
    // Integration point for opening group board
    setOpenDropdownId(null);
    setDropdownPosition(null);
    setIsPinboardOpen(false);
  };

  const firstMessage = pinnedMessages[0];

  return (
    <div className={styles.bannerContainer} ref={bannerRef}>
      {/* Keep the static content in DOM but visually hidden when open to preserve height and prevent layout shift */}
      <div
        className={styles.leftSection}
        role="button"
        tabIndex={0}
        onClick={() => handleJumpToMessage(firstMessage.messageId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleJumpToMessage(firstMessage.messageId);
          }
        }}
        style={{
          cursor: 'pointer',
          visibility: isPinboardOpen ? 'hidden' : 'visible',
          opacity: isPinboardOpen ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        <div className={styles.iconWrapper}>
          <MessageIcon width={16} height={16} />
        </div>
        <div className={styles.contentWrapper}>
          <div className={styles.headerTitle}>{t('chat.message')}</div>
          <div className={styles.messageContent}>
            <PinnedItemView message={firstMessage} />
          </div>
        </div>
      </div>
      <div
        className={styles.rightSection}
        style={{
          visibility: isPinboardOpen ? 'hidden' : 'visible',
          opacity: isPinboardOpen ? 0 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        {pinnedMessages.length > 1 && (
          <button className={styles.pinCountButton} onClick={() => setIsPinboardOpen(true)}>
            {t('chat.pinCount', { count: pinnedMessages.length - 1 })}{' '}
            <ChevronDownIcon width={16} height={16} />
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button className={styles.moreButton} onClick={(e) => toggleDropdown(e, 'banner')}>
            <MoreHorizontalIcon width={20} height={20} />
          </button>
          {openDropdownId === 'banner' && dropdownPosition && (
            <PinDropdownMenu
              position={dropdownPosition}
              onCopy={() => handleCopy(firstMessage.content)}
              onOpenGroupBoard={isGroup ? handleOpenGroupBoard : undefined}
              onUnpin={() => handleUnpin(firstMessage.messageId)}
            />
          )}
        </div>
      </div>

      {isPinboardOpen && (
        <div className={styles.pinboardOverlay}>
          <div className={styles.pinboardHeader}>
            <div className={styles.pinboardTitle}>
              {t('chat.pinboard', { count: pinnedMessages.length })}
            </div>
            <button className={styles.collapseButton} onClick={() => setIsPinboardOpen(false)}>
              {t('chat.collapse')} <ChevronUpIcon width={16} height={16} />
            </button>
          </div>
          <div
            className={styles.pinboardList}
            onScroll={() => {
              setOpenDropdownId(null);
              setDropdownPosition(null);
            }}
          >
            {pinnedMessages.map((msg) => (
              <div key={msg.messageId} className={styles.pinboardItem}>
                <div
                  className={styles.leftSection}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleJumpToMessage(msg.messageId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleJumpToMessage(msg.messageId);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className={styles.iconWrapper}>
                    <MessageIcon width={16} height={16} />
                  </div>
                  <div className={styles.contentWrapper}>
                    <div className={styles.headerTitle}>{t('chat.message')}</div>
                    <div className={styles.messageContent}>
                      <PinnedItemView message={msg} />
                    </div>
                  </div>
                </div>
                <div className={styles.rightSection}>
                  <button
                    className={styles.moreButton}
                    onClick={(e) => toggleDropdown(e, msg.messageId)}
                  >
                    <MoreHorizontalIcon width={16} height={16} />
                  </button>
                  {openDropdownId === msg.messageId && dropdownPosition && (
                    <PinDropdownMenu
                      position={dropdownPosition}
                      onCopy={() => handleCopy(msg.content)}
                      onUnpin={() => handleUnpin(msg.messageId)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
          {isGroup && (
            <div className={styles.pinboardFooter}>
              <button className={styles.viewAllButton} onClick={handleOpenGroupBoard}>
                {t('chat.viewAllInGroupBoard')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
