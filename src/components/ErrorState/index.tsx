import React from 'react';
import styles from './ErrorState.module.scss';
import type { ChatError } from '../../types/errors.types';

import { AlertIcon } from '../Icons';

export interface ErrorStateProps {
  error: ChatError;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = React.memo(({ 
  error,
  onRetry,
  className = ''
}) => {
  return (
    <div className={`${styles.errorState} ${className}`}>
      <div className={styles.iconContainer}>
        <AlertIcon />
      </div>
      <h4 className={styles.title}>Đã xảy ra lỗi</h4>
      <p className={styles.message}>{error.message}</p>
      
      {onRetry && error.retryable && (
        <button 
          className={styles.retryButton} 
          onClick={onRetry}
          type="button"
        >
          Thử lại
        </button>
      )}
    </div>
  );
});
