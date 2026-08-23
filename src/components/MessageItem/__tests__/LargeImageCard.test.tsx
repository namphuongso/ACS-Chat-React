import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LargeImageCard, FileCard } from '../LargeImageCard';
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
    expect(screen.getByText('chat.availableOnDevice')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-pdf')).toBeInTheDocument();
  });

  it('should render correct document icons for Word, Excel, PPT, and PDF', () => {
    const { rerender } = render(
      <FileCard
        fileName="file-sample_100kB.docx"
        fileSize={108700}
        url="https://example.com/sample.docx"
      />
    );
    expect(screen.getByTestId('document-icon-word')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();

    rerender(
      <FileCard
        fileName="file_example_XLSX_10.xlsx"
        fileSize={5300}
        url="https://example.com/sample.xlsx"
      />
    );
    expect(screen.getByTestId('document-icon-excel')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();

    rerender(
      <FileCard
        fileName="NP-Solution-SUPERAPP.pptx"
        fileSize={7860000}
        url="https://example.com/sample.pptx"
      />
    );
    expect(screen.getByTestId('document-icon-ppt')).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();

    rerender(
      <FileCard
        fileName="sample.pdf"
        fileSize={18370}
        url="https://example.com/sample.pdf"
      />
    );
    expect(screen.getByTestId('document-icon-pdf')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
  });

  it('should correctly identify file type when fileName contains query params or hash', () => {
    const { rerender } = render(
      <FileCard
        fileName="https://storage.blob.core.windows.net/docs/quarterly_report.pdf?sp=r&st=2024-01-01&se=2025-01-01&spr=https&sig=abc123xyz"
        fileSize={204800}
        url="https://storage.blob.core.windows.net/docs/quarterly_report.pdf?sp=r"
      />
    );
    expect(screen.getByTestId('document-icon-pdf')).toBeInTheDocument();

    rerender(
      <FileCard
        fileName="contract.docx?version=2#page=1"
        fileSize={50000}
        url="https://example.com/contract.docx?version=2"
      />
    );
    expect(screen.getByTestId('document-icon-word')).toBeInTheDocument();

    rerender(
      <FileCard
        fileName="data_sheet.xlsx?download=true"
        fileSize={30000}
        url="https://example.com/data_sheet.xlsx"
      />
    );
    expect(screen.getByTestId('document-icon-excel')).toBeInTheDocument();
  });

  it('should call custom onOpen when open button is clicked', () => {
    const onOpen = vi.fn();
    render(
      <LargeImageCard
        fileName="sample.pdf"
        fileSize={18370}
        url="https://example.com/sample.pdf"
        onOpen={onOpen}
      />
    );

    const openBtn = screen.getByTestId('file-open-btn');
    fireEvent.click(openBtn);

    expect(onOpen).toHaveBeenCalledWith('https://example.com/sample.pdf', 'sample.pdf');
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

    const downloadBtn = screen.getByTestId('file-download-btn');
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

    const downloadBtn = screen.getByTestId('file-download-btn');
    fireEvent.click(downloadBtn);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/test.pdf',
        fileName: 'test.pdf',
        saveAs: 'test.pdf',
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId('file-download-btn')).not.toBeDisabled();
    });
  });

  it('should conditionally render open folder button based on showOpenFolder prop', () => {
    const { rerender } = render(
      <LargeImageCard
        fileName="document.pdf"
        fileSize={1024}
        url="https://example.com/document.pdf"
        showOpenFolder={false}
      />
    );

    expect(screen.queryByTestId('file-open-btn')).not.toBeInTheDocument();

    rerender(
      <LargeImageCard
        fileName="document.pdf"
        fileSize={1024}
        url="https://example.com/document.pdf"
        showOpenFolder={true}
      />
    );

    expect(screen.getByTestId('file-open-btn')).toBeInTheDocument();
  });
});
