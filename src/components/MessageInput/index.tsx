import React, { useRef, useState, useCallback, KeyboardEvent, ReactNode, useEffect } from 'react';
import { SendIcon } from '../Icons';
import { useTranslation } from 'react-i18next';
import styles from './MessageInput.module.scss';
import { SendMessageOptions } from '../../types';

const removeCaretMarkers = (value: string) => value.replace(/\u200B/g, '');

export interface MessageInputProps {
  onSend: (content: string, options?: SendMessageOptions) => void;
  onTyping: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  renderSendButton?: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  renderToolbar?: () => ReactNode;
  renderBottomToolbar?: () => ReactNode;
  autoFocus?: boolean;
  editorRef?: React.RefObject<HTMLDivElement>;
  isFormatMode?: boolean;
  isExpanded?: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = React.memo(
  ({
    onSend,
    onTyping,
    placeholder,
    disabled = false,
    maxLength,
    renderSendButton,
    renderToolbar,
    renderBottomToolbar,
    autoFocus = false,
    editorRef,
    isFormatMode = false,
    isExpanded = false,
  }) => {
    const [content, setContent] = useState('');
    const internalEditorRef = useRef<HTMLDivElement>(null);
    const contentEditableRef = editorRef ?? internalEditorRef;
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder || t('chat.typeMessage');

    const resizeTextarea = useCallback(() => {
      // contentEditable automatically resizes, no need for manual height adjustment unless we want max-height which is handled by CSS
    }, []);

    useEffect(() => {
      // We don't need manual resize
    }, [content, resizeTextarea]);

    useEffect(() => {
      if (autoFocus && contentEditableRef.current && !disabled) {
        contentEditableRef.current.focus();
      }
    }, [autoFocus, contentEditableRef, disabled]);

    useEffect(() => {
      const handleFocusEvent = () => {
        if (contentEditableRef.current && !disabled) {
          contentEditableRef.current.focus();
        }
      };
      window.addEventListener('focusMessageInput', handleFocusEvent);
      return () => {
        window.removeEventListener('focusMessageInput', handleFocusEvent);
      };
    }, [contentEditableRef, disabled]);

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const html = e.currentTarget.innerHTML;
      const textContent = removeCaretMarkers(e.currentTarget.textContent || '');
      if (textContent.trim() === '' && !html.includes('<img')) {
        setContent('');
        const cleanHtml = html.trim().toLowerCase();
        if (cleanHtml === '<br>' || cleanHtml === '<div><br></div>' || cleanHtml === '<p><br></p>' || cleanHtml === '') {
          if (e.currentTarget.innerHTML !== '') {
            e.currentTarget.innerHTML = '';
          }
        }
      } else {
        setContent(removeCaretMarkers(html));
      }
      onTyping();
    };

    const handleSend = () => {
      const textContent = removeCaretMarkers(contentEditableRef.current?.textContent || '');
      const currentHtml = removeCaretMarkers(contentEditableRef.current?.innerHTML || '');
      if ((textContent.trim() || currentHtml.includes('<img')) && !disabled) {
        onSend(currentHtml);
        setContent('');
        if (contentEditableRef.current) {
          contentEditableRef.current.innerHTML = '';
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        // Force a new block element (div/p/li) instead of a <br>
        // This allows each line to be indented independently.
        document.execCommand('insertParagraph', false);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        e.preventDefault();
        document.execCommand('insertText', false, text);
      }
    };

    const isSendDisabled = disabled || content.trim().length === 0;

    const textareaClasses = `${styles.textarea} ${isFormatMode ? styles.formatMode : ''} ${isExpanded ? styles.expanded : ''}`;

    const actionsContent = (
      <div className={`${styles.actions} ${!isFormatMode ? styles.actionsAbsolute : ''}`}>
        {renderSendButton ? (
          renderSendButton({ onClick: handleSend, disabled: isSendDisabled })
        ) : (
          <button
            type="button"
            className={content.trim() ? styles.sendButtonFilled : styles.sendButton}
            onClick={handleSend}
            disabled={isSendDisabled}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        )}
      </div>
    );

    return (
      <div className={styles.container}>
        {renderToolbar && <div className={styles.toolbar}>{renderToolbar()}</div>}
        <div className={`${styles.inputRow} ${disabled ? styles.disabled : ''}`}>
          <div
            ref={contentEditableRef}
            className={textareaClasses}
            contentEditable={!disabled}
            role="textbox"
            aria-multiline="true"
            aria-placeholder={resolvedPlaceholder}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            data-placeholder={resolvedPlaceholder}
            suppressContentEditableWarning={true}
          />
          {!isFormatMode && actionsContent}
        </div>
        {maxLength && (
          <div className={styles.footer}>
            <div className={styles.characterCount}>{`${content.length}/${maxLength}`}</div>
          </div>
        )}
        {renderBottomToolbar && isFormatMode && (
          <div className={styles.bottomToolbar}>
            {renderBottomToolbar()}
            {actionsContent}
          </div>
        )}
      </div>
    );
  }
);
