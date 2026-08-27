import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../../types/message.types';
import styles from './MessageItem.module.scss';
import {
  QuoteIcon,
  ForwardIcon,
  MoreHorizontalIcon,
  CopyIcon,
  PinIcon,
  PinOffIcon,
  StarIcon,
  ListChecksIcon,
  InfoIcon,
  ChevronRightIcon,
  UndoIcon,
  TrashIcon,
  EditIcon,
} from '../Icons';

export interface MessageActionsProps {
  message: ChatMessage;
  isOwn: boolean;
  isPinned?: boolean;
  renderActions?: (message: ChatMessage) => React.ReactNode;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  onPin?: (messageId: string, pin: boolean) => void;
  onStar?: (messageId: string) => void;
  onSelect?: (messageId: string) => void;
  onViewDetails?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onRecall?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
}

export const MessageActions: React.FC<MessageActionsProps> = React.memo(
  ({
    message,
    isOwn,
    isPinned = false,
    renderActions,
    onReply,
    onForward,
    onCopy,
    onPin,
    onStar,
    onSelect,
    onViewDetails,
    onEdit,
    onRecall,
    onDelete,
  }) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState<'down' | 'up'>('down');
    const [dropdownCoords, setDropdownCoords] = useState<{
      top?: number;
      bottom?: number;
      left?: number;
      right?: number;
    }>({});
    const actionsRef = useRef<HTMLDivElement>(null);
    const moreBtnRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isDropdownOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(target) &&
          moreBtnRef.current &&
          !moreBtnRef.current.contains(target)
        ) {
          setIsDropdownOpen(false);
        }
      };

      const handleScrollOrResize = () => {
        setIsDropdownOpen(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }, [isDropdownOpen]);

    const handleActionClick = (actionFn?: (id: string) => void) => {
      if (actionFn) {
        actionFn(message.id);
      }
      setIsDropdownOpen(false);
    };

    const handleToggleDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isUp = spaceBelow < 350 && rect.top > spaceBelow;

      if (isUp) {
        setDropdownPosition('up');
        setDropdownCoords({
          bottom: Math.max(8, window.innerHeight - rect.top + 4),
          left: isOwn ? undefined : Math.max(8, rect.left),
          right: isOwn ? Math.max(8, window.innerWidth - rect.right) : undefined,
        });
      } else {
        setDropdownPosition('down');
        setDropdownCoords({
          top: Math.max(8, rect.bottom + 4),
          left: isOwn ? undefined : Math.max(8, rect.left),
          right: isOwn ? Math.max(8, window.innerWidth - rect.right) : undefined,
        });
      }
      setIsDropdownOpen(true);
    };

    if (renderActions) {
      return (
        <div ref={actionsRef} className={`${styles.actions} ${isDropdownOpen ? styles.dropdownOpen : ''}`}>
          {renderActions(message)}
        </div>
      );
    }

    return (
      <div
        ref={actionsRef}
        className={`${styles.actions} ${isDropdownOpen ? styles.dropdownOpen : ''}`}
      >
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
            ref={moreBtnRef}
            className={styles.actionIconBtn}
            onClick={handleToggleDropdown}
            title={t('chat.moreOptions')}
          >
            <MoreHorizontalIcon />
          </button>

          {isDropdownOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                ref={dropdownRef}
                className={`${styles.dropdownMenu} ${dropdownPosition === 'up' ? styles.dropdownMenuUp : ''}`}
                style={{
                  top: dropdownCoords.top !== undefined ? `${dropdownCoords.top}px` : undefined,
                  bottom:
                    dropdownCoords.bottom !== undefined ? `${dropdownCoords.bottom}px` : undefined,
                  left: dropdownCoords.left !== undefined ? `${dropdownCoords.left}px` : undefined,
                  right:
                    dropdownCoords.right !== undefined ? `${dropdownCoords.right}px` : undefined,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <button className={styles.dropdownItem} onClick={() => handleActionClick(onCopy)}>
                  <CopyIcon /> {t('chat.copyText')}
                </button>
                <div className={styles.dropdownDivider} />

                <button
                  className={styles.dropdownItem}
                  onClick={() => {
                    if (onPin) onPin(message.id, !isPinned);
                    setIsDropdownOpen(false);
                  }}
                >
                  {isPinned ? (
                    <>
                      <PinOffIcon /> {t('chat.unpinMessage', 'Unpin')}
                    </>
                  ) : (
                    <>
                      <PinIcon /> {t('chat.pinMessage')}
                    </>
                  )}
                </button>
                <button className={styles.dropdownItem} onClick={() => handleActionClick(onStar)}>
                  <StarIcon /> {t('chat.starMessage')}
                </button>
                <button className={styles.dropdownItem} onClick={() => handleActionClick(onSelect)}>
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
                    <button className={styles.dropdownItem} onClick={() => handleActionClick(onEdit)}>
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

                {isOwn && (
                  <button
                    className={`${styles.dropdownItem} ${styles.dangerItem}`}
                    onClick={() => handleActionClick(onDelete)}
                  >
                    <TrashIcon /> {t('chat.deleteMessage')}
                  </button>
                )}
              </div>,
              document.body
            )}
        </div>
      </div>
    );
  }
);
