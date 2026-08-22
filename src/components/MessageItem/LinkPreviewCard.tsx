import React, { useState } from 'react';
import { Globe } from 'lucide-react';
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
 * Card rendering a URL preview: image (if any), title, description and the
 * site name / domain with favicon. Clicking opens the URL in a new tab.
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = React.memo(
  ({ preview, onClick, className, compact = false }) => {
    const [imageError, setImageError] = useState(false);

    const domain = getDomainFromUrl(preview.url);
    const title = preview.title || domain || preview.url;
    const showImage = Boolean(preview.imageUrl) && !imageError;

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClick) {
        onClick(preview.url);
        return;
      }
      if (preview.url && typeof window !== 'undefined') {
        window.open(preview.url, '_blank', 'noopener,noreferrer');
      }
    };

    return (
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className={`${styles.linkPreviewCard} ${compact ? styles.linkPreviewCardCompact : ''} ${className || ''}`}
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
          {!compact && preview.description && (
            <span className={styles.linkPreviewDescription} title={preview.description}>
              {preview.description}
            </span>
          )}
          <span className={styles.linkPreviewFooter}>
            {preview.favicon ? (
              <img
                src={preview.favicon}
                alt=""
                className={styles.linkPreviewFavicon}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <Globe size={12} className={styles.linkPreviewFavicon} />
            )}
            <span className={styles.linkPreviewDomain}>
              {preview.siteName || domain || preview.url}
            </span>
          </span>
        </div>
      </a>
    );
  }
);
