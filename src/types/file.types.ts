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

