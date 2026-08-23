import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LargeImageCard } from '../LargeImageCard';
import * as fileService from '../../../services/fileService';

describe('LargeImageCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render file name and formatted size', () => {
    render(
      <LargeImageCard
        fileName="report.pdf"
        fileSize={1048576}
        url="https://example.com/report.pdf"
      />
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('1.00 MB')).toBeInTheDocument();
  });

  it('should call custom onDownload when provided', () => {
    const onDownload = vi.fn();
    render(
      <LargeImageCard
        fileName="photo.png"
        fileSize={2048}
        url="https://example.com/photo.png"
        onDownload={onDownload}
      />
    );

    const downloadBtn = screen.getByTitle('chat.download');
    fireEvent.click(downloadBtn);

    expect(onDownload).toHaveBeenCalledWith('https://example.com/photo.png', 'photo.png');
  });

  it('should trigger downloadFile service when onDownload is not provided', async () => {
    let progressCb: ((p: { percent: number }) => void) | undefined;
    const downloadPromise = new Promise<{
      blob: Blob;
      totalBytes: number;
      totalChunks: number;
      durationMs: number;
      contentType: string;
      fileName: string;
      url: string;
    }>((resolve) => {
      setTimeout(() => {
        progressCb?.({ percent: 100 });
        resolve({
          blob: new Blob(['data']),
          totalBytes: 4,
          totalChunks: 1,
          durationMs: 10,
          contentType: 'application/pdf',
          fileName: 'test.pdf',
          url: 'https://example.com/test.pdf',
        });
      }, 50);
    });

    const mockDownloadFile = vi.spyOn(fileService, 'downloadFile').mockImplementation((options) => {
      if (typeof options === 'object' && options.onProgress) {
        progressCb = options.onProgress as (p: { percent: number }) => void;
      }
      return {
        promise: downloadPromise,
        pause: vi.fn(),
        resume: vi.fn(),
        cancel: vi.fn(),
        state: 'completed' as const,
      };
    });

    render(
      <LargeImageCard fileName="test.pdf" fileSize={100} url="https://example.com/test.pdf" />
    );

    const downloadBtn = screen.getByTitle('chat.download');
    fireEvent.click(downloadBtn);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/test.pdf',
        fileName: 'test.pdf',
        saveAs: 'test.pdf',
      })
    );

    await waitFor(() => {
      expect(screen.getByTitle('chat.download')).not.toBeDisabled();
    });
  });
});
