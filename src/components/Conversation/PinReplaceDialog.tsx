import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinnedMessage } from '../../types/message.types';
import { MAX_PINNED_MESSAGES } from '../../constants';
import { CloseIcon, PinBubbleIcon } from '../Icons';
import { PinnedItemView } from './PinnedItemView';
import styles from './PinReplaceDialog.module.scss';

export interface PinReplaceDialogProps {
  isOpen: boolean;
  pinnedMessages: PinnedMessage[];
  onReplace: (selectedMessageId: string) => void;
  onCancel: () => void;
}

export const PinReplaceDialog: React.FC<PinReplaceDialogProps> = ({
  isOpen,
  pinnedMessages,
  onReplace,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'default' | 'select'>('default');
  const [selectedId, setSelectedId] = useState<string>('');

  // Ensure pins are sorted oldest-first so the first item is always the oldest,
  // even if the store returns them in an arbitrary order.
  const sortedMessages = useMemo(() => {
    return [...pinnedMessages].sort((a, b) => {
      const timeA = new Date(a.createdDate).getTime();
      const timeB = new Date(b.createdDate).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) {
        return timeA - timeB;
      }
      if (!Number.isNaN(timeA)) return -1;
      if (!Number.isNaN(timeB)) return 1;
      return 0;
    });
  }, [pinnedMessages]);

  const oldestMessage = sortedMessages[0];

  useEffect(() => {
    if (isOpen) {
      setMode('default');
      setSelectedId(oldestMessage?.messageId || '');
    }
  }, [isOpen, oldestMessage?.messageId]);

  if (!isOpen) return null;

  const handleUpdate = () => {
    if (sortedMessages.length === 0) return;
    if (mode === 'default') {
      if (oldestMessage) {
        onReplace(oldestMessage.messageId);
      }
    } else {
      if (selectedId) {
        onReplace(selectedId);
      }
    }
  };

  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div
        className={styles.dialogContent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-replace-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.dialogHeader}>
          <h3 id="pin-replace-dialog-title" className={styles.dialogTitle}>
            {t('chat.updatePinList', 'Update pin list')}
          </h3>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onCancel}
            aria-label={t('chat.close', 'Close')}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>

        {/* Body */}
        <div className={styles.dialogBody}>
          <p className={styles.dialogDescription}>
            {mode === 'default'
              ? t(
                  'chat.pinLimitExceededDesc',
                  'Exceed the limit of {{count}} pins. The old pin below will be removed in order to update the new one.',
                  { count: MAX_PINNED_MESSAGES }
                )
              : t(
                  'chat.pinLimitSelectDesc',
                  'Exceed the limit of {{count}} pins. Please select a pin to remove and pin the new one.',
                  { count: MAX_PINNED_MESSAGES }
                )}
          </p>

          {sortedMessages.length === 0 && (
            <div className={styles.emptyState}>
              <PinBubbleIcon width={28} height={28} />
              <p className={styles.emptyStateText}>{t('chat.noPinnedMessages', 'No pinned messages to replace.')}</p>
            </div>
          )}

          {mode === 'default' && oldestMessage && (
            <div className={styles.singleCard}>
              <div className={styles.itemLeft}>
                <div className={styles.iconWrapper}>
                  <PinBubbleIcon width={22} height={22} />
                </div>
                <div className={styles.itemInfo}>
                  <div className={styles.itemHeader}>{t('chat.message', 'Message')}</div>
                  <PinnedItemView message={oldestMessage} />
                </div>
              </div>
              <button
                type="button"
                className={styles.changeButton}
                onClick={() => {
                  setMode('select');
                  setSelectedId('');
                }}
              >
                {t('chat.change', 'Change')}
              </button>
            </div>
          )}

          {mode === 'select' && (
            <div className={styles.listCard} role="radiogroup" aria-label={t('chat.selectMessageToReplace', 'Select a pin to remove')}>
              {sortedMessages.map((msg, index) => {
                const isSelected = selectedId === msg.messageId;
                return (
                  <div
                    key={msg.messageId || index}
                    className={`${styles.listItem} ${isSelected ? styles.listItemSelected : ''}`}
                    onClick={() => setSelectedId(msg.messageId)}
                    role="radio"
                    tabIndex={isSelected ? 0 : -1}
                    aria-checked={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(msg.messageId);
                      }
                    }}
                  >
                    <div className={styles.itemLeft}>
                      <div className={styles.iconWrapper}>
                        <PinBubbleIcon width={22} height={22} />
                      </div>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemHeader}>{t('chat.message', 'Message')}</div>
                        <PinnedItemView message={msg} />
                      </div>
                    </div>
                    <div
                      className={`${styles.radioCircle} ${isSelected ? styles.radioSelected : ''}`}
                    >
                      {isSelected && (
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="2.5 6 5 8.5 9.5 3.5" />
                        </svg>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.dialogFooter}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            {t('chat.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            className={styles.updateBtn}
            disabled={mode === 'select' && !selectedId}
            onClick={handleUpdate}
          >
            {t('chat.update', 'Update')}
          </button>
        </div>
      </div>
    </div>
  );
};
