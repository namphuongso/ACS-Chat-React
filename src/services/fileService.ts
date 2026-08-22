import { chatService } from './chatService';
import { fetchBackend } from '../utils/apiClient';
import {
  uploadLargeFile,
  downloadLargeFile,
  downloadLargeFileFromUrl,
  saveBlobAs,
  DownloadError,
} from '@namphuongtechnologi/azure-blob-transfer';
import type {
  DownloadOptions,
  DownloadResult,
  DownloadController,
  DownloadProgress,
  DownloadState,
  ChunkDownloadRetryOptions,
} from '@namphuongtechnologi/azure-blob-transfer';
import { CreateUploadSessionResponse, CompleteUploadSessionResponse } from '../types';
import { logger } from '../utils/logger';

export const uploadFile = async (file: File): Promise<string> => {
  const config = chatService.getConfig();
  if (!config) throw new Error('Chat is not initialized');
  if (!config.backendUrl) throw new Error('Backend URL is not configured');

  const { backendUrl } = config;
  // Merge backend headers with upload-specific headers (uploadHeaders win)
  const mergedHeaders = { ...config.backendHeaders, ...config.uploadHeaders };
  let fileUrl = '';
  let blobName = '';

  const controller = uploadLargeFile({
    file,
    apiHeaders: config.uploadHeaders as Record<string, string>,
    session: {
      createSession: async (f) => {
        const response = await fetchBackend<CreateUploadSessionResponse>(
          { ...config, backendUrl, backendHeaders: mergedHeaders },
          '/api/files/create-upload-session',
          {
            method: 'POST',
            body: JSON.stringify({
              fileName: f.name,
              fileSize: f.size,
              contentType: f.type,
            }),
          }
        );

        const data = response.data;
        const sasUrl = data?.uploadUrl || data?.sasUrl || '';
        blobName = data?.blobName || '';

        if (sasUrl) {
          try {
            const urlObj = new URL(sasUrl);
            urlObj.search = ''; // Strip SAS token
            fileUrl = urlObj.toString();
          } catch (e) {
            fileUrl = sasUrl;
          }
        }

        return {
          ...data,
          uploadId: data?.uploadId,
          uploadUrl: sasUrl,
          blobName: data?.blobName,
          chunkSize: data?.chunkSize,
        };
      },
      completeSession: async (uploadId: string) => {
        const response = await fetchBackend<CompleteUploadSessionResponse>(
          { ...config, backendUrl, backendHeaders: mergedHeaders },
          '/api/files/complete-upload',
          {
            method: 'POST',
            body: JSON.stringify({
              uploadId,
              ...(blobName ? { blobName } : {}),
            }),
          }
        );

        if (response.data) {
          if (typeof response.data === 'string') {
            fileUrl = response.data;
          } else if (Array.isArray(response.data) && response.data.length > 0) {
            fileUrl = response.data[0];
          } else if (typeof response.data === 'object' && response.data !== null) {
            if ('url' in response.data && typeof response.data.url === 'string') {
              fileUrl = response.data.url;
            } else if ('blobUrl' in response.data && typeof response.data.blobUrl === 'string') {
              fileUrl = response.data.blobUrl;
            }
          }
        }
      },
      cancelSession: async (uploadId) => {
        await fetchBackend<unknown>(
          { ...config, backendUrl, backendHeaders: mergedHeaders },
          '/api/files/cancel-upload',
          {
            method: 'POST',
            body: JSON.stringify({ uploadId }),
          }
        );
      },
    },
  });

  await controller.promise;

  if (!fileUrl) {
    throw new Error('Upload failed: no file URL returned from server');
  }

  return fileUrl;
};

export interface UploadFilesResult {
  /** URLs of successfully uploaded files */
  success: string[];
  /** Files that failed to upload, with the error */
  failed: Array<{ file: File; error: unknown }>;
}

export const uploadFiles = async (files: File[]): Promise<UploadFilesResult> => {
  if (!files || files.length === 0) throw new Error('No files provided');

  const results = await Promise.allSettled(files.map((file) => uploadFile(file)));

  const success: string[] = [];
  const failed: Array<{ file: File; error: unknown }> = [];

  results.forEach((r, index) => {
    if (r.status === 'fulfilled' && r.value) {
      success.push(r.value);
    } else {
      const file = files[index];
      const error = r.status === 'rejected' ? r.reason : new Error('Upload returned empty URL');
      logger.warn(`[fileService] File upload failed: ${file.name}`, error);
      failed.push({ file, error });
    }
  });

  if (success.length === 0) {
    throw new Error('Upload failed: no files uploaded successfully');
  }

  return { success, failed };
};

export interface DownloadFileOptions extends Partial<DownloadOptions> {
  url: string;
}

export interface DownloadFilesItem {
  url: string;
  fileName?: string;
  options?: Partial<DownloadOptions>;
}

export interface DownloadFilesResult {
  /** Results of successfully downloaded files */
  success: DownloadResult[];
  /** Files that failed to download, with the error */
  failed: Array<{ url: string; fileName?: string; error: unknown }>;
}

/**
 * Download a file from URL using Azure Storage chunked parallel range download.
 *
 * @param urlOrOptions URL string or DownloadFileOptions configuration object
 * @param fileName Optional filename for saving to disk when passing a URL string
 * @param onProgress Optional progress callback when passing a URL string
 * @returns DownloadController with `.promise`, `.pause()`, `.resume()`, `.cancel()`, and `.state`
 */
export const downloadFile = (
  urlOrOptions: string | DownloadFileOptions,
  fileName?: string,
  onProgress?: (progress: DownloadProgress) => void
): DownloadController => {
  const config = chatService.getConfig();
  const defaultHeaders = {
    ...(config?.downloadHeaders || {}),
  };

  let options: DownloadOptions;

  if (typeof urlOrOptions === 'string') {
    options = {
      url: urlOrOptions,
      fileName,
      saveAs: fileName || true,
      headers: Object.keys(defaultHeaders).length > 0 ? defaultHeaders : undefined,
      onProgress,
    };
  } else {
    const mergedHeaders = {
      ...defaultHeaders,
      ...(urlOrOptions.headers || {}),
    };

    options = {
      saveAs: true,
      headers: Object.keys(mergedHeaders).length > 0 ? mergedHeaders : undefined,
      ...urlOrOptions,
    };
  }

  return downloadLargeFile(options);
};

/**
 * Download multiple files in parallel using Azure Storage range download.
 *
 * @param items Array of URL strings or DownloadFilesItem objects
 * @returns Object containing successful DownloadResult items and failed download errors
 */
export const downloadFiles = async (
  items: Array<string | DownloadFilesItem>
): Promise<DownloadFilesResult> => {
  if (!items || items.length === 0) throw new Error('No files provided to download');

  const normalizedItems: DownloadFilesItem[] = items.map((item) =>
    typeof item === 'string' ? { url: item } : item
  );

  const results = await Promise.allSettled(
    normalizedItems.map((item) => {
      const controller = downloadFile({
        url: item.url,
        fileName: item.fileName,
        ...(item.options || {}),
      });
      return controller.promise;
    })
  );

  const success: DownloadResult[] = [];
  const failed: Array<{ url: string; fileName?: string; error: unknown }> = [];

  results.forEach((r, index) => {
    const item = normalizedItems[index];
    if (r.status === 'fulfilled' && r.value) {
      success.push(r.value);
    } else {
      const error = r.status === 'rejected' ? r.reason : new Error('Download failed');
      logger.warn(`[fileService] File download failed: ${item.fileName || item.url}`, error);
      failed.push({ url: item.url, fileName: item.fileName, error });
    }
  });

  if (success.length === 0) {
    throw new Error('Download failed: no files downloaded successfully');
  }

  return { success, failed };
};

export { downloadLargeFile, downloadLargeFileFromUrl, saveBlobAs, DownloadError };

export type {
  DownloadOptions,
  DownloadResult,
  DownloadController,
  DownloadProgress,
  DownloadState,
  ChunkDownloadRetryOptions,
};
