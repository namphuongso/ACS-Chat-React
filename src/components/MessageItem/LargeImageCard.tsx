import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadFile } from '../../services/fileService';
import { formatFileSize } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';
import { CheckCircleIcon, DownloadIcon, FolderIcon, LoaderIcon } from '../Icons';
import { DocumentIcon } from './DocumentIcon';
import styles from './MessageItem.module.scss';

export interface LargeImageCardProps {
  fileName: string;
  fileSize?: number | string;
  url?: string;
  mimeType?: string;
  showStatus?: boolean;
  statusText?: string;
  showOpenFolder?: boolean;
  onDownload?: (url: string, fileName?: string) => void;
  onOpen?: (url: string, fileName?: string) => void;
  className?: string;
  disablePreview?: boolean;
}

export const LargeImageCard: React.FC<LargeImageCardProps> = React.memo(
  ({
    fileName,
    fileSize,
    url = '',
    mimeType,
    showStatus = true,
    statusText,
    showOpenFolder = true,
    onDownload,
    onOpen,
    className,
    disablePreview = false,
  }) => {
    const { t } = useTranslation();
    const formattedSize = formatFileSize(fileSize);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

    const canOpen = Boolean(onOpen) && !disablePreview;

    const handleOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canOpen) return;
      onOpen?.(url, fileName);
    };

    const handleDownload = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onDownload) {
        onDownload(url, fileName);
        return;
      }
      if (!url || isDownloading) return;

      try {
        setIsDownloading(true);
        setDownloadPercent(0);
        const controller = downloadFile({
          url,
          fileName,
          saveAs: fileName || true,
          onProgress: (p) => {
            setDownloadPercent(Math.round(p.percent));
          },
        });
        await controller.promise;
      } catch (err) {
        logger.error('[LargeImageCard] Failed to download file:', err);
      } finally {
        setIsDownloading(false);
        setDownloadPercent(null);
      }
    };

    const downloadButtonTitle = isDownloading
      ? downloadPercent !== null
        ? `${t('chat.downloading', 'Downloading...')} (${downloadPercent}%)`
        : t('chat.downloading', 'Downloading...')
      : t('chat.download', 'Download');

    return (
      <div
        className={`${styles.largeImageCard} ${canOpen ? styles.clickable : ''} ${className || ''}`}
        data-testid="file-card"
        onClick={canOpen ? handleOpen : undefined}
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onKeyDown={
          canOpen
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleOpen(e as unknown as React.MouseEvent);
                }
              }
            : undefined
        }
      >
        <div className={styles.largeImageLeft}>
          <div className={styles.largeImageIconBox}>
            <DocumentIcon fileName={fileName} mimeType={mimeType} />
          </div>
          <div className={styles.largeImageInfo}>
            <span className={styles.largeImageFileName} title={fileName}>
              {fileName}
            </span>
            <div className={styles.largeImageDetails}>
              {formattedSize && <span className={styles.largeImageSize}>{formattedSize}</span>}
              {showStatus && (
                <span className={styles.largeImageStatus}>
                  <CheckCircleIcon className={styles.largeImageStatusIcon} />
                  <span>{statusText || t('chat.availableOnDevice', 'Available on device')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={styles.largeImageActions}>
          {showOpenFolder && canOpen && (
            <button
              type="button"
              className={styles.largeImageActionBtn}
              onClick={handleOpen}
              title={t('chat.openFolder', 'Open folder')}
              data-testid="file-open-btn"
            >
              <FolderIcon />
            </button>
          )}
          <button
            type="button"
            className={`${styles.largeImageActionBtn} ${isDownloading ? styles.downloading : ''}`}
            onClick={handleDownload}
            title={downloadButtonTitle}
            disabled={isDownloading}
            data-testid="file-download-btn"
          >
            {isDownloading ? <LoaderIcon /> : <DownloadIcon />}
          </button>
        </div>
      </div>
    );
  }
);


export type FileCardProps = LargeImageCardProps;
export const FileCard = LargeImageCard;
