import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Baseline,
  Eraser,
  List,
  ListOrdered,
  Outdent,
  Indent,
  Undo,
  Redo,
  Maximize2,
  Minimize2,
  ALargeSmall,
  Check,
} from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';
import styles from './ConversationFooter.module.scss';

export interface ConversationFooterBottomToolbarProps {
  disabled?: boolean;
  formatState: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikeThrough: boolean;
    insertUnorderedList: boolean;
    insertOrderedList: boolean;
    fontSize: string;
  };
  executeCommand: (e: React.MouseEvent, command: string, value?: string) => void;
  isFontSizeMenuOpen: boolean;
  setIsFontSizeMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fontSizeMenuRef: React.RefObject<HTMLDivElement>;
  updateFormatState: () => void;
  messageEditorRef: React.RefObject<HTMLDivElement>;
  saveHistory: () => void;
  isExpanded: boolean;
  setIsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ConversationFooterBottomToolbar: React.FC<ConversationFooterBottomToolbarProps> = ({
  disabled,
  formatState,
  executeCommand,
  isFontSizeMenuOpen,
  setIsFontSizeMenuOpen,
  fontSizeMenuRef,
  updateFormatState,
  messageEditorRef,
  saveHistory,
  isExpanded,
  setIsExpanded,
}) => {
  const { t } = useTranslation();
  const [isTextColorMenuOpen, setIsTextColorMenuOpen] = useState(false);
  const textColorMenuRef = useRef<HTMLDivElement>(null);
  const [activeColor, setActiveColor] = useState<string>('#0f172a');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (textColorMenuRef.current && !textColorMenuRef.current.contains(event.target as Node)) {
        setIsTextColorMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleClearFormat = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    const editor = messageEditorRef.current;
    if (!editor) return;

    editor.focus();
    const selection = window.getSelection();

    saveHistory();
    if (selection && selection.isCollapsed) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);

      document.execCommand('removeFormat');

      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      document.execCommand('removeFormat');
    }

    setActiveColor('#0f172a');
    updateFormatState();
    saveHistory();
  };

  const TEXT_COLORS = [
    { label: 'Red', value: '#ef4444' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Yellow', value: '#eab308' },
    { label: 'Green', value: '#22c55e' },
    { label: 'Dark', value: '#0f172a' },
  ];

  return (
    <>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <ToolbarButton
          icon={<Bold size={18} />}
          label={t('chat.format.bold')}
          isActive={formatState.bold}
          onMouseDown={(e) => executeCommand(e, 'bold')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Italic size={18} />}
          label={t('chat.format.italic')}
          isActive={formatState.italic}
          onMouseDown={(e) => executeCommand(e, 'italic')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Underline size={18} />}
          label={t('chat.format.underline')}
          isActive={formatState.underline}
          onMouseDown={(e) => executeCommand(e, 'underline')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Strikethrough size={18} />}
          label={t('chat.format.strikethrough')}
          isActive={formatState.strikeThrough}
          onMouseDown={(e) => executeCommand(e, 'strikeThrough')}
          disabled={disabled}
        />
        <div style={{ position: 'relative' }} ref={fontSizeMenuRef}>
          <ToolbarButton
            icon={<ALargeSmall size={18} />}
            label={t('chat.toolbar.fontSize')}
            isActive={isFontSizeMenuOpen}
            onClick={() => setIsFontSizeMenuOpen((prev) => !prev)}
            disabled={disabled}
          />
          {isFontSizeMenuOpen && (
            <div className={styles.fontSizeMenu}>
              {[
                { label: t('chat.fontSize.veryLarge'), value: '7' },
                { label: t('chat.fontSize.large'), value: '5' },
                { label: t('chat.fontSize.medium'), value: '3' },
                { label: t('chat.fontSize.small'), value: '2' },
              ].map((item) => (
                <button
                  key={item.value}
                  className={styles.fontSizeMenuItem}
                  onClick={(e) => {
                    executeCommand(e as React.MouseEvent, 'fontSize', item.value);
                    setIsFontSizeMenuOpen(false);
                  }}
                >
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {formatState.fontSize === item.value && <Check size={16} />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} ref={textColorMenuRef}>
          <ToolbarButton
            icon={<Baseline size={18} color={activeColor} />}
            label={t('chat.format.textColor')}
            isActive={isTextColorMenuOpen}
            onClick={() => setIsTextColorMenuOpen((prev) => !prev)}
            disabled={disabled}
          />
          {isTextColorMenuOpen && (
            <div className={styles.colorMenu}>
              {TEXT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`${styles.colorMenuItem} ${activeColor === color.value ? styles.colorActive : ''}`}
                  style={{ backgroundColor: color.value }}
                  onClick={(e) => {
                    executeCommand(e as React.MouseEvent, 'foreColor', color.value);
                    setActiveColor(color.value);
                    setIsTextColorMenuOpen(false);
                    messageEditorRef.current?.focus();
                  }}
                  title={color.label}
                />
              ))}
            </div>
          )}
        </div>
        <ToolbarButton
          icon={<Eraser size={18} />}
          label={t('chat.format.clearFormat')}
          onMouseDown={handleClearFormat}
          disabled={disabled}
        />
        <div
          style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
        />
        <ToolbarButton
          icon={<List size={18} />}
          label={t('chat.format.bulletList')}
          isActive={formatState.insertUnorderedList}
          onMouseDown={(e) => executeCommand(e, 'insertUnorderedList')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<ListOrdered size={18} />}
          label={t('chat.format.numberedList')}
          isActive={formatState.insertOrderedList}
          onMouseDown={(e) => executeCommand(e, 'insertOrderedList')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Outdent size={18} />}
          label={t('chat.format.decreaseIndent')}
          onMouseDown={(e) => executeCommand(e, 'outdent')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Indent size={18} />}
          label={t('chat.format.increaseIndent')}
          onMouseDown={(e) => executeCommand(e, 'indent')}
          disabled={disabled}
        />
        <div
          style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
        />
        <ToolbarButton
          icon={<Undo size={18} />}
          label={t('chat.format.undo')}
          onMouseDown={(e) => executeCommand(e, 'undo')}
          disabled={disabled}
        />
        <ToolbarButton
          icon={<Redo size={18} />}
          label={t('chat.format.redo')}
          onMouseDown={(e) => executeCommand(e, 'redo')}
          disabled={disabled}
        />
        <div
          style={{ width: '1px', height: '24px', backgroundColor: '#e5e7eb', margin: '0 4px' }}
        />
        <ToolbarButton
          icon={isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          label={t(isExpanded ? 'chat.format.collapse' : 'chat.format.expand')}
          disabled={disabled}
          isActive={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
        />
      </div>
    </>
  );
};
