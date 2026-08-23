import { useCallback, useEffect, useRef, useState } from 'react';
import type { MessageMetadata, SendMessageOptions } from '../../types/message.types';
import { uploadFile } from '../../services/fileService';
import { useMessageStore } from '../../store/messageStore';
import { useChatStore } from '../../store/chatStore';
import { generateId } from '../../utils/id';
import { safeNormalizeFormattingElement } from '../../utils/htmlUtils';
import { isLargeImage } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAttachmentInputRef = useRef<HTMLInputElement>(null);
  const messageEditorRef = useRef<HTMLDivElement>(null);

  const historyRef = useRef<string[]>(['']);
  const historyIndexRef = useRef<number>(0);
  const isUndoRedoAction = useRef(false);

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
    try {
      setFormatState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        fontSize: document.queryCommandValue('fontSize') || '3',
      });
    } catch (e) {
      // Ignore if queryCommand fails
    }
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

  useEffect(() => {
    const editor = messageEditorRef.current;
    if (!editor) return;

    const handleInput = () => {
      if (isUndoRedoAction.current) {
        isUndoRedoAction.current = false;
        return;
      }
    };

    editor.addEventListener('input', handleInput);
    return () => editor.removeEventListener('input', handleInput);
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [''];
    historyIndexRef.current = 0;
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

      const fileList = Array.from(files);
      const messageGroups: Array<{
        items: Array<{
          file: File;
          url: string;
          fileName: string;
          mimeType: string;
          size: number;
          width: number;
          height: number;
          isLarge: boolean;
          originalIndex: number;
        }>;
        minOriginalIndex: number;
        clientMessageId: string;
        tempId: string;
      }> = [];

      try {
        const localFilesMeta = await Promise.all(
          fileList.map(async (file, index) => {
            const blobUrl = URL.createObjectURL(file);
            const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
              const img = new Image();
              img.onload = () => resolve({ width: img.width, height: img.height });
              img.onerror = () => resolve({ width: 0, height: 0 });
              img.src = blobUrl;
            });

            return {
              file,
              url: blobUrl,
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
              width: dimensions.width,
              height: dimensions.height,
              isLarge: isLargeImage(file),
              originalIndex: index,
            };
          })
        );

        if (localFilesMeta.length === 1) {
          const clientMessageId = generateId();
          messageGroups.push({
            items: localFilesMeta,
            minOriginalIndex: 0,
            clientMessageId,
            tempId: `temp-${clientMessageId}`,
          });
        } else {
          const normalItems = localFilesMeta.filter((item) => !item.isLarge);
          const largeItems = localFilesMeta.filter((item) => item.isLarge);

          if (normalItems.length > 0) {
            const clientMessageId = generateId();
            messageGroups.push({
              items: normalItems,
              minOriginalIndex: Math.min(...normalItems.map((i) => i.originalIndex)),
              clientMessageId,
              tempId: `temp-${clientMessageId}`,
            });
          }

          for (const item of largeItems) {
            const clientMessageId = generateId();
            messageGroups.push({
              items: [item],
              minOriginalIndex: item.originalIndex,
              clientMessageId,
              tempId: `temp-${clientMessageId}`,
            });
          }

          // Sort groups by original selection order
          messageGroups.sort((a, b) => a.minOriginalIndex - b.minOriginalIndex);
        }

        logger.info(
          `[handleFileChange] Partitioned ${localFilesMeta.length} file(s) into ${messageGroups.length} message(s):`,
          messageGroups.map((g) => ({
            count: g.items.length,
            files: g.items.map((i) => `${i.fileName} (${(i.size / (1024 * 1024)).toFixed(2)} MB, isLarge=${i.isLarge})`),
          }))
        );

        if (conversationId) {
          const currentUser = useChatStore.getState().currentUser;
          if (currentUser) {
            for (const group of messageGroups) {
              const localFiles = group.items.map(
                ({ file: _, isLarge: __, originalIndex: ___, ...rest }) => rest
              );
              useMessageStore.getState().addMessage(conversationId, {
                id: group.tempId,
                clientMessageId: group.clientMessageId,
                conversationId,
                type: 'text',
                content: '',
                sender: currentUser,
                createdAt: new Date(),
                status: 'sending',
                metadata: {
                  type: 'image',
                  files: localFiles,
                  ...(localFiles.length === 1
                    ? {
                        url: localFiles[0].url,
                        fileName: localFiles[0].fileName,
                        mimeType: localFiles[0].mimeType,
                        size: localFiles[0].size,
                        width: localFiles[0].width,
                        height: localFiles[0].height,
                      }
                    : {}),
                },
              });
            }
          }
        }

        const uploadResultMap = new Map<File, string>();
        await Promise.all(
          localFilesMeta.map(async (item) => {
            const url = await uploadFile(item.file);
            uploadResultMap.set(item.file, url);
          })
        );

        for (const group of messageGroups) {
          const uploadedFiles = group.items.map((item) => {
            const url = uploadResultMap.get(item.file) || item.url;
            return {
              url,
              fileName: item.fileName,
              mimeType: item.mimeType,
              size: item.size,
              width: item.width,
              height: item.height,
            };
          });

          onSend('', {
            metadata: {
              type: 'image',
              files: uploadedFiles,
              ...(uploadedFiles.length === 1
                ? {
                    url: uploadedFiles[0].url,
                    fileName: uploadedFiles[0].fileName,
                    mimeType: uploadedFiles[0].mimeType,
                    size: uploadedFiles[0].size,
                    width: uploadedFiles[0].width,
                    height: uploadedFiles[0].height,
                  }
                : {}),
            },
            clientMessageId: group.clientMessageId,
          });
        }
      } catch (error) {
        console.error('Failed to upload and send image:', error);
        if (conversationId) {
          for (const group of messageGroups) {
            useMessageStore
              .getState()
              .updateMessage(conversationId, group.tempId, { status: 'failed' });
          }
        }
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    },
    [conversationId, onSend]
  );

  const handleFileAttachmentChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const uploadPromises = Array.from(files).map(async (file) => {
        const clientMessageId = generateId();
        const tempId = `temp-${clientMessageId}`;

        try {
          let localMetadata: MessageMetadata;
          let finalMetadata: MessageMetadata;

          const isVideo = file.type.startsWith('video/') || /\.(mp4|mov)$/i.test(file.name);
          if (isVideo) {
            const localBlobUrl = URL.createObjectURL(file);
            const videoMeta = await new Promise<{
              width: number;
              height: number;
              duration: number;
            }>((resolve) => {
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.onloadedmetadata = () => {
                resolve({
                  width: video.videoWidth || 0,
                  height: video.videoHeight || 0,
                  duration: Number.isFinite(video.duration) ? Math.round(video.duration) : 0,
                });
              };
              video.onerror = () => {
                resolve({ width: 0, height: 0, duration: 0 });
              };
              video.src = localBlobUrl;
            });

            const mimeType =
              file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : 'video/mp4');

            localMetadata = {
              type: 'video',
              url: localBlobUrl,
              fileName: file.name,
              mimeType,
              size: file.size,
              width: videoMeta.width,
              height: videoMeta.height,
              duration: videoMeta.duration,
              clientMessageId,
            };

            finalMetadata = {
              type: 'video',
              url: '',
              fileName: file.name,
              mimeType,
              size: file.size,
              width: videoMeta.width,
              height: videoMeta.height,
              duration: videoMeta.duration,
              clientMessageId,
            };
          } else {
            const baseMetadata: MessageMetadata = {
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
              clientMessageId,
            };
            localMetadata = {
              ...baseMetadata,
              type: 'file',
              url: URL.createObjectURL(file),
            };
            finalMetadata = {
              ...baseMetadata,
              type: 'file',
              url: '',
            };
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
          if (conversationId) {
            useMessageStore.getState().updateMessage(conversationId, tempId, { status: 'failed' });
          }
        }
      });

      await Promise.all(uploadPromises);

      if (fileAttachmentInputRef.current) {
        fileAttachmentInputRef.current.value = '';
      }
    },
    [conversationId, onSend]
  );

  const saveHistory = useCallback(() => {
    const editor = messageEditorRef.current;
    if (!editor) return;
    const currentHtml = editor.innerHTML;
    const history = historyRef.current;
    const currentIndex = historyIndexRef.current;
    if (history[currentIndex] !== currentHtml) {
      const newHistory = history.slice(0, currentIndex + 1);
      newHistory.push(currentHtml);
      if (newHistory.length > 50) newHistory.shift();
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }
  }, []);

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

      if (command === 'indent') {
        let depth = 0;
        let node = selection?.anchorNode;
        while (node && node !== editor) {
          if (node.nodeName === 'BLOCKQUOTE' || node.nodeName === 'UL' || node.nodeName === 'OL') {
            depth++;
          }
          node = node.parentNode;
        }
        // Limit max indent to 6 levels
        if (depth >= 5) {
          return;
        }
      }

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
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        updateFormatState();
        return;
      }

      if (command === 'undo') {
        if (historyIndexRef.current === historyRef.current.length - 1) {
          const currentHtml = editor.innerHTML;
          if (currentHtml !== historyRef.current[historyIndexRef.current]) {
            historyRef.current.push(currentHtml);
            historyIndexRef.current += 1;
          }
        }

        if (historyIndexRef.current > 0) {
          historyIndexRef.current -= 1;
          editor.innerHTML = historyRef.current[historyIndexRef.current];
          isUndoRedoAction.current = true;

          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);

          editor.dispatchEvent(new Event('input', { bubbles: true }));
          updateFormatState();
        }
        return;
      }

      if (command === 'redo') {
        if (historyIndexRef.current < historyRef.current.length - 1) {
          historyIndexRef.current += 1;
          editor.innerHTML = historyRef.current[historyIndexRef.current];
          isUndoRedoAction.current = true;

          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);

          editor.dispatchEvent(new Event('input', { bubbles: true }));
          updateFormatState();
        }
        return;
      }

      saveHistory();
      document.execCommand(command, false, value);
      const currentSelection = window.getSelection();
      if (currentSelection && !currentSelection.isCollapsed) {
        safeNormalizeFormattingElement(editor);
      }
      saveHistory();
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      updateFormatState();
    },
    [disabled, saveHistory, updateFormatState]
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
    isExpanded,
    setIsExpanded,
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
    clearHistory,
    saveHistory,
  };
}
