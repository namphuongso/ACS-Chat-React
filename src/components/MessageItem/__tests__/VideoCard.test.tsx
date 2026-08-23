import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VideoCard } from '../VideoCard';
import * as fileService from '../../../services/fileService';

describe('VideoCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render video element, file name, and formatted size', () => {
    render(
      <VideoCard
        fileName="sample_video.mp4"
        fileSize={5242880}
        url="https://example.com/sample_video.mp4"
        mimeType="video/mp4"
      />
    );

    const videoElement = screen.getByTestId('video-player');
    expect(videoElement).toBeInTheDocument();
    expect(videoElement).toHaveAttribute('src', 'https://example.com/sample_video.mp4');
    expect(screen.getByText('sample_video.mp4')).toBeInTheDocument();
    expect(screen.getByText('5.00 MB')).toBeInTheDocument();
  });

  it('should call custom onDownload when provided', () => {
    const onDownload = vi.fn();
    render(
      <VideoCard
        fileName="video.mov"
        fileSize={2048000}
        url="https://example.com/video.mov"
        onDownload={onDownload}
      />
    );

    const downloadBtn = screen.getByTestId('video-download-btn');
    fireEvent.click(downloadBtn);

    expect(onDownload).toHaveBeenCalledWith('https://example.com/video.mov', 'video.mov');
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
          blob: new Blob(['video data']),
          totalBytes: 10,
          totalChunks: 1,
          durationMs: 10,
          contentType: 'video/mp4',
          fileName: 'clip.mp4',
          url: 'https://example.com/clip.mp4',
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

    render(<VideoCard fileName="clip.mp4" fileSize={1024000} url="https://example.com/clip.mp4" />);

    const downloadBtn = screen.getByTestId('video-download-btn');
    fireEvent.click(downloadBtn);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/clip.mp4',
        fileName: 'clip.mp4',
        saveAs: 'clip.mp4',
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('video-download-btn')).not.toBeDisabled();
    });
  });

  it('should show fallback overlay when video encounters error', () => {
    render(
      <VideoCard fileName="corrupted.mov" fileSize={1024} url="https://example.com/corrupted.mov" />
    );

    const videoElement = screen.getByTestId('video-player');
    fireEvent.error(videoElement);

    expect(screen.getByTestId('video-error-overlay')).toBeInTheDocument();
    expect(screen.getByText('chat.videoUnsupported')).toBeInTheDocument();
  });

  it('should reset hasError when url prop changes', () => {
    const { rerender } = render(
      <VideoCard fileName="clip.mov" fileSize={1024} url="blob:http://localhost/temp-blob-url" />
    );

    const videoElement = screen.getByTestId('video-player');
    fireEvent.error(videoElement);

    expect(screen.getByTestId('video-error-overlay')).toBeInTheDocument();

    // Rerender with new URL (e.g. server URL after upload completes)
    rerender(
      <VideoCard fileName="clip.mov" fileSize={1024} url="https://example.com/server-url.mov" />
    );

    expect(screen.queryByTestId('video-error-overlay')).not.toBeInTheDocument();
  });
});
