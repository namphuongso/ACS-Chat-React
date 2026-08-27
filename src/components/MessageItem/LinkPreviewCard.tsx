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
 * - When full (message bubble): modern rich card with rounded banner image, site header with favicon, bold title, 2-line description, keywords, and domain.
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = React.memo(
  ({ preview, onClick, className, compact = false }) => {
    const [imageError, setImageError] = useState(false);
    const [faviconError, setFaviconError] = useState(false);

    const displayDomain = getDisplayDomain(preview.url, preview.siteName);
    const rawHostname = (() => {
      try {
        return new URL(preview.url).hostname || getDomainFromUrl(preview.url) || preview.url;
      } catch {
        return getDomainFromUrl(preview.url) || preview.url;
      }
    })();

    const title = preview.title || preview.siteName || displayDomain || preview.url;
    const showImage = Boolean(preview.imageUrl) && !imageError;
    const displaySite = preview.siteName || rawHostname;

    const faviconUrl = !faviconError
      ? preview.favicon
      : undefined;

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
          <div className={styles.linkPreviewHeader}>
            <div className={styles.linkPreviewSiteInfo}>
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  className={styles.linkPreviewFavicon}
                  onError={() => setFaviconError(true)}
                  loading="lazy"
                />
              ) : (
                <svg
                  className={styles.linkPreviewFaviconFallback}
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              )}
              <span className={styles.linkPreviewSiteName}>{displaySite}</span>
            </div>
            <svg
              className={styles.linkPreviewExternalIcon}
              viewBox="0 0 24 24"
              width="13"
              height="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>

          <span className={styles.linkPreviewTitle} title={title}>
            {title}
          </span>
          {preview.description && (
            <span className={styles.linkPreviewDescription} title={preview.description}>
              {preview.description}
            </span>
          )}

          {preview.keywords && preview.keywords.length > 0 && (
            <div className={styles.linkPreviewKeywords}>
              {preview.keywords.slice(0, 3).map((keyword, index) => (
                <span key={index} className={styles.linkPreviewKeywordBadge}>
                  #{keyword}
                </span>
              ))}
            </div>
          )}

          <span className={styles.linkPreviewDomain}>{rawHostname}</span>
        </div>
      </a>
    );
  }
);
