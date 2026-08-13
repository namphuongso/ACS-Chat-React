import { useCallback, useEffect, useRef, useState } from 'react';
import type { SendMessageOptions } from '../../types/message.types';
import { uploadFile } from '../../services/fileService';
import { useMessageStore } from '../../store/messageStore';
import { useChatStore } from '../../store/chatStore';
import { generateId } from '../../utils/id';

export interface UseConversationFooterProps {
  conversationId?: string;
  onSend: (content: string, options?: SendMessageOptions) => void;
  disabled?: boolean;
}

export function useConversationFooter({
  conversationId,
  onSend,
  disabled,
}: UseConversationFooterProps) {
  const [isFormatMode, setIsFormatMode] = useState(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAttachmentInputRef = useRef<HTMLInputElement>(null);
  const messageEditorRef = useRef<HTMLDivElement>(null);

  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    fontSize: '3',
  });

  const updateFormatState = useCallback(() => {
    const editor = messageEditorRef.current;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;

    if (!editor || !anchorNode || (anchorNode !== editor && !editor.contains(anchorNode))) {
      return;
    }

    const state = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      fontSize: document.queryCommandValue('fontSize') || '3',
    };
    setFormatState(state);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', updateFormatState);
    document.addEventListener('keyup', updateFormatState);
    document.addEventListener('mouseup', updateFormatState);
    return () => {
      document.removeEventListener('selectionchange', updateFormatState);
      document.removeEventListener('keyup', updateFormatState);
      document.removeEventListener('mouseup', updateFormatState);
    };
  }, [updateFormatState]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target as Node)) {
        setIsFontSizeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

          const url = await uploadFile(file);

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

          const url = await uploadFile(file);
          finalMetadata.url = url;

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

  const executeCommand = useCallback(
    (e: React.MouseEvent, command: string, value?: string) => {
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
    },
    [disabled, updateFormatState]
  );

  const resetFormatState = useCallback(() => {
    setFormatState({
      bold: false,
      italic: false,
      underline: false,
      strikeThrough: false,
      insertUnorderedList: false,
      insertOrderedList: false,
      fontSize: '3',
    });
  }, []);

  return {
    isFormatMode,
    setIsFormatMode,
    isFontSizeMenuOpen,
    setIsFontSizeMenuOpen,
    fontSizeMenuRef,
    fileInputRef,
    fileAttachmentInputRef,
    messageEditorRef,
    formatState,
    updateFormatState,
    handleSendImageClick,
    handleSendFileClick,
    handleFileChange,
    handleFileAttachmentChange,
    executeCommand,
    resetFormatState,
  };
}
