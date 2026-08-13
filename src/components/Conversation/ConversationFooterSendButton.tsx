import React from 'react';
import { Smile, ThumbsUp, Send as SendIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './ConversationFooter.module.scss';
import type { SendMessageOptions } from '../../types/message.types';

export interface ConversationFooterSendButtonProps {
  isSendDisabled: boolean;
  onClick: () => void;
  onSend: (content: string, options?: SendMessageOptions) => void;
  resetFormatState: () => void;
}

export const ConversationFooterSendButton: React.FC<ConversationFooterSendButtonProps> = ({
  isSendDisabled,
  onClick,
  onSend,
  resetFormatState,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <button type="button" className={styles.iconButton} aria-label={t('chat.emojiInInput')}>
        <Smile size={24} color="#6b7280" strokeWidth={1.5} />
      </button>
      {isSendDisabled ? (
        <button
          type="button"
          className={styles.thumbsUpButton}
          onClick={() => {
            onSend('👍');
            resetFormatState();
          }}
          aria-label={t('chat.sendThumbsUp')}
        >
          <ThumbsUp size={24} color="#f59e0b" fill="#f59e0b" />
        </button>
      ) : (
        <button
          type="button"
          className={styles.sendButton}
          onClick={onClick}
          aria-label={t('chat.sendMessage')}
        >
          <SendIcon size={20} />
        </button>
      )}
    </>
  );
};
