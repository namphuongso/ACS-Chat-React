import React, { ReactNode } from 'react';
import type { ChatUser } from '../../types/chat.types';
import styles from './TypingIndicator.module.scss';

export interface TypingIndicatorProps {
  typingUsers: Array<{ user: ChatUser; startedAt: Date }>;
  renderText?: (typingUsers: ChatUser[]) => ReactNode;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = React.memo(({
  typingUsers,
  renderText,
}) => {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  const users = typingUsers.map((t) => t.user);

  const renderDefaultText = () => {
    if (users.length === 1) {
      const name = users[0].displayName || 'Someone';
      return `${name} is typing`;
    }
    if (users.length === 2) {
      const name1 = users[0].displayName || 'Someone';
      const name2 = users[1].displayName || 'Someone';
      return `${name1} and ${name2} are typing`;
    }
    if (users.length > 2) {
      const name1 = users[0].displayName || 'Someone';
      const name2 = users[1].displayName || 'Someone';
      const others = users.length - 2;
      return `${name1}, ${name2} and ${others} others are typing`;
    }
    return '';
  };

  return (
    <div className={styles.typingIndicator}>
      <span className={styles.text}>
        {renderText ? renderText(users) : renderDefaultText()}
      </span>
      <span className={styles.dots}>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
        <span className={styles.dot}></span>
      </span>
    </div>
  );
});
