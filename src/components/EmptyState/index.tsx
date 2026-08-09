import React from 'react';
import styles from './EmptyState.module.scss';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

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
        return t('chat.noConversationsFound');
      case 'no-messages':
        return t('chat.noMessages');
      case 'no-participants':
        return t('chat.noParticipants');
      default:
        return t('chat.noDataToDisplay');
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
