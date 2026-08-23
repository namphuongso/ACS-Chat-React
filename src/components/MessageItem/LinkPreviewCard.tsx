import React, { useState, useCallback } from 'react';
import type { LinkPreview } from '../../types/message.types';
import { getDomainFromUrl } from '../../utils/linkUtils';
import styles from './MessageItem.module.scss';

export interface LinkPreviewCardProps {
  /** Preview data to display */
  preview: LinkPreview;
  /** Optional click handler; defaults to opening the URL in a new tab */
  onClick?: (url: string) => void;
  /** Additional CSS class */
  className?: string;
  /** Compact rendering (used in the message compose area) */
  compact?: boolean;
}

/**
 * Helper to get domain/hostname for display
 */
const getDisplayDomain = (url: string, siteName?: string): string => {
  if (siteName) return siteName;
  try {
    const host = new URL(url).hostname;
    return host || getDomainFromUrl(url) || url;
  } catch {
    return getDomainFromUrl(url) || url;
  }
};

/**
 * Card rendering a URL preview:
 * - When compact (compose area): horizontal bar with square thumbnail, bold title, 1-line description, and blue domain.
 * - When full (message bubble): clean vertical preview directly in bubble with rounded banner image, bold title, 2-line description, and blue domain.
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = React.memo(
  ({ preview, onClick, className, compact = false }) => {
    const [imageError, setImageError] = useState(false);

    const displayDomain = getDisplayDomain(preview.url, preview.siteName);
    const title = preview.title || preview.siteName || displayDomain || preview.url;
    const showImage = Boolean(preview.imageUrl) && !imageError;

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (onClick) {
          e.preventDefault();
          e.stopPropagation();
          onClick(preview.url);
        }
      },
      [onClick, preview.url]
    );

    if (compact) {
      return (
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick ? handleClick : undefined}
          className={`${styles.linkPreviewCardCompact} ${className || ''}`}
          data-testid="link-preview-card"
        >
          {showImage && (
            <img
              src={preview.imageUrl}
              alt={title}
              className={styles.linkPreviewImage}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          )}
          <div className={styles.linkPreviewBody}>
            <span className={styles.linkPreviewTitle} title={title}>
              {title}
            </span>
            {preview.description && (
              <span className={styles.linkPreviewDescription} title={preview.description}>
                {preview.description}
              </span>
            )}
            <span className={styles.linkPreviewDomain}>{displayDomain}</span>
          </div>
        </a>
      );
    }

    return (
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick ? handleClick : undefined}
        className={`${styles.linkPreviewCard} ${className || ''}`}
        data-testid="link-preview-card"
      >
        {showImage && (
          <div
            className={styles.linkPreviewImageWrapper}
            data-testid="image-container"
            style={{ backgroundImage: `url(${preview.imageUrl})` }}
          >
            <img
              src={preview.imageUrl}
              alt={title}
              className={styles.linkPreviewImage}
              onError={() => setImageError(true)}
              loading="lazy"
            />
          </div>
        )}
        <div className={styles.linkPreviewBody}>
          <span className={styles.linkPreviewTitle} title={title}>
            {title}
          </span>
          {preview.description && (
            <span className={styles.linkPreviewDescription} title={preview.description}>
              {preview.description}
            </span>
          )}
          <span className={styles.linkPreviewDomain}>{displayDomain}</span>
        </div>
      </a>
    );
  }
);

