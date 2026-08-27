import type { FileAttachment } from '../types/message.types';
import type { MessageFileMetadata } from '../types/file.types';
import { isLargeImage } from './imageUtils';
import { containsUrl } from './linkUtils';

export type DocumentFileType =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'ppt'
  | 'archive'
  | 'text'
  | 'image'
  | 'generic';

/**
 * High-level resolved content/message type produced by resolveMessageFileMetadata.
 */
export type ResolvedMessageType =
  | 'video'
  | 'large_image'
  | 'album'
  | 'image'
  | 'file'
  | 'link'
  | 'text';

/**
 * Resolves the document type from a file name or MIME type.
 */
export const getDocumentFileType = (
  fileName?: string,
  mimeType?: string
): DocumentFileType => {
  const rawName = (fileName || '').split('?')[0].split('#')[0].toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (rawName.endsWith('.pdf') || mime === 'application/pdf') {
    return 'pdf';
  }
  if (
    rawName.endsWith('.doc') ||
    rawName.endsWith('.docx') ||
    mime.includes('wordprocessingml') ||
    mime.includes('msword')
  ) {
    return 'word';
  }
  if (
    rawName.endsWith('.xls') ||
    rawName.endsWith('.xlsx') ||
    rawName.endsWith('.csv') ||
    mime.includes('spreadsheetml') ||
    mime.includes('ms-excel')
  ) {
    return 'excel';
  }
  if (
    rawName.endsWith('.ppt') ||
    rawName.endsWith('.pptx') ||
    rawName.endsWith('.pps') ||
    rawName.endsWith('.ppsx') ||
    mime.includes('presentationml') ||
    mime.includes('ms-powerpoint')
  ) {
    return 'ppt';
  }
  if (
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/i.test(rawName) ||
    mime.startsWith('image/')
  ) {
    return 'image';
  }
  if (
    /\.(zip|rar|7z|tar|gz|bz2)$/i.test(rawName) ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return 'archive';
  }
  if (
    /\.(txt|json|md|js|ts|tsx|jsx|html|css|xml|yaml|yml|log)$/i.test(rawName) ||
    mime.startsWith('text/')
  ) {
    return 'text';
  }
  return 'generic';
};

export interface ResolvedMessageFileMetadata {
  /** First file extracted from metadata.files or metadata url */
  firstFile?: MessageFileMetadata;
  /** List of parsed file metadata if available */
  files: MessageFileMetadata[];
  /** File name resolved from metadata, files array, attachment, or content */
  fileName: string;
  /** MIME type resolved from metadata, files array, or attachment */
  mimeType: string;
  /** Main file access or download URL */
  url: string;
  /** Thumbnail URL for image/video preview */
  thumbUrl: string;
  /** File size in bytes if available */
  size?: number;
  /** Whether the file is classified as a video */
  isVideo: boolean;
  /** Whether the file is classified as an image or album */
  isImage: boolean;
  /** Whether the file is classified as a large image (e.g. >= 10MB or flagged) */
  isLarge: boolean;
  /** Resolved high-level content/message type (video, large_image, album, image, file, link, or fallback) */
  resolvedType: ResolvedMessageType;
}

export interface ResolveMessageFileMetadataOptions {
  meta?: Record<string, unknown> | null;
  attachments?: FileAttachment[] | null;
  content?: string | null;
  type?: string | null;
}

/**
 * Safely parses metadata.files which can be a JSON string or an Array of file metadata objects.
 *
 * @param filesMeta The raw files field from message metadata
 * @returns Array of normalized MessageFileMetadata
 */
export function parseMessageFilesMetadata(filesMeta: unknown): MessageFileMetadata[] {
  if (!filesMeta) return [];
  let parsed = filesMeta;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map((f) => ({
      ...f,
      fileName: f.fileName ? String(f.fileName) : f.name ? String(f.name) : undefined,
      name: f.name ? String(f.name) : f.fileName ? String(f.fileName) : undefined,
      mimeType: f.mimeType ? String(f.mimeType) : undefined,
      url: f.url ? String(f.url) : undefined,
      thumbnailUrl: f.thumbnailUrl ? String(f.thumbnailUrl) : undefined,
      thumbUrl: f.thumbUrl ? String(f.thumbUrl) : undefined,
      size: f.size != null && !Number.isNaN(Number(f.size)) ? Number(f.size) : undefined,
      isLarge: f.isLarge === true || f.isLarge === 'true',
      width: f.width != null && !Number.isNaN(Number(f.width)) ? Number(f.width) : undefined,
      height: f.height != null && !Number.isNaN(Number(f.height)) ? Number(f.height) : undefined,
    }));
}

/**
 * Resolves unified file metadata and type classification from message metadata, attachments, content, and type.
 * Eliminates repetitive metadata parsing across ChatService, Conversation, and Pinned message utilities.
 *
 * @param options Message metadata, attachments, text content, and message type
 * @returns Normalized ResolvedMessageFileMetadata
 */
export function resolveMessageFileMetadata(
  options: ResolveMessageFileMetadataOptions
): ResolvedMessageFileMetadata {
  const { meta, attachments, content, type } = options;
  const attachment = attachments?.[0];

  const files = parseMessageFilesMetadata(meta?.files);
  const firstFile = files[0];

  const fileName =
    (meta?.fileName as string) ||
    (meta?.name as string) ||
    firstFile?.fileName ||
    firstFile?.name ||
    attachment?.name ||
    '';

  const mimeType = (meta?.mimeType as string) || firstFile?.mimeType || attachment?.mimeType || '';

  const url =
    (meta?.url as string) ||
    firstFile?.url ||
    attachment?.url ||
    (content?.startsWith('http') || content?.startsWith('blob:') ? content : '') ||
    '';

  const thumbUrl =
    (meta?.thumbnailUrl as string) ||
    (meta?.thumbUrl as string) ||
    firstFile?.thumbnailUrl ||
    firstFile?.thumbUrl ||
    firstFile?.url ||
    attachment?.thumbnailUrl ||
    '';

  const rawSize =
    meta?.size !== undefined
      ? meta.size
      : firstFile?.size !== undefined
        ? firstFile.size
        : attachment?.size;
  const size = rawSize != null && !Number.isNaN(Number(rawSize)) ? Number(rawSize) : undefined;

  const isVideo =
    meta?.type === 'video' ||
    mimeType.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v|avi|mkv|3gp|flv|wmv)$/i.test(fileName || content || '');

  const isImage = Boolean(
    meta?.type === 'image' ||
    meta?.type === 'album' ||
    (type && type.toLowerCase() === 'album') ||
    firstFile ||
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|svg|bmp|ico|tiff|avif|heic)$/i.test(fileName || url)
  );

  const isLarge =
    isImage &&
    (String(meta?.isLarge) === 'true' ||
      firstFile?.isLarge === true ||
      firstFile?.isLarge === 'true' ||
      (size !== undefined && isLargeImage(size)));

  let resolvedType: ResolvedMessageType = (meta?.type as ResolvedMessageType) || type || 'text';
  if (isVideo) {
    resolvedType = 'video';
  } else if (isLarge) {
    resolvedType = 'large_image';
  } else if (isImage) {
    resolvedType = meta?.type === 'album' || type?.toLowerCase() === 'album' ? 'album' : 'image';
  } else if (meta?.type === 'file' || (attachments && attachments.length > 0)) {
    resolvedType = 'file';
  } else if (containsUrl(content || '') || meta?.linkPreview) {
    resolvedType = 'link';
  }

  return {
    firstFile,
    files,
    fileName,
    mimeType,
    url,
    thumbUrl,
    size,
    isVideo,
    isImage,
    isLarge,
    resolvedType,
  };
}
