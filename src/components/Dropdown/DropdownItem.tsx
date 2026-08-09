import React from 'react';
import styles from './Dropdown.module.scss';

export interface DropdownItemProps {
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  danger?: boolean;
}

export const DropdownItem: React.FC<DropdownItemProps> = ({ onClick, children, rightContent, danger }) => {
  return (
    <button
      className={danger ? `${styles.dropdownItem} ${styles.dangerItem}` : styles.dropdownItem}
      onClick={onClick}
    >
      {children}
      {rightContent && <div className={styles.rightContent}>{rightContent}</div>}
    </button>
  );
};
