import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { downloadFile } from '../../services/fileService';
import { formatFileSize } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';
import { DownloadIcon, LoaderIcon, PlayIcon } from '../Icons';
import styles from './MessageItem.module.scss';

export interface VideoCardProps {
  fileName: string;
  fileSize?: number | string;
  url?: string;
  mimeType?: string;
  onDownload?: (url: string, fileName?: string) => void;
  onOpen?: (url: string, fileName?: string) => void;
  className?: string;
}

export const VideoCard: React.FC<VideoCardProps> = React.memo(
  ({ fileName, fileSize, url = '', mimeType: _mimeType, onDownload, onOpen, className }) => {
    const { t } = useTranslation();
    const formattedSize = formatFileSize(fileSize);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadPercent, setDownloadPercent] = useState<number | null>(null);
    const [hasError, setHasError] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onOpen) {
        onOpen(url, fileName);
        return;
      }
      if (url && typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };

    useEffect(() => {
      setHasError(false);
    }, [url]);

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
        logger.error('[VideoCard] Failed to download video:', err);
      } finally {
        setIsDownloading(false);
        setDownloadPercent(null);
      }
    };

    const handleVideoError = useCallback(() => {
      setHasError(true);
    }, []);

    const downloadButtonTitle = isDownloading
      ? downloadPercent !== null
        ? `${t('chat.downloading', 'Downloading...')} (${downloadPercent}%)`
        : t('chat.downloading', 'Downloading...')
      : t('chat.download', 'Download');

    return (
      <div className={`${styles.videoCard} ${className || ''}`} data-testid="video-card">
        <div className={styles.videoPlayerWrapper}>
          <video
            ref={videoRef}
            src={url}
            controls
            preload="metadata"
            playsInline
            className={styles.videoPlayer}
            onError={handleVideoError}
            data-testid="video-player"
          />
          {hasError && (
            <div className={styles.videoErrorOverlay} data-testid="video-error-overlay">
              <PlayIcon style={{ width: 28, height: 28, opacity: 0.8 }} />
              <span>
                {t('chat.videoUnsupported', 'Video format not supported for direct preview')}
              </span>
            </div>
          )}
        </div>

        <div className={styles.videoActionBar}>
          <div
            className={styles.videoActionLeft}
            onClick={handleOpen}
            role="button"
            tabIndex={0}
            style={{ cursor: 'pointer' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpen(e as unknown as React.MouseEvent);
              }
            }}
          >
            <div className={styles.videoIconBox}>
              <PlayIcon className={styles.videoIcon} />
            </div>
            <div className={styles.videoInfo}>
              <span className={styles.videoFileName} title={fileName}>
                {fileName}
              </span>
              <div className={styles.videoDetails}>
                {formattedSize && <span className={styles.videoSize}>{formattedSize}</span>}
              </div>
            </div>
          </div>


          <div className={styles.videoActions}>
            <button
              type="button"
              className={`${styles.videoActionBtn} ${isDownloading ? styles.downloading : ''}`}
              onClick={handleDownload}
              title={downloadButtonTitle}
              disabled={isDownloading}
              data-testid="video-download-btn"
            >
              {isDownloading ? <LoaderIcon /> : <DownloadIcon />}
            </button>
          </div>
        </div>
      </div>
    );
  }
);
