import React, { useRef, useState, useCallback, KeyboardEvent, ChangeEvent, ReactNode, useEffect } from 'react';
import { SendIcon } from '../Icons';
import styles from './MessageInput.module.scss';

export interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  renderSendButton?: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  renderToolbar?: () => ReactNode;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSend,
  onTyping,
  placeholder = 'Type a message...',
  disabled = false,
  maxLength,
  renderSendButton,
  renderToolbar,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping();
  };

  const handleSend = () => {
    const trimmed = content.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setContent('');
      // Reset height after clearing content
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isSendDisabled = disabled || content.trim().length === 0;

  return (
    <div className={styles.container}>
      {renderToolbar && <div className={styles.toolbar}>{renderToolbar()}</div>}
      <div className={`${styles.inputWrapper} ${disabled ? styles.disabled : ''}`}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          rows={1}
        />
        {(maxLength || renderToolbar) && (
          <div className={styles.footer}>
            <div className={styles.characterCount}>
              {maxLength ? `${content.length}/${maxLength}` : ''}
            </div>
          </div>
        )}
      </div>
      {renderSendButton ? (
        renderSendButton({ onClick: handleSend, disabled: isSendDisabled })
      ) : (
        <button
          type="button"
          className={styles.sendButton}
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      )}
    </div>
  );
};
