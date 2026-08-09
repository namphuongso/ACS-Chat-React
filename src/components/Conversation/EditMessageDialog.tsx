import React, { useState, useEffect, useRef } from 'react';
import styles from './EditMessageDialog.module.scss';

export interface EditMessageDialogProps {
  isOpen: boolean;
  initialContent: string;
  onSave: (newContent: string) => void;
  onCancel: () => void;
}

export const EditMessageDialog: React.FC<EditMessageDialogProps> = ({
  isOpen,
  initialContent,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
      // Focus textarea at the end of text
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(initialContent.length, initialContent.length);
        }
      }, 0);
    }
  }, [isOpen, initialContent]);

  if (!isOpen) return null;

  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialogContent}>
        <h3 className={styles.dialogHeader}>Sửa tin nhắn</h3>
        <textarea
          ref={textareaRef}
          className={styles.dialogTextarea}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Nhập nội dung tin nhắn..."
        />
        <div className={styles.dialogFooter}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Huỷ
          </button>
          <button 
            className={styles.saveBtn} 
            onClick={() => onSave(content)}
            disabled={!content.trim() || content === initialContent}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};
