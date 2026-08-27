import React from 'react';
import { getImageMimeType } from '../../utils/imageUtils';
import { ChatImage } from './ChatImage';
import type { FilePreviewItem } from '../FilePreviewModal';
import styles from './MessageItem.module.scss';

export interface ImageGridFile {
  url: string;
  fileName?: string;
  size?: number;
  width?: string | number;
  height?: string | number;
  mimeType?: string;
  isLarge?: boolean;
}

export interface ImageGridProps {
  files: ImageGridFile[];
  mimeType?: string;
  senderName: string;
  senderAvatarUrl?: string;
  sentAt: Date;
  onOpenAttachment?: (url: string, fileName?: string, metadata?: FilePreviewItem) => void;
}

const getImageGridContainerStyle = (count: number): React.CSSProperties => {
  if (count === 2) {
    return {
      gridTemplateColumns: 'repeat(2, 1fr)',
      maxWidth: 420,
    };
  }
  if (count === 3) {
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      maxWidth: 460,
    };
  }
  if (count === 4) {
    return {
      gridTemplateColumns: 'repeat(4, 1fr)',
      maxWidth: 480,
    };
  }
  if (count === 5) {
    return {
      gridTemplateColumns: 'repeat(3, 1fr)',
      maxWidth: 460,
    };
  }
  // 6 or more
  return {
    gridTemplateColumns: 'repeat(3, 1fr)',
    maxWidth: 460,
  };
};

const getImageGridItemStyle = (count: number, index: number): React.CSSProperties => {
  if (count === 2) {
    return {
      height: 190,
    };
  }
  if (count === 3) {
    return {
      height: 160,
    };
  }
  if (count === 4) {
    return {
      height: 130,
    };
  }
  if (count === 5) {
    if (index < 3) {
      return {
        gridColumn: 'span 1',
        height: 130,
      };
    }
    if (index === 3) {
      return {
        gridColumn: 'span 1',
        height: 170,
      };
    }
    return {
      gridColumn: 'span 2',
      height: 170,
    };
  }
  // 6 or more
  return {
    gridColumn: 'span 1',
    height: 130,
  };
};

export const ImageGrid: React.FC<ImageGridProps> = React.memo(
  ({ files, mimeType: fallbackMimeType, senderName, senderAvatarUrl, sentAt, onOpenAttachment }) => {
    if (files.length === 1) {
      const singleImg = files[0];
      const fileName = singleImg.fileName || 'image.jpg';
      const mimeType = getImageMimeType(
        fileName,
        singleImg.mimeType || fallbackMimeType
      );
      return (
        <div className={styles.imageContainer}>
          <div className={styles.hdBadge}>HD</div>
          <ChatImage
            src={singleImg.url}
            alt={singleImg.fileName || 'image'}
            className={styles.imageContent}
            onClick={() =>
              onOpenAttachment?.(singleImg.url, fileName, {
                url: singleImg.url,
                fileName,
                fileSize: singleImg.size,
                mimeType,
                senderName,
                senderAvatarUrl,
                sentAt,
              })
            }
            style={{
              aspectRatio:
                singleImg.width &&
                singleImg.height &&
                Number(singleImg.width) > 0 &&
                Number(singleImg.height) > 0
                  ? `${singleImg.width} / ${singleImg.height}`
                  : '4 / 3',
            }}
          />
        </div>
      );
    }

    const count = files.length;

    return (
      <div className={styles.imageGrid} style={getImageGridContainerStyle(count)}>
        {files.map((img, idx) => {
          const fileName = img.fileName || `image-${idx + 1}.jpg`;
          const mimeType = getImageMimeType(
            fileName,
            img.mimeType || fallbackMimeType
          );
          return (
            <div
              key={img.url || idx}
              className={styles.imageGridItem}
              style={getImageGridItemStyle(count, idx)}
            >
              <div className={styles.hdBadge}>HD</div>
              <ChatImage
                src={img.url}
                alt={img.fileName || `image-${idx}`}
                className={styles.imageContent}
                onClick={() =>
                  onOpenAttachment?.(img.url, fileName, {
                    url: img.url,
                    fileName,
                    fileSize: img.size,
                    mimeType,
                    senderName,
                    senderAvatarUrl,
                    sentAt,
                  })
                }
              />
            </div>
          );
        })}
      </div>
    );
  }
);
