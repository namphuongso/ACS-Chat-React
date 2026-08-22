import React, { useRef, useState, useCallback, KeyboardEvent, ReactNode, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { SendIcon } from '../Icons';
import { useTranslation } from 'react-i18next';
import styles from './MessageInput.module.scss';
import { SendMessageOptions } from '../../types';
import type { LinkPreview } from '../../types/message.types';
import { normalizeFormattingHtml } from '../../utils/htmlUtils';
import { extractUrls } from '../../utils/linkUtils';
import { linkPreviewService } from '../../services/linkPreviewService';
import { LinkPreviewCard } from '../MessageItem/LinkPreviewCard';

const extractPlainText = (element: HTMLElement | null): string => {
  if (!element) return '';
  if (typeof element.innerText === 'string') {
    return element.innerText;
  }
  return element.textContent || '';
};

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
  /**
   * Detect URLs in the draft and show a link preview card before sending.
   * On send, the preview is attached to the message metadata as `linkPreview`.
   * @default true
   */
  enableLinkPreview?: boolean;
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
    enableLinkPreview = true,
  }) => {
    const [content, setContent] = useState('');
    const [plainText, setPlainText] = useState('');
    const [composeLinkPreview, setComposeLinkPreview] = useState<LinkPreview | null>(null);
    const [composeLinkPreviewLoading, setComposeLinkPreviewLoading] = useState(false);
    const [dismissedLinkPreviewUrl, setDismissedLinkPreviewUrl] = useState<string | null>(null);
    const activePreviewUrlRef = useRef<string | null>(null);
    const internalEditorRef = useRef<HTMLDivElement>(null);
    const contentEditableRef = editorRef ?? internalEditorRef;
    const isComposingRef = useRef(false);
    const isSendingRef = useRef(false);
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

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
    };

    const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
      const html = e.currentTarget.innerHTML;
      const textContent = removeCaretMarkers(e.currentTarget.textContent || '');
      if (textContent.trim() === '' && !html.includes('<img')) {
        setContent('');
        setPlainText('');
        const cleanHtml = html.trim().toLowerCase();
        if (cleanHtml === '<br>' || cleanHtml === '<div><br></div>' || cleanHtml === '<p><br></p>' || cleanHtml === '') {
          if (e.currentTarget.innerHTML !== '') {
            e.currentTarget.innerHTML = '';
          }
        }
      } else {
        setContent(removeCaretMarkers(html));
        setPlainText(textContent);
      }
      onTyping();
    };

    /**
     * Detect the first URL in the draft and resolve its preview (debounced).
     */
    useEffect(() => {
      if (!enableLinkPreview) return;

      const firstUrl = extractUrls(plainText)[0] || null;
      activePreviewUrlRef.current = firstUrl;

      if (!firstUrl || dismissedLinkPreviewUrl === firstUrl) {
        setComposeLinkPreview(null);
        setComposeLinkPreviewLoading(false);
        return;
      }

      const cached = linkPreviewService.getCached(firstUrl);
      if (cached) {
        setComposeLinkPreview(cached);
        setComposeLinkPreviewLoading(false);
        return;
      }

      setComposeLinkPreviewLoading(true);
      const timer = setTimeout(() => {
        linkPreviewService
          .fetchLinkPreview(firstUrl)
          .then((preview) => {
            if (activePreviewUrlRef.current === firstUrl) {
              setComposeLinkPreview(preview);
              setComposeLinkPreviewLoading(false);
            }
          })
          .catch(() => {
            if (activePreviewUrlRef.current === firstUrl) {
              setComposeLinkPreviewLoading(false);
            }
          });
      }, 400);

      return () => clearTimeout(timer);
    }, [plainText, enableLinkPreview, dismissedLinkPreviewUrl]);

    const handleDismissLinkPreview = useCallback(() => {
      const firstUrl = extractUrls(plainText)[0] || null;
      setDismissedLinkPreviewUrl(firstUrl);
      setComposeLinkPreview(null);
      setComposeLinkPreviewLoading(false);
    }, [plainText]);

    const buildLinkPreviewOptions = useCallback(
      (textForDetection: string): SendMessageOptions | undefined => {
        if (!enableLinkPreview) return undefined;
        const firstUrl = extractUrls(textForDetection)[0];
        if (!firstUrl) return undefined;
        const preview: LinkPreview =
          composeLinkPreview && composeLinkPreview.url === firstUrl
            ? composeLinkPreview
            : { url: firstUrl };
        return { metadata: { linkPreview: JSON.stringify(preview) } };
      },
      [enableLinkPreview, composeLinkPreview]
    );

    const handleSend = () => {
      if (isSendingRef.current || disabled) return;

      const editor = contentEditableRef.current;
      const textContent = removeCaretMarkers(extractPlainText(editor));
      const currentHtml = removeCaretMarkers(editor?.innerHTML || '');

      const resetPreviewState = () => {
        setPlainText('');
        setComposeLinkPreview(null);
        setComposeLinkPreviewLoading(false);
        setDismissedLinkPreviewUrl(null);
        activePreviewUrlRef.current = null;
      };

      if (isFormatMode) {
        if (textContent.trim() || currentHtml.includes('<img')) {
          isSendingRef.current = true;

          try {
            const linkPreviewOptions = buildLinkPreviewOptions(textContent);
            onSend(normalizeFormattingHtml(currentHtml) || '', {
              type: 'html',
              ...(linkPreviewOptions || {}),
            });
            // Only clear the editor after the send succeeded
            if (editor) {
              editor.innerHTML = '';
            }
            setContent('');
            resetPreviewState();
          } finally {
            setTimeout(() => {
              isSendingRef.current = false;
            }, 100);
          }
        }
      } else {
        if (textContent.trim()) {
          isSendingRef.current = true;

          try {
            const linkPreviewOptions = buildLinkPreviewOptions(textContent);
            if (linkPreviewOptions) {
              onSend(textContent.trim(), linkPreviewOptions);
            } else {
              onSend(textContent.trim());
            }
            // Only clear the editor after the send succeeded
            if (editor) {
              editor.innerHTML = '';
            }
            setContent('');
            resetPreviewState();
          } finally {
            setTimeout(() => {
              isSendingRef.current = false;
            }, 100);
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (isComposingRef.current || e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }

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

    const handleRowClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (contentEditableRef.current && !disabled && e.target === e.currentTarget) {
        contentEditableRef.current.focus();
      }
    };

    const isSendDisabled = disabled || content.trim().length === 0;

    const textareaClasses = `${styles.textarea} ${isFormatMode ? styles.formatMode : ''} ${isExpanded ? styles.expanded : ''}`;

    const isEmpty = content.trim().length === 0;

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
        {enableLinkPreview && composeLinkPreview && (
          <div className={styles.linkPreviewCompose}>
            <LinkPreviewCard preview={composeLinkPreview} compact />
            <button
              type="button"
              className={styles.linkPreviewClose}
              onClick={handleDismissLinkPreview}
              aria-label={t('chat.close')}
            >
              <X size={14} />
            </button>
          </div>
        )}
        {enableLinkPreview && !composeLinkPreview && composeLinkPreviewLoading && (
          <div className={styles.linkPreviewLoading}>
            <Loader size={14} />
            {t('chat.loadingLinkPreview', 'Loading preview...')}
          </div>
        )}
        <div
          className={`${styles.inputRow} ${disabled ? styles.disabled : ''}`}
          onClick={handleRowClick}
        >
          <div className={styles.editorWrapper}>
            {isEmpty && (
              <div className={`${styles.placeholder} ${isFormatMode ? styles.formatMode : ''}`}>
                {resolvedPlaceholder}
              </div>
            )}
            <div
              ref={contentEditableRef}
              className={textareaClasses}
              contentEditable={!disabled}
              role="textbox"
              aria-multiline="true"
              aria-placeholder={resolvedPlaceholder}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onPaste={handlePaste}
              suppressContentEditableWarning={true}
            />
          </div>
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
