import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './LoadingState.module.scss';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = React.memo(({ 
  message, 
  className = '' 
}) => {
  const { t } = useTranslation();
  const displayMessage = message !== undefined ? message : t('chat.loading');

  return (
    <div className={`${styles.loadingState} ${className}`}>
      <div className={styles.spinner} />
      {displayMessage && <p className={styles.message}>{displayMessage}</p>}
    </div>
  );
});
