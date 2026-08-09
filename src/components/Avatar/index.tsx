import React from 'react';
import styles from './Avatar.module.scss';

export interface AvatarProps {
  url?: string;
  name: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = React.memo(({ url, name, className = '' }) => {
  return (
    <div className={`${styles.avatarWrapper} ${className}`}>
      {url ? (
        <img src={url} alt={name} className={styles.avatarImage} loading="lazy" />
      ) : (
        <div className={styles.avatarFallback}>{(name || '?').charAt(0).toUpperCase()}</div>
      )}
    </div>
  );
});
