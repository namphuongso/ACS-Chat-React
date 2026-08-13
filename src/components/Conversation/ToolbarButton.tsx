import React from 'react';
import styles from './ConversationFooter.module.scss';

export interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  isActive?: boolean;
  disabled?: boolean;
}

export const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, label, onClick, onMouseDown, isActive, disabled }) => {
  return (
    <button
      type="button"
      className={`${styles.iconButton} ${isActive ? styles.active : ''}`}
      aria-label={label}
      onClick={onClick}
      onMouseDown={onMouseDown}
      disabled={disabled}
    >
      {icon}
    </button>
  );
};
