import React, { SVGProps } from 'react';
import { getDocumentFileType, type DocumentFileType } from '../../utils/fileUtils';

export type { DocumentFileType };
export { getDocumentFileType };

interface IconConfig {
  bgColor: string;
  foldColor: string;
  label: string;
  fontSize: number;
  letterSpacing?: string;
}

const ICON_CONFIGS: Record<DocumentFileType, IconConfig> = {
  pdf: {
    bgColor: '#EF4444',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'PDF',
    fontSize: 11,
    letterSpacing: '-0.2px',
  },
  word: {
    bgColor: '#2563EB',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'W',
    fontSize: 18,
  },
  excel: {
    bgColor: '#16A34A',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'X',
    fontSize: 18,
  },
  ppt: {
    bgColor: '#EA580C',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'P',
    fontSize: 18,
  },
  archive: {
    bgColor: '#D97706',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'ZIP',
    fontSize: 11,
  },
  text: {
    bgColor: '#64748B',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'TXT',
    fontSize: 11,
  },
  image: {
    bgColor: '#0D9488',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'IMG',
    fontSize: 11,
  },
  generic: {
    bgColor: '#64748B',
    foldColor: 'rgba(255, 255, 255, 0.45)',
    label: 'DOC',
    fontSize: 11,
  },
};

export interface DocumentIconProps extends SVGProps<SVGSVGElement> {
  fileName?: string;
  mimeType?: string;
  fileType?: DocumentFileType;
}

export const DocumentIcon: React.FC<DocumentIconProps> = React.memo(
  ({ fileName, mimeType, fileType: propFileType, width = 40, height = 46, style, ...rest }) => {
    const resolvedType = propFileType || getDocumentFileType(fileName, mimeType);
    const config = ICON_CONFIGS[resolvedType] || ICON_CONFIGS.generic;

    return (
      <svg
        viewBox="0 0 42 48"
        width={width}
        height={height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block', flexShrink: 0, ...style }}
        data-testid={`document-icon-${resolvedType}`}
        {...rest}
      >
        {/* Base Sheet Path */}
        <path
          d="M6 0H28L42 14V42C42 45.3137 39.3137 48 36 48H6C2.68629 48 0 45.3137 0 42V6C0 2.68629 2.68629 0 6 0Z"
          fill={config.bgColor}
        />

        {/* Fold Flap Path */}
        <path
          d="M28 0V10C28 12.2091 29.7909 14 32 14H42L28 0Z"
          fill={config.foldColor}
        />

        {/* Text inside Sheet */}
        <text
          x="21"
          y="31"
          fill="#FFFFFF"
          fontSize={config.fontSize}
          fontWeight="800"
          textAnchor="middle"
          dominantBaseline="central"
          letterSpacing={config.letterSpacing || 'normal'}
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          {config.label}
        </text>
      </svg>
    );
  }
);
