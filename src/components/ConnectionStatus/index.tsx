import React, { ReactNode } from 'react';
import type { ConnectionState } from '../../types/chat.types';
import { InfoIcon } from '../Icons';
import styles from './ConnectionStatus.module.scss';

export interface ConnectionStatusProps {
  state: ConnectionState;
  onRetry?: () => void;
  renderBanner?: (state: ConnectionState, onRetry?: () => void) => ReactNode;
}

const getStateMessage = (state: ConnectionState): string => {
  switch (state) {
    case 'connecting':
      return 'Đang kết nối...';
    case 'reconnecting':
      return 'Đang kết nối lại...';
    case 'disconnected':
      return 'Mất kết nối.';
    case 'error':
      return 'Lỗi kết nối.';
    case 'connected':
      return 'Đã kết nối.';
    default:
      return '';
  }
};

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  onRetry,
  renderBanner,
}) => {
  if (state === 'connected') {
    // Optionally we can render nothing when connected, but let's allow custom renderers to decide
    // For default banner, we don't show anything when connected
    if (!renderBanner) return null;
  }

  if (renderBanner) {
    return <>{renderBanner(state, onRetry)}</>;
  }

  const message = getStateMessage(state);
  const showRetry = state === 'error' || state === 'disconnected';

  return (
    <div className={`${styles.banner} ${styles[state]}`}>
      <InfoIcon className={styles.icon} />
      <span>{message}</span>
      {showRetry && onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          Thử lại
        </button>
      )}
    </div>
  );
};
