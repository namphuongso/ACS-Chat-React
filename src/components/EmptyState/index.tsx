import React from 'react';
import styles from './EmptyState.module.scss';
import { MessageIcon, UserPlusIcon } from '../Icons';

export interface EmptyStateProps {
  type: 'no-conversations' | 'no-messages' | 'no-participants';
  message?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({ 
  type,
  message,
  className = ''
}) => {
  const getIcon = () => {
    switch (type) {
      case 'no-conversations':
      case 'no-messages':
        return <MessageIcon width={48} height={48} />;
      case 'no-participants':
        return <UserPlusIcon width={48} height={48} />;
      default:
        return null;
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'no-conversations':
        return 'Không có cuộc hội thoại nào';
      case 'no-messages':
        return 'Chưa có tin nhắn nào';
      case 'no-participants':
        return 'Không có thành viên nào';
      default:
        return 'Không có dữ liệu';
    }
  };

  return (
    <div className={`${styles.emptyState} ${className}`}>
      <div className={styles.iconContainer}>
        {getIcon()}
      </div>
      <p className={styles.message}>{message || getDefaultMessage()}</p>
    </div>
  );
});
