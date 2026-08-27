import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PinnedMessage } from '../../types/message.types';
import { DocumentIcon, VideoIcon, FileImageIcon, LinkIcon } from '../Icons';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import { useMessageStore } from '../../store/messageStore';
import {
  classifyPinnedMessage,
  indexMessagesByConversation,
} from '../../utils/pinnedUtils';
import styles from './PinnedItemView.module.scss';

export interface PinnedItemViewProps {
  message: PinnedMessage;
  className?: string;
}

export const PinnedItemView: React.FC<PinnedItemViewProps> = React.memo(
  ({ message, className }) => {
    const { t } = useTranslation();
    const [imgFailed, setImgFailed] = useState(false);
    const [linkImgFailed, setLinkImgFailed] = useState(false);

    // Subscribe reactively to message store updates so when messages/pinned messages load asynchronously,
    // this component immediately re-renders with full metadata (photos, files, filenames, etc.)
    const messagesByConversation = useMessageStore((state) => state.messagesByConversation);

    // Build the message index once per store update so each pinned item only
    // pays for a single O(n) scan instead of one per classified message.
    const messagesIndex = useMemo(
      () => indexMessagesByConversation(messagesByConversation),
      [messagesByConversation]
    );

    const classification = useMemo(
      () => classifyPinnedMessage(message, messagesByConversation, messagesIndex),
      [message, messagesByConversation, messagesIndex]
    );
    const { category, fileName, url, thumbUrl } = classification;

    const creator = message.creator || t('chat.unknownSender', 'Unknown');

    // Fetch link preview metadata if needed for Link thumbnail
    const linkPreview = useLinkPreview(category === 'link' ? url : null);
    const linkImageUrl = linkPreview?.imageUrl || linkPreview?.favicon || thumbUrl;

    const renderContent = () => {
      switch (category) {
        case 'image':
        case 'album': {
          const primarySrc = thumbUrl || url;
          const fallbackSrc = thumbUrl && url && thumbUrl !== url ? url : '';
          const activeSrc = imgFailed && fallbackSrc ? fallbackSrc : primarySrc;
          const hasImage = Boolean(activeSrc);
          const label = category === 'album' ? t('chat.album', 'Album') : t('chat.photo', 'Photo');

          return (
            <span className={styles.pinBody}>
              {hasImage ? (
                <img
                  src={activeSrc}
                  alt={label}
                  className={styles.pinThumbImg}
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (!imgFailed && fallbackSrc) {
                      setImgFailed(true);
                    }
                  }}
                  loading="lazy"
                  decoding="auto"
                />
              ) : (
                <span className={styles.pinThumbPlaceholder}>
                  <FileImageIcon width={12} height={12} />
                </span>
              )}
              <span className={styles.pinTagText}>{label}</span>
            </span>
          );
        }

        case 'link': {
          return (
            <span className={styles.pinBody}>
              {linkImageUrl && !linkImgFailed ? (
                <img
                  src={linkImageUrl}
                  alt="Link"
                  className={styles.pinThumbImg}
                  referrerPolicy="no-referrer"
                  onError={() => setLinkImgFailed(true)}
                  loading="lazy"
                />
              ) : (
                <span className={styles.pinThumbPlaceholder}>
                  <LinkIcon width={12} height={12} />
                </span>
              )}
              <span className={styles.pinTagText}>
                {t('chat.link', 'Link')} <span className={styles.pinDot}>·</span> {url}
              </span>
            </span>
          );
        }

        case 'video': {
          return (
            <span className={styles.pinBody}>
              <VideoIcon width={18} height={18} className={styles.pinVideoIcon} />
              <span className={styles.pinTagText}>
                {t('chat.file', 'File')} <span className={styles.pinDot}>·</span> {fileName}
              </span>
            </span>
          );
        }

        case 'excel':
        case 'ppt':
        case 'doc':
        case 'pdf':
        case 'large_image':
        case 'file': {
          return (
            <span className={styles.pinBody}>
              <DocumentIcon
                fileName={fileName}
                mimeType={message.attachmentType}
                width={16}
                height={18}
                className={styles.pinDocIcon}
              />
              <span className={styles.pinTagText}>
                {t('chat.file', 'File')} <span className={styles.pinDot}>·</span> {fileName}
              </span>
            </span>
          );
        }

        case 'text':
        default: {
          return (
            <span className={styles.pinText}>
              {message.content || classification.content || t('chat.noContent', 'No content')}
            </span>
          );
        }
      }
    };

    return (
      <div className={`${styles.pinItemContainer} ${className || ''}`}>
        <span className={styles.pinCreator}>{creator}: </span>
        {renderContent()}
      </div>
    );
  }
);
