import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadFile } from '../../services/fileService';
import { formatFileSize } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';
import { DownloadIcon, FileImageIcon, LoaderIcon } from '../Icons';
import styles from './MessageItem.module.scss';

export interface LargeImageCardProps {
  fileName: string;
  fileSize?: number | string;
  url?: string;
  onDownload?: (url: string, fileName?: string) => void;
  className?: string;
}

export const LargeImageCard: React.FC<LargeImageCardProps> = React.memo(
  ({ fileName, fileSize, url = '', onDownload, className }) => {
    const { t } = useTranslation();
    const formattedSize = formatFileSize(fileSize);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);

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
      <div className={`${styles.largeImageCard} ${className || ''}`}>
        <div className={styles.largeImageLeft}>
          <div className={styles.largeImageIconBox}>
            <FileImageIcon className={styles.largeImageFileIcon} />
          </div>
          <div className={styles.largeImageInfo}>
            <span className={styles.largeImageFileName} title={fileName}>
              {fileName}
            </span>
            <div className={styles.largeImageDetails}>
              {formattedSize && <span className={styles.largeImageSize}>{formattedSize}</span>}
            </div>
          </div>
        </div>

        <div className={styles.largeImageActions}>
          <button
            type="button"
            className={`${styles.largeImageActionBtn} ${isDownloading ? styles.downloading : ''}`}
            onClick={handleDownload}
            title={downloadButtonTitle}
            disabled={isDownloading}
          >
            {isDownloading ? <LoaderIcon /> : <DownloadIcon />}
          </button>
        </div>
      </div>
    );
  }
);
