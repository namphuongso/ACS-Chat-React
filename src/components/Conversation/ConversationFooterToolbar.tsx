import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Smile,
  Image as ImageIcon,
  Paperclip,
  Contact,
  Type,
  Zap,
  CreditCard,
  MoreHorizontal,
  Crop,
} from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

export interface ConversationFooterToolbarProps {
  disabled?: boolean;
  isFormatMode: boolean;
  setIsFormatMode: React.Dispatch<React.SetStateAction<boolean>>;
  handleSendImageClick: () => void;
  handleSendFileClick: () => void;
  messageEditorRef: React.RefObject<HTMLDivElement>;
}

export const ConversationFooterToolbar: React.FC<ConversationFooterToolbarProps> = ({
  disabled,
  isFormatMode,
  setIsFormatMode,
  handleSendImageClick,
  handleSendFileClick,
  messageEditorRef,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        setIsFormatMode((prev) => !prev);
        setTimeout(() => {
          messageEditorRef.current?.focus();
        }, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setIsFormatMode, messageEditorRef]);

  return (
    <>
      <ToolbarButton icon={<Smile size={20} />} label={t('chat.toolbar.emoji')} disabled={disabled} />
      <ToolbarButton
        icon={<ImageIcon size={20} />}
        label={t('chat.toolbar.image')}
        onClick={handleSendImageClick}
        disabled={disabled}
      />
      <ToolbarButton
        icon={<Paperclip size={20} />}
        label={t('chat.toolbar.attachment')}
        onClick={handleSendFileClick}
        disabled={disabled}
      />
      <ToolbarButton icon={<Contact size={20} />} label={t('chat.toolbar.contact')} disabled={disabled} />
      <ToolbarButton icon={<Crop size={20} />} label={t('chat.toolbar.screenshot')} disabled={disabled} />
      <ToolbarButton
        icon={<Type size={20} />}
        label={`${t('chat.toolbar.format')} (${typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac') ? 'Cmd' : 'Ctrl'} + Shift + X)`}
        isActive={isFormatMode}
        onClick={() => {
          setIsFormatMode((prev) => !prev);
          setTimeout(() => {
            messageEditorRef.current?.focus();
          }, 0);
        }}
        disabled={disabled}
      />
      <ToolbarButton icon={<Zap size={20} />} label={t('chat.toolbar.quickReplies')} disabled={disabled} />
      <ToolbarButton icon={<CreditCard size={20} />} label={t('chat.toolbar.payment')} disabled={disabled} />
      <ToolbarButton icon={<MoreHorizontal size={20} />} label={t('chat.toolbar.more')} disabled={disabled} />
    </>
  );
};
