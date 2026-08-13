import React, { useCallback, useRef, useState } from 'react';
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
  Send as SendIcon,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Baseline,
  PaintBucket,
  Eraser,
  List,
  ListOrdered,
  Outdent,
  Indent,
  Undo,
  Redo,
  Maximize2,
  Crop,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MessageInput } from '../MessageInput';
import type { SendMessageOptions } from '../../types/message.types';
import { uploadFile } from '../../services/fileService';
import { useMessageStore } from '../../store/messageStore';
import { useChatStore } from '../../store/chatStore';
import { generateId } from '../../utils/id';
import { ToolbarButton } from './ToolbarButton';
import styles from './ConversationFooter.module.scss';
export interface ConversationFooterProps {
  conversationId?: string;
  onSend: (content: string, options?: SendMessageOptions) => void;
  onTyping: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const ConversationFooter: React.FC<ConversationFooterProps> = React.memo(
  ({ conversationId, onSend, onTyping, disabled, autoFocus }) => {
    const { t } = useTranslation();

    const [isFormatMode, setIsFormatMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const fileAttachmentInputRef = useRef<HTMLInputElement>(null);
    const messageEditorRef = useRef<HTMLDivElement>(null);

    const handleSendImageClick = useCallback(() => {
      fileInputRef.current?.click();
    }, []);

    const handleSendFileClick = useCallback(() => {
      fileAttachmentInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const uploadPromises = Array.from(files).map(async (file) => {
          try {
            // Get image dimensions
            const dimensions = await new Promise<{ width: number; height: number }>(
              (resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve({ width: img.width, height: img.height });
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
              }
            );

            const clientMessageId = generateId();
            const tempId = `temp-${clientMessageId}`;

            if (conversationId) {
              const currentUser = useChatStore.getState().currentUser;
              if (currentUser) {
                useMessageStore.getState().addMessage(conversationId, {
                  id: tempId,
                  clientMessageId,
                  conversationId,
                  type: 'text',
                  content: '',
                  sender: currentUser,
                  createdAt: new Date(),
                  status: 'sending',
                  metadata: {
                    type: 'image',
                    url: URL.createObjectURL(file),
                    fileName: file.name,
                    mimeType: file.type,
                    width: String(dimensions.width),
                    height: String(dimensions.height),
                  },
                });
              }
            }

            // Upload file
            const url = await uploadFile(file);

            // Send message
            onSend('', {
              metadata: {
                type: 'image',
                url,
                fileName: file.name,
                mimeType: file.type,
                width: String(dimensions.width),
                height: String(dimensions.height),
              },
              clientMessageId,
            });
          } catch (error) {
            console.error('Failed to upload and send image:', error);
          }
        });

        await Promise.all(uploadPromises);

        // Clear input so the same files can be selected again if needed
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      },
      [conversationId, onSend]
    );

    const handleFileAttachmentChange = useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const uploadPromises = Array.from(files).map(async (file) => {
          try {
            const clientMessageId = generateId();
            const tempId = `temp-${clientMessageId}`;

            const baseMetadata: Record<string, string> = {
              fileName: file.name,
              mimeType: file.type,
              size: String(file.size),
            };

            let localMetadata: Record<string, string> = {
              ...baseMetadata,
              url: URL.createObjectURL(file),
            };
            let finalMetadata: Record<string, string> = { ...baseMetadata };

            if (file.type.startsWith('video/')) {
              const videoMeta = await new Promise<{
                width: number;
                height: number;
                duration: number;
              }>((resolve) => {
                const video = document.createElement('video');
                video.preload = 'metadata';
                video.onloadedmetadata = () => {
                  resolve({
                    width: video.videoWidth,
                    height: video.videoHeight,
                    duration: Math.round(video.duration),
                  });
                };
                video.onerror = () => {
                  resolve({ width: 0, height: 0, duration: 0 });
                };
                video.src = URL.createObjectURL(file);
              });

              localMetadata = {
                ...localMetadata,
                type: 'video',
                width: String(videoMeta.width),
                height: String(videoMeta.height),
                duration: String(videoMeta.duration),
              };

              finalMetadata = {
                ...finalMetadata,
                type: 'video',
                width: String(videoMeta.width),
                height: String(videoMeta.height),
                duration: String(videoMeta.duration),
              };
            } else {
              localMetadata = { ...localMetadata, type: 'file' };
              finalMetadata = { ...finalMetadata, type: 'file' };
            }

            if (conversationId) {
              const currentUser = useChatStore.getState().currentUser;
              if (currentUser) {
                useMessageStore.getState().addMessage(conversationId, {
                  id: tempId,
                  clientMessageId,
                  conversationId,
                  type: 'text',
                  content: '',
                  sender: currentUser,
                  createdAt: new Date(),
                  status: 'sending',
                  metadata: localMetadata,
                });
              }
            }

            // Upload file
            const url = await uploadFile(file);
            finalMetadata.url = url;

            // Send message
            onSend('', {
              metadata: finalMetadata,
              clientMessageId,
            });
          } catch (error) {
            console.error('Failed to upload and send file:', error);
          }
        });

        await Promise.all(uploadPromises);

        if (fileAttachmentInputRef.current) {
          fileAttachmentInputRef.current.value = '';
        }
      },
      [conversationId, onSend]
    );

    const renderToolbar = useCallback(() => {
      return (
        <>
          <ToolbarButton icon={<Smile size={20} />} label="Emoji" disabled={disabled} />
          <ToolbarButton
            icon={<ImageIcon size={20} />}
            label="Image"
            onClick={handleSendImageClick}
            disabled={disabled}
          />
          <ToolbarButton
            icon={<Paperclip size={20} />}
            label="Attachment"
            onClick={handleSendFileClick}
            disabled={disabled}
          />
          <ToolbarButton icon={<Contact size={20} />} label="Contact" disabled={disabled} />
          <ToolbarButton icon={<Crop size={20} />} label="Screenshot" disabled={disabled} />
          <ToolbarButton
            icon={<Type size={20} />}
            label="Format"
            isActive={isFormatMode}
            onClick={() => {
              setIsFormatMode((prev) => !prev);
              setTimeout(() => {
                messageEditorRef.current?.focus();
              }, 0);
            }}
            disabled={disabled}
          />
          <ToolbarButton icon={<Zap size={20} />} label="Quick Replies" disabled={disabled} />
          <ToolbarButton icon={<CreditCard size={20} />} label="Payment" disabled={disabled} />
          <ToolbarButton icon={<MoreHorizontal size={20} />} label="More" disabled={disabled} />
        </>
      );
    }, [handleSendImageClick, handleSendFileClick, isFormatMode, disabled]);

    // We have to intercept onSend to track content if we are overriding renderSendButton
    // But wait, MessageInput manages its own content state and doesn't expose it to renderSendButton.
    // Actually, MessageInput passes 'disabled' to renderSendButton.
    // The 'content' is used to check if empty, which sets `disabled`.
    // Wait, if it's disabled because empty, it means we show Thumbs Up.
    // If it's not disabled (has text), we show Send.
    const renderSendButton = useCallback(
      ({ onClick, disabled: isSendDisabled }: { onClick: () => void; disabled: boolean }) => {
        return (
          <>
            <button type="button" className={styles.iconButton} aria-label="Emoji in input">
              <Smile size={24} color="#6b7280" strokeWidth={1.5} />
            </button>
            {isSendDisabled ? (
              <button
                type="button"
                className={styles.thumbsUpButton}
                onClick={() => {
                  onSend('👍');
                  setFormatState({
                    bold: false,
                    italic: false,
                    underline: false,
                    strikeThrough: false,
                    insertUnorderedList: false,
                    insertOrderedList: false,
                  });
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
      },
      [onSend, t]
    );

    const [formatState, setFormatState] = useState({
      bold: false,
      italic: false,
      underline: false,
      strikeThrough: false,
      insertUnorderedList: false,
      insertOrderedList: false,
    });

    const updateFormatState = useCallback(() => {
      const editor = messageEditorRef.current;
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;

      if (!editor || !anchorNode || (anchorNode !== editor && !editor.contains(anchorNode))) {
        return;
      }

      const getCaretElement = () => {
        if (!anchorNode) return null;
        if (anchorNode.nodeType === Node.ELEMENT_NODE) {
          const element = anchorNode as Element;
          const nodeAtCaret = element.childNodes[selection?.anchorOffset ?? 0];
          return nodeAtCaret instanceof Element ? nodeAtCaret : element;
        }
        return anchorNode.parentElement;
      };

      const caretElement = getCaretElement();
      const isInsideTag = (tags: string[]) =>
        !!caretElement?.closest(tags.join(','));

      const state = {
        bold: isInsideTag(['b', 'strong']) || document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      };
      setFormatState(state);
    }, []);

    React.useEffect(() => {
      document.addEventListener('selectionchange', updateFormatState);
      document.addEventListener('keyup', updateFormatState);
      document.addEventListener('mouseup', updateFormatState);
      return () => {
        document.removeEventListener('selectionchange', updateFormatState);
        document.removeEventListener('keyup', updateFormatState);
        document.removeEventListener('mouseup', updateFormatState);
      };
    }, [updateFormatState]);

    const renderBottomToolbar = useCallback(() => {
      if (!isFormatMode) return null;

      const executeCommand = (e: React.MouseEvent, command: string, value?: string) => {
        e.preventDefault();
        if (disabled) return;
        const editor = messageEditorRef.current;
        if (!editor) return;

        editor.focus();

        const selection = window.getSelection();
        const anchorNode = selection?.anchorNode;
        if (selection && (!anchorNode || (anchorNode !== editor && !editor.contains(anchorNode)))) {
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }

        const isEmptyEditor =
          (editor.textContent ?? '').replace(/\u200B/g, '').trim() === '' &&
          !editor.querySelector('img');

        if (command === 'bold' && isEmptyEditor && !document.queryCommandState('bold')) {
          const strong = document.createElement('strong');
          const caretMarker = document.createTextNode('\u200B');
          strong.appendChild(caretMarker);
          editor.replaceChildren(strong);

          const range = document.createRange();
          range.setStart(caretMarker, caretMarker.length);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
          updateFormatState();
          return;
        }

        document.execCommand(command, false, value);
        updateFormatState();
      };

      return (
        <>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <ToolbarButton
              icon={<Bold size={18} />}
              label="Bold"
              isActive={formatState.bold}
              onMouseDown={(e) => executeCommand(e, 'bold')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Italic size={18} />}
              label="Italic"
              isActive={formatState.italic}
              onMouseDown={(e) => executeCommand(e, 'italic')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Underline size={18} />}
              label="Underline"
              isActive={formatState.underline}
              onMouseDown={(e) => executeCommand(e, 'underline')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Strikethrough size={18} />}
              label="Strikethrough"
              isActive={formatState.strikeThrough}
              onMouseDown={(e) => executeCommand(e, 'strikeThrough')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Baseline size={18} />}
              label="Text Color"
              onMouseDown={(e) => executeCommand(e, 'foreColor', '#ef4444')}
              disabled={disabled}
            />{' '}
            {/* Red for example */}
            <ToolbarButton
              icon={<PaintBucket size={18} />}
              label="Background Color"
              onMouseDown={(e) => executeCommand(e, 'hiliteColor', '#fef08a')}
              disabled={disabled}
            />{' '}
            {/* Yellow for example */}
            <ToolbarButton
              icon={<Eraser size={18} />}
              label="Clear Format"
              onMouseDown={(e) => executeCommand(e, 'removeFormat')}
              disabled={disabled}
            />
            <div
              style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
            />
            <ToolbarButton
              icon={<List size={18} />}
              label="Bullet List"
              isActive={formatState.insertUnorderedList}
              onMouseDown={(e) => executeCommand(e, 'insertUnorderedList')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<ListOrdered size={18} />}
              label="Numbered List"
              isActive={formatState.insertOrderedList}
              onMouseDown={(e) => executeCommand(e, 'insertOrderedList')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Outdent size={18} />}
              label="Decrease Indent"
              onMouseDown={(e) => executeCommand(e, 'outdent')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Indent size={18} />}
              label="Increase Indent"
              onMouseDown={(e) => executeCommand(e, 'indent')}
              disabled={disabled}
            />
            <div
              style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
            />
            <ToolbarButton
              icon={<Undo size={18} />}
              label="Undo"
              onMouseDown={(e) => executeCommand(e, 'undo')}
              disabled={disabled}
            />
            <ToolbarButton
              icon={<Redo size={18} />}
              label="Redo"
              onMouseDown={(e) => executeCommand(e, 'redo')}
              disabled={disabled}
            />
            <div
              style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
            />
            <ToolbarButton icon={<Maximize2 size={18} />} label="Expand" disabled={disabled} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* The Send button and Emoji are handled inside renderSendButton, but we can duplicate emoji or keep them here if we want them in bottom bar */}
          </div>
        </>
      );
    }, [isFormatMode, formatState, updateFormatState, disabled]);

    return (
      <div className={styles.wrapper}>
        <input
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          accept=".pdf,.docx,.xlsx"
          multiple
          ref={fileAttachmentInputRef}
          onChange={handleFileAttachmentChange}
          style={{ display: 'none' }}
        />
        <MessageInput
          onSend={(content, options) => {
            onSend(content, { ...options, type: 'html' });
            setFormatState({
              bold: false,
              italic: false,
              underline: false,
              strikeThrough: false,
              insertUnorderedList: false,
              insertOrderedList: false,
            });
          }}
          onTyping={onTyping}
          disabled={disabled}
          renderToolbar={renderToolbar}
          renderSendButton={renderSendButton}
          renderBottomToolbar={isFormatMode ? renderBottomToolbar : undefined}
          placeholder={
            isFormatMode ? 'Nhấn Cmd + Shift + X để định dạng tin nhắn' : t('chat.typeMessage')
          }
          autoFocus={autoFocus}
          editorRef={messageEditorRef}
        />
      </div>
    );
  }
);
