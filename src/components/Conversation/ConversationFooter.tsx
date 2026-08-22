import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageInput } from '../MessageInput';
import type { SendMessageOptions } from '../../types/message.types';
import styles from './ConversationFooter.module.scss';
import { useConversationFooter } from './useConversationFooter';
import { ConversationFooterToolbar } from './ConversationFooterToolbar';
import { ConversationFooterBottomToolbar } from './ConversationFooterBottomToolbar';
import { ConversationFooterSendButton } from './ConversationFooterSendButton';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_ATTACHMENT_TYPES } from '../../constants';

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

    const {
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
    } = useConversationFooter({
      conversationId,
      onSend,
      disabled,
    });

    const renderToolbar = useCallback(() => {
      return (
        <ConversationFooterToolbar
          disabled={disabled}
          isFormatMode={isFormatMode}
          setIsFormatMode={setIsFormatMode}
          handleSendImageClick={handleSendImageClick}
          handleSendFileClick={handleSendFileClick}
          messageEditorRef={messageEditorRef}
        />
      );
    }, [
      disabled,
      isFormatMode,
      setIsFormatMode,
      handleSendImageClick,
      handleSendFileClick,
      messageEditorRef,
    ]);

    const renderSendButton = useCallback(
      ({ onClick, disabled: isSendDisabled }: { onClick: () => void; disabled: boolean }) => {
        return (
          <ConversationFooterSendButton
            isSendDisabled={isSendDisabled}
            onClick={onClick}
            onSend={onSend}
            resetFormatState={resetFormatState}
          />
        );
      },
      [onSend, resetFormatState]
    );

    const renderBottomToolbar = useCallback(() => {
      if (!isFormatMode) return null;

      return (
        <ConversationFooterBottomToolbar
          disabled={disabled}
          formatState={formatState}
          executeCommand={executeCommand}
          isFontSizeMenuOpen={isFontSizeMenuOpen}
          setIsFontSizeMenuOpen={setIsFontSizeMenuOpen}
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
          fontSizeMenuRef={fontSizeMenuRef}
          updateFormatState={updateFormatState}
          messageEditorRef={messageEditorRef}
          saveHistory={saveHistory}
        />
      );
    }, [
      isFormatMode,
      formatState,
      executeCommand,
      disabled,
      isFontSizeMenuOpen,
      setIsFontSizeMenuOpen,
      isExpanded,
      setIsExpanded,
      fontSizeMenuRef,
      updateFormatState,
      messageEditorRef,
      saveHistory,
    ]);

    return (
      <div className={styles.wrapper}>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <input
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES}
          multiple
          ref={fileAttachmentInputRef}
          onChange={handleFileAttachmentChange}
          style={{ display: 'none' }}
        />
        <MessageInput
          onSend={(content, options) => {
            onSend(content, {
              ...options,
              ...(isFormatMode ? { type: 'html' } : {}),
            });
            resetFormatState();
            clearHistory();
          }}
          onTyping={onTyping}
          disabled={disabled}
          renderToolbar={renderToolbar}
          renderSendButton={renderSendButton}
          renderBottomToolbar={isFormatMode ? renderBottomToolbar : undefined}
          placeholder={
            isFormatMode 
              ? t('chat.formatMessageHint', { shortcut: typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'Cmd + Shift + X' : 'Ctrl + Shift + X' }) 
              : t('chat.typeMessage')
          }
          autoFocus={autoFocus}
          editorRef={messageEditorRef}
          isFormatMode={isFormatMode}
          isExpanded={isExpanded}
        />
      </div>
    );
  }
);
