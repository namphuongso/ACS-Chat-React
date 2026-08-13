import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './PinnedMessageBanner.module.scss';

export interface PinDropdownMenuProps {
  position: { top: number; right: number };
  onPinToTop?: () => void;
  onCopy: () => void;
  onOpenGroupBoard?: () => void;
  onUnpin: () => void;
}

export const PinDropdownMenu: React.FC<PinDropdownMenuProps> = ({
  position,
  onPinToTop,
  onCopy,
  onOpenGroupBoard,
  onUnpin,
}) => {
  const { t } = useTranslation();
  return (
    <div
      className={styles.dropdownMenu}
      style={{
        position: 'fixed',
        top: position.top,
        right: position.right,
      }}
    >
      {onPinToTop && (
        <>
          <button className={styles.dropdownItem} onClick={onPinToTop}>
            {t('chat.pinToTop', 'Pin to top')}
          </button>
          <div className={styles.dropdownDivider} />
        </>
      )}
      <button className={styles.dropdownItem} onClick={onCopy}>
        {t('chat.copy')}
      </button>
      {onOpenGroupBoard && (
        <button className={styles.dropdownItem} onClick={onOpenGroupBoard}>
          {t('chat.openGroupBoard')}
        </button>
      )}
      <div className={styles.dropdownDivider} />
      <button className={`${styles.dropdownItem} ${styles.danger}`} onClick={onUnpin}>
        {t('chat.unpin')}
      </button>
    </div>
  );
};
