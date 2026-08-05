import React from 'react';
import styles from './LoadingState.module.scss';

export interface LoadingStateProps {
  message?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = React.memo(({ 
  message = 'Đang tải...', 
  className = '' 
}) => {
  return (
    <div className={`${styles.loadingState} ${className}`}>
      <div className={styles.spinner} />
      {message && <p className={styles.message}>{message}</p>}
    </div>
  );
});
