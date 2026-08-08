import React, { ReactNode } from 'react';
import styles from './ConversationList.module.scss';

export interface SectionHeaderProps {
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ children, style, className }) => {
  return (
    <div className={`${styles.sectionHeader}${className ? ` ${className}` : ''}`} style={style}>
      {children}
    </div>
  );
};
