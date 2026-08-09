import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './ConfirmDialog.module.scss';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Huỷ',
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialogContent}>
        <h3 className={styles.dialogHeader}>{title}</h3>
        <p className={styles.dialogBody}>{message}</p>
        <div className={styles.dialogFooter}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            {cancelText || t('chat.cancel')}
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            {confirmText || t('chat.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
