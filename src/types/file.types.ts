export interface CreateUploadSessionResponse {
  uploadId: string;
  uploadUrl?: string;
  sasUrl?: string;
  blobUrl?: string;
  blobName?: string;
  chunkSize?: number;
  [key: string]: unknown;
}

export type CompleteUploadSessionResponse =
  | string
  | string[]
  | { url?: string; blobUrl?: string; [key: string]: unknown };

/**
 * Metadata structure for individual files stored inside message metadata.files
 */
export interface MessageFileMetadata {
  fileName?: string;
  name?: string;
  mimeType?: string;
  url?: string;
  thumbnailUrl?: string;
  thumbUrl?: string;
  size?: number | string;
  isLarge?: boolean | string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}
