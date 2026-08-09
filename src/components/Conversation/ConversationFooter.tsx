import React, { useCallback } from 'react';
import { 
  Smile, 
  Image as ImageIcon, 
  Paperclip, 
  Contact, 
  Type, 
  Zap, 
  CreditCard, 
  MoreHorizontal,
  ThumbsUp,
  Send as SendIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MessageInput } from '../MessageInput';
import styles from './ConversationFooter.module.scss';

export interface ConversationFooterProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}

export const ConversationFooter: React.FC<ConversationFooterProps> = React.memo(({
  onSend,
  onTyping,
  disabled
}) => {
  const { t } = useTranslation();

  const renderToolbar = useCallback(() => {
    return (
      <>
        <button type="button" className={styles.iconButton} aria-label="Emoji">
          <Smile size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Image">
          <ImageIcon size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Attachment">
          <Paperclip size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Contact">
          <Contact size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Format">
          <Type size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Quick Replies">
          <Zap size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="Payment">
          <CreditCard size={20} />
        </button>
        <button type="button" className={styles.iconButton} aria-label="More">
          <MoreHorizontal size={20} />
        </button>
      </>
    );
  }, []);

  // We have to intercept onSend to track content if we are overriding renderSendButton
  // But wait, MessageInput manages its own content state and doesn't expose it to renderSendButton.
  // Actually, MessageInput passes 'disabled' to renderSendButton.
  // The 'content' is used to check if empty, which sets `disabled`.
  // Wait, if it's disabled because empty, it means we show Thumbs Up.
  // If it's not disabled (has text), we show Send.
  const renderSendButton = useCallback(({ onClick, disabled: isSendDisabled }: { onClick: () => void; disabled: boolean }) => {
    return (
      <>
        <button type="button" className={styles.iconButton} aria-label="Emoji in input">
          <Smile size={24} color="#6b7280" strokeWidth={1.5} />
        </button>
        {isSendDisabled ? (
          <button
            type="button"
            className={styles.thumbsUpButton}
            onClick={() => onSend('👍')}
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
  }, [onSend]);

  return (
    <div className={styles.wrapper}>
      <MessageInput 
        onSend={onSend} 
        onTyping={onTyping} 
        disabled={disabled}
        renderToolbar={renderToolbar}
        renderSendButton={renderSendButton}
        placeholder={t('chat.typeMessage')}
      />
    </div>
  );
});
