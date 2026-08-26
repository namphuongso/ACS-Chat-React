import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../Avatar';
import { CloseIcon, DownloadIcon, InfoIcon, LoaderIcon } from '../Icons';
import { DocumentIcon, getDocumentFileType } from '../MessageItem/DocumentIcon';
import { downloadFile } from '../../services/fileService';
import { formatPreviewDate } from '../../utils/date';
import { formatFileSize } from '../../utils/imageUtils';
import { isPublicHttpUrl } from '../../utils/linkUtils';
import { logger } from '../../utils/logger';
import styles from './FilePreviewModal.module.scss';

export interface FilePreviewItem {
  url: string;
  fileName?: string;
  fileSize?: number | string;
  mimeType?: string;
  senderName?: string;
  senderAvatarUrl?: string;
  sentAt?: Date | string | number;
}

export interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file?: FilePreviewItem | null;
  onDownload?: (url: string, fileName?: string) => void;
  disableOfficeOnlineViewer?: boolean;
}

export const getFileNameFromUrl = (url?: string): string => {
  if (!url) return '';
  try {
    const pathname = url.split('?')[0].split('#')[0];
    const segment = pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(segment);
  } catch {
    const pathname = url.split('?')[0].split('#')[0];
    return pathname.split('/').filter(Boolean).pop() || '';
  }
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = React.memo(
  ({ isOpen, onClose, file, onDownload, disableOfficeOnlineViewer = false }) => {
    const { t, i18n } = useTranslation();
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
    const [showOfficeNotice, setShowOfficeNotice] = useState(true);

    useEffect(() => {
      if (isOpen) {
        setShowOfficeNotice(true);
      }
    }, [isOpen, file?.url]);

    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose();
        }
      };

      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen, onClose]);

    const resolvedFileName = useMemo(() => {
      if (!file) return 'file';
      return file.fileName || getFileNameFromUrl(file.url) || 'file';
    }, [file]);

    const handleDownload = async (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      if (!file?.url) return;

      const targetFileName = resolvedFileName !== 'file' ? resolvedFileName : file.fileName;

      if (onDownload) {
        onDownload(file.url, targetFileName);
        return;
      }

      if (isDownloading) return;

      try {
        setIsDownloading(true);
        setDownloadPercent(0);
        const controller = downloadFile({
          url: file.url,
          fileName: targetFileName,
          saveAs: targetFileName || true,
          onProgress: (p) => {
            setDownloadPercent(Math.round(p.percent));
          },
        });
        await controller.promise;
      } catch (err) {
        logger.error('[FilePreviewModal] Failed to download file:', err);
      } finally {
        setIsDownloading(false);
        setDownloadPercent(null);
      }
    };

    const previewKind = useMemo(() => {
      if (!file) return 'unknown';

      const rawFileName = file.fileName || getFileNameFromUrl(file.url) || '';
      const fileName = rawFileName.toLowerCase();
      const mime = (file.mimeType || '').toLowerCase();

      // Video
      if (
        mime.startsWith('video/') ||
        /\.(mp4|mov|webm|m4v|avi|mkv|3gp|ogv)$/i.test(fileName)
      ) {
        return 'video';
      }

      // Image
      if (
        mime.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff|heic)$/i.test(fileName)
      ) {
        return 'image';
      }

      // PDF
      if (mime === 'application/pdf' || fileName.endsWith('.pdf')) {
        return 'pdf';
      }

      // Office (Word, Excel, PowerPoint)
      const docType = getDocumentFileType(rawFileName, file.mimeType);
      if (docType === 'word' || docType === 'excel' || docType === 'ppt') {
        return 'office';
      }

      return 'fallback';
    }, [file]);

    if (!isOpen || !file) return null;

    const formattedSize = formatFileSize(file.fileSize);
    const formattedDate = formatPreviewDate(file.sentAt, i18n.language);

    const subTextParts: string[] = [];
    if (file.senderName) {
      subTextParts.push(file.senderName);
    }
    if (formattedDate) {
      subTextParts.push(formattedDate);
    }
    if (formattedSize) {
      subTextParts.push(formattedSize);
    }
    const subText = subTextParts.join(' - ');

    const downloadButtonTitle = isDownloading
      ? downloadPercent !== null
        ? `${t('chat.downloading', 'Downloading...')} (${downloadPercent}%)`
        : t('chat.downloading', 'Downloading...')
      : t('chat.download', 'Download');

    const renderContent = () => {
      if (previewKind === 'pdf') {
        return (
          <iframe
            src={file.url}
            title={resolvedFileName}
            className={styles.previewIframe}
            data-testid="preview-pdf-iframe"
          />
        );
      }

      if (previewKind === 'office') {
        const canUseOfficeViewer = !disableOfficeOnlineViewer && isPublicHttpUrl(file.url);

        if (!canUseOfficeViewer) {
          return (
            <div className={styles.fallbackCard} data-testid="preview-fallback">
              <DocumentIcon
                fileName={resolvedFileName}
                mimeType={file.mimeType}
                width={56}
                height={64}
              />
              <div className={styles.fallbackFileName}>{resolvedFileName}</div>
              {formattedSize && <div className={styles.fallbackFileSize}>{formattedSize}</div>}
              <div className={styles.fallbackMessage}>
                {t(
                  'chat.officePrivateNotice',
                  'Tài liệu trong mạng nội bộ hoặc tệp cục bộ không hỗ trợ xem trước trực tuyến. Vui lòng tải về để xem.'
                )}
              </div>
              <button
                type="button"
                className={styles.fallbackDownloadBtn}
                onClick={(e) => handleDownload(e)}
                disabled={isDownloading}
                data-testid="fallback-download-btn"
              >
                {isDownloading ? (
                  <LoaderIcon style={{ width: 18, height: 18 }} />
                ) : (
                  <DownloadIcon style={{ width: 18, height: 18 }} />
                )}
                <span>
                  {isDownloading
                    ? t('chat.downloading', 'Downloading...')
                    : t('chat.download', 'Download')}
                </span>
              </button>
            </div>
          );
        }

        const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`;
        return (
          <div className={styles.previewOfficeContainer} data-testid="preview-office-container">
            {showOfficeNotice && (
              <div className={styles.officeNoticeBar} data-testid="office-notice-bar">
                <div className={styles.officeNoticeContent}>
                  <InfoIcon />
                  <span className={styles.officeNoticeText}>
                    {t(
                      'chat.officePreviewNotice',
                      'Nếu tài liệu không hiển thị, vui lòng tải tệp về máy để xem.'
                    )}
                  </span>
                </div>
                <div className={styles.officeNoticeActions}>
                  <button
                    type="button"
                    className={styles.officeNoticeDownloadBtn}
                    onClick={(e) => handleDownload(e)}
                    disabled={isDownloading}
                    title={downloadButtonTitle}
                    data-testid="office-notice-download-btn"
                  >
                    {isDownloading ? <LoaderIcon /> : <DownloadIcon />}
                    <span>{t('chat.download', 'Download')}</span>
                  </button>
                  <button
                    type="button"
                    className={styles.officeNoticeDismissBtn}
                    onClick={() => setShowOfficeNotice(false)}
                    title={t('chat.close', 'Close')}
                    aria-label="Dismiss notice"
                    data-testid="office-notice-dismiss-btn"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            )}
            <iframe
              src={officeViewerUrl}
              title={resolvedFileName}
              className={styles.previewIframe}
              data-testid="preview-office-iframe"
            />
          </div>
        );
      }

      if (previewKind === 'video') {
        return (
          <div className={styles.previewVideoWrapper}>
            <video
              src={file.url}
              controls
              autoPlay
              playsInline
              className={styles.previewVideo}
              data-testid="preview-video-player"
            />
          </div>
        );
      }

      if (previewKind === 'image') {
        return (
          <div className={styles.previewImageWrapper}>
            <img
              src={file.url}
              alt={resolvedFileName}
              className={styles.previewImage}
              data-testid="preview-image"
            />
          </div>
        );
      }

      // Fallback
      return (
        <div className={styles.fallbackCard} data-testid="preview-fallback">
          <DocumentIcon fileName={resolvedFileName} mimeType={file.mimeType} width={56} height={64} />
          <div className={styles.fallbackFileName}>{resolvedFileName}</div>
          {formattedSize && <div className={styles.fallbackFileSize}>{formattedSize}</div>}
          <button
            type="button"
            className={styles.fallbackDownloadBtn}
            onClick={(e) => handleDownload(e)}
            disabled={isDownloading}
            data-testid="fallback-download-btn"
          >
            {isDownloading ? (
              <LoaderIcon style={{ width: 18, height: 18 }} />
            ) : (
              <DownloadIcon style={{ width: 18, height: 18 }} />
            )}
            <span>
              {isDownloading
                ? t('chat.downloading', 'Downloading...')
                : t('chat.download', 'Download')}
            </span>
          </button>
        </div>
      );
    };

    return (
      <div className={styles.previewOverlay} data-testid="file-preview-modal" role="dialog" aria-modal="true">
        <div className={styles.previewContent}>
          {renderContent()}
        </div>

        {/* Bottom Bar */}
        <div className={styles.previewBottomBar} data-testid="preview-bottom-bar">
          <div className={styles.bottomLeft}>
            <div className={styles.avatarWrapper}>
              <Avatar
                name={file.senderName || t('chat.unknownSender', 'Unknown')}
                url={file.senderAvatarUrl}
              />
            </div>
            <div className={styles.fileMeta}>
              <div className={styles.fileName} title={resolvedFileName}>
                {resolvedFileName}
              </div>
              {subText && (
                <div className={styles.fileSubText} title={subText}>
                  {subText}
                </div>
              )}
            </div>
          </div>

          <div className={styles.bottomRight}>
            <button
              type="button"
              className={`${styles.actionBtn} ${isDownloading ? styles.downloading : ''}`}
              onClick={handleDownload}
              title={downloadButtonTitle}
              disabled={isDownloading}
              data-testid="preview-download-btn"
            >
              {isDownloading ? <LoaderIcon /> : <DownloadIcon />}
            </button>
            <div className={styles.actionDivider} />
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onClose}
              title={t('chat.close', 'Close')}
              data-testid="preview-close-btn"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    );
  }
);
