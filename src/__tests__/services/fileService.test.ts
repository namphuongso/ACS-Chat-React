import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadFile, uploadFiles, downloadFile, downloadFiles } from '../../services/fileService';
import { chatService } from '../../services/chatService';
import * as apiClient from '../../utils/apiClient';
import { uploadLargeFile, downloadLargeFile } from '@namphuongtechnologi/azure-blob-transfer';
import type { UploadOptions, DownloadResult } from '@namphuongtechnologi/azure-blob-transfer';

vi.mock('@namphuongtechnologi/azure-blob-transfer', () => ({
  uploadLargeFile: vi.fn(),
  downloadLargeFile: vi.fn(),
  downloadLargeFileFromUrl: vi.fn(),
  saveBlobAs: vi.fn(),
}));

describe('fileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(chatService, 'getConfig').mockReturnValue({
      endpoint: 'https://test.communication.azure.com',
      backendUrl: 'https://test-api.example.com',
      userId: 'test-user-id',
      displayName: 'Test User',
      token: 'test-token',
      tokenRefresher: vi.fn(),
      uploadHeaders: {
        'x-api-key': 'test-key',
      },
    });
  });

  it('should upload file successfully when backend returns sasUrl', async () => {
    const file = new File(['content'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const mockFetchBackend = vi
      .spyOn(apiClient, 'fetchBackend')
      .mockImplementation(async (_config, endpoint) => {
        if (endpoint === '/api/files/create-upload-session') {
          return {
            statusCode: 200,
            message: 'Successful.',
            totalRecord: 0,
            data: {
              uploadId: 'test-upload-123',
              sasUrl: 'https://storage.blob.core.windows.net/container/file.xlsx?sv=2024&sig=abc',
              blobUrl:
                'https://view.officeapps.live.com/op/view.aspx?src=https://storage.blob.core.windows.net/container/file.xlsx',
              blobName: 'documents/2026/file.xlsx',
            },
          };
        }
        if (endpoint === '/api/files/complete-upload') {
          return {
            statusCode: 200,
            message: 'Successful.',
            totalRecord: 0,
            data: {},
          };
        }
        return {
          statusCode: 200,
          message: 'Successful.',
          totalRecord: 0,
          data: {},
        };
      });

    vi.mocked(uploadLargeFile).mockImplementation((options: UploadOptions) => {
      return {
        promise: (async () => {
          const sessionResult = await options.session!.createSession!(options.file);
          expect(sessionResult.uploadUrl).toBe(
            'https://storage.blob.core.windows.net/container/file.xlsx?sv=2024&sig=abc'
          );
          expect(sessionResult.uploadId).toBe('test-upload-123');

          await options.session!.completeSession!(sessionResult.uploadId, sessionResult.blobName);
          return {
            uploadId: sessionResult.uploadId,
            blobName: sessionResult.blobName,
            totalBytes: options.file.size,
            totalChunks: 1,
            durationMs: 100,
          };
        })(),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
    });

    const url = await uploadFile(file);

    expect(url).toBe('https://storage.blob.core.windows.net/container/file.xlsx');
    expect(mockFetchBackend).toHaveBeenCalledTimes(2);
    expect(mockFetchBackend).toHaveBeenCalledWith(
      expect.anything(),
      '/api/files/complete-upload',
      expect.objectContaining({
        body: JSON.stringify({
          uploadId: 'test-upload-123',
          blobName: 'documents/2026/file.xlsx',
        }),
      })
    );
    expect(uploadLargeFile).toHaveBeenCalled();
  });

  it('should upload multiple files with uploadFiles', async () => {
    const file1 = new File(['a'], 'file1.png', { type: 'image/png' });
    const file2 = new File(['b'], 'file2.png', { type: 'image/png' });

    vi.spyOn(apiClient, 'fetchBackend').mockImplementation(async (_config, endpoint) => {
      if (endpoint === '/api/files/create-upload-session') {
        return {
          statusCode: 200,
          message: 'Successful.',
          totalRecord: 0,
          data: {
            uploadId: 'test-upload-id',
            sasUrl: 'https://storage.blob.core.windows.net/container/file.png?sv=2024&sig=abc',
          },
        };
      }
      return {
        statusCode: 200,
        message: 'Successful.',
        totalRecord: 0,
        data: {},
      };
    });

    vi.mocked(uploadLargeFile).mockImplementation((options: UploadOptions) => {
      return {
        promise: (async () => {
          const sessionResult = await options.session!.createSession!(options.file);
          await options.session!.completeSession!(sessionResult.uploadId);
          return {
            uploadId: sessionResult.uploadId,
            totalBytes: options.file.size,
            totalChunks: 1,
            durationMs: 100,
          };
        })(),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
    });

    const result = await uploadFiles([file1, file2]);
    expect(result.success).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(result.success).toEqual([
      'https://storage.blob.core.windows.net/container/file.png',
      'https://storage.blob.core.windows.net/container/file.png',
    ]);
  });

  it('should report failed files in detail when upload partially fails', async () => {
    const file1 = new File(['a'], 'ok.png', { type: 'image/png' });
    const file2 = new File(['b'], 'bad.png', { type: 'image/png' });

    vi.spyOn(apiClient, 'fetchBackend').mockImplementation(async (_config, endpoint) => {
      if (endpoint === '/api/files/create-upload-session') {
        return {
          statusCode: 200,
          message: 'Successful.',
          totalRecord: 0,
          data: {
            uploadId: 'test-upload-id',
            sasUrl: 'https://storage.blob.core.windows.net/container/file.png?sv=2024&sig=abc',
          },
        };
      }
      return {
        statusCode: 200,
        message: 'Successful.',
        totalRecord: 0,
        data: {},
      };
    });

    vi.mocked(uploadLargeFile).mockImplementation((options: UploadOptions) => {
      return {
        promise: (async () => {
          if (options.file.name === 'bad.png') {
            throw new Error('Upload failed for bad.png');
          }
          const sessionResult = await options.session!.createSession!(options.file);
          await options.session!.completeSession!(sessionResult.uploadId);
          return {
            uploadId: sessionResult.uploadId,
            totalBytes: options.file.size,
            totalChunks: 1,
            durationMs: 100,
          };
        })(),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
    });

    const result = await uploadFiles([file1, file2]);
    expect(result.success).toHaveLength(1);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].file.name).toBe('bad.png');
    expect(result.failed[0].error).toBeInstanceOf(Error);
  });

  it('should throw when all files fail to upload', async () => {
    const file = new File(['b'], 'bad.png', { type: 'image/png' });

    vi.spyOn(apiClient, 'fetchBackend').mockImplementation(async (_config, endpoint) => {
      if (endpoint === '/api/files/create-upload-session') {
        return {
          statusCode: 200,
          message: 'Successful.',
          totalRecord: 0,
          data: {
            uploadId: 'test-upload-id',
            sasUrl: 'https://storage.blob.core.windows.net/container/file.png?sv=2024&sig=abc',
          },
        };
      }
      return {
        statusCode: 200,
        message: 'Successful.',
        totalRecord: 0,
        data: {},
      };
    });

    vi.mocked(uploadLargeFile).mockImplementation(() => {
      return {
        promise: Promise.reject(new Error('Upload failed')),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'error' as const,
      };
    });

    await expect(uploadFiles([file])).rejects.toThrow(
      'Upload failed: no files uploaded successfully'
    );
  });

  describe('downloadFile', () => {
    it('should call downloadLargeFile with default saveAs and config headers when given a URL string', () => {
      const mockController = {
        promise: Promise.resolve({
          blob: new Blob(['test']),
          totalBytes: 4,
          totalChunks: 1,
          durationMs: 50,
          contentType: 'application/pdf',
          fileName: 'doc.pdf',
          url: 'https://example.com/doc.pdf',
        }),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };

      vi.mocked(downloadLargeFile).mockReturnValue(
        mockController as unknown as ReturnType<typeof downloadLargeFile>
      );

      const onProgress = vi.fn();
      const controller = downloadFile('https://example.com/doc.pdf', 'doc.pdf', onProgress);

      expect(downloadLargeFile).toHaveBeenCalledWith({
        url: 'https://example.com/doc.pdf',
        fileName: 'doc.pdf',
        saveAs: 'doc.pdf',
        headers: undefined,
        onProgress,
      });
      expect(controller).toBe(mockController);
    });

    it('should include downloadHeaders from chat config without leaking backendHeaders', () => {
      vi.spyOn(chatService, 'getConfig').mockReturnValue({
        endpoint: 'https://test.communication.azure.com',
        userId: 'test-user',
        displayName: 'User',
        token: 'token',
        tokenRefresher: vi.fn(),
        backendHeaders: { Authorization: 'Bearer token123' },
        downloadHeaders: { 'X-Custom-Header': 'custom-value' },
      });

      const mockController = {
        promise: Promise.resolve({} as unknown as DownloadResult),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
      vi.mocked(downloadLargeFile).mockReturnValue(
        mockController as unknown as ReturnType<typeof downloadLargeFile>
      );

      downloadFile({ url: 'https://example.com/file.zip' });

      expect(downloadLargeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/file.zip',
          saveAs: true,
          headers: {
            'X-Custom-Header': 'custom-value',
          },
        })
      );
    });

    it('should allow options to override headers and saveAs', () => {
      const mockController = {
        promise: Promise.resolve({} as unknown as DownloadResult),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
      vi.mocked(downloadLargeFile).mockReturnValue(
        mockController as unknown as ReturnType<typeof downloadLargeFile>
      );

      downloadFile({
        url: 'https://example.com/custom.png',
        saveAs: false,
        headers: { 'X-Override': 'yes' },
        concurrency: 8,
      });

      expect(downloadLargeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/custom.png',
          saveAs: false,
          headers: expect.objectContaining({ 'X-Override': 'yes' }),
          concurrency: 8,
        })
      );
    });
  });

  describe('downloadFiles', () => {
    it('should download multiple files successfully', async () => {
      const mockResult1 = {
        blob: new Blob(['file1']),
        totalBytes: 5,
        totalChunks: 1,
        durationMs: 50,
        contentType: 'image/png',
        fileName: 'img1.png',
        url: 'https://example.com/img1.png',
      };
      const mockResult2 = {
        blob: new Blob(['file2']),
        totalBytes: 5,
        totalChunks: 1,
        durationMs: 60,
        contentType: 'image/png',
        fileName: 'img2.png',
        url: 'https://example.com/img2.png',
      };

      vi.mocked(downloadLargeFile).mockImplementation((options) => {
        const isFirst = options.url.includes('img1');
        return {
          promise: Promise.resolve(isFirst ? mockResult1 : mockResult2),
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(),
          state: 'completed' as const,
        } as unknown as ReturnType<typeof downloadLargeFile>;
      });

      const result = await downloadFiles([
        { url: 'https://example.com/img1.png', fileName: 'img1.png' },
        'https://example.com/img2.png',
      ]);

      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.success[0].fileName).toBe('img1.png');
    });

    it('should handle partial download failures', async () => {
      const mockResult1 = {
        blob: new Blob(['ok']),
        totalBytes: 2,
        totalChunks: 1,
        durationMs: 50,
        contentType: 'text/plain',
        fileName: 'ok.txt',
        url: 'https://example.com/ok.txt',
      };

      vi.mocked(downloadLargeFile).mockImplementation((options) => {
        if (options.url.includes('bad')) {
          return {
            promise: Promise.reject(new Error('Network error on bad.txt')),
            pause: vi.fn(),
            resume: vi.fn(),
            cancel: vi.fn(),
            state: 'error' as const,
          } as unknown as ReturnType<typeof downloadLargeFile>;
        }
        return {
          promise: Promise.resolve(mockResult1),
          pause: vi.fn(),
          resume: vi.fn(),
          cancel: vi.fn(),
          state: 'completed' as const,
        } as unknown as ReturnType<typeof downloadLargeFile>;
      });

      const result = await downloadFiles([
        { url: 'https://example.com/ok.txt', fileName: 'ok.txt' },
        { url: 'https://example.com/bad.txt', fileName: 'bad.txt' },
      ]);

      expect(result.success).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].fileName).toBe('bad.txt');
    });

    it('should throw when empty array is provided', async () => {
      await expect(downloadFiles([])).rejects.toThrow('No files provided to download');
    });

    it('should throw when all files fail to download', async () => {
      vi.mocked(downloadLargeFile).mockReturnValue({
        promise: Promise.reject(new Error('Download failed')),
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'error' as const,
      } as unknown as ReturnType<typeof downloadLargeFile>);

      await expect(downloadFiles(['https://example.com/fail.zip'])).rejects.toThrow(
        'Download failed: no files downloaded successfully'
      );
    });
  });
});
