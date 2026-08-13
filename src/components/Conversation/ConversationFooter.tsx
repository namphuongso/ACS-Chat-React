import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageInput } from '../MessageInput';
import type { SendMessageOptions } from '../../types/message.types';
import styles from './ConversationFooter.module.scss';
import { useConversationFooter } from './useConversationFooter';
import { ConversationFooterToolbar } from './ConversationFooterToolbar';
import { ConversationFooterBottomToolbar } from './ConversationFooterBottomToolbar';
import { ConversationFooterSendButton } from './ConversationFooterSendButton';
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
          fontSizeMenuRef={fontSizeMenuRef}
          updateFormatState={updateFormatState}
          messageEditorRef={messageEditorRef}
        />
      );
    }, [
      isFormatMode,
      formatState,
      executeCommand,
      disabled,
      isFontSizeMenuOpen,
      setIsFontSizeMenuOpen,
      fontSizeMenuRef,
      updateFormatState,
      messageEditorRef,
    ]);

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
            resetFormatState();
          }}
          onTyping={onTyping}
          disabled={disabled}
          renderToolbar={renderToolbar}
          renderSendButton={renderSendButton}
          renderBottomToolbar={isFormatMode ? renderBottomToolbar : undefined}
          placeholder={
            isFormatMode ? t('chat.formatMessageHint') : t('chat.typeMessage')
          }
          autoFocus={autoFocus}
          editorRef={messageEditorRef}
        />
      </div>
    );
  }
);
