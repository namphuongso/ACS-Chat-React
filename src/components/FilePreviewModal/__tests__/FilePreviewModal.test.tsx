import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FilePreviewModal, FilePreviewItem, getFileNameFromUrl } from '../index';
import * as fileService from '../../../services/fileService';

describe('FilePreviewModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFileNameFromUrl utility', () => {
    it('should extract filename without query parameters or hashes', () => {
      expect(getFileNameFromUrl('https://example.com/files/report.pdf?version=1#page=2')).toBe('report.pdf');
    });

    it('should decode URI components in filename', () => {
      expect(getFileNameFromUrl('https://example.com/files/My%20Document%20(Draft).docx')).toBe('My Document (Draft).docx');
    });

    it('should return empty string for falsy/empty url', () => {
      expect(getFileNameFromUrl(undefined)).toBe('');
      expect(getFileNameFromUrl('')).toBe('');
    });
  });

  it('should not render anything when isOpen is false or file is null', () => {
    const { container, rerender } = render(
      <FilePreviewModal isOpen={false} onClose={vi.fn()} file={null} />
    );
    expect(container.firstChild).toBeNull();

    const sampleFile: FilePreviewItem = {
      url: 'https://example.com/sample.pdf',
      fileName: 'sample.pdf',
    };

    rerender(<FilePreviewModal isOpen={false} onClose={vi.fn()} file={sampleFile} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render PDF preview with native iframe', () => {
    const pdfFile: FilePreviewItem = {
      url: 'https://example.com/sample.pdf',
      fileName: 'sample.pdf',
      fileSize: 18432,
      mimeType: 'application/pdf',
      senderName: 'Hà Anh Thảo',
      sentAt: new Date(),
    };

    render(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={pdfFile} />);

    expect(screen.getByTestId('file-preview-modal')).toBeInTheDocument();
    const iframe = screen.getByTestId('preview-pdf-iframe');
    expect(iframe).toHaveAttribute('src', 'https://example.com/sample.pdf');
    expect(screen.getByText('sample.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Hà Anh Thảo/)).toBeInTheDocument();
    expect(screen.getByText(/18.00 KB/)).toBeInTheDocument();
  });

  it('should render Microsoft Office Online embed iframe and notice banner for public Office files', () => {
    const onDownload = vi.fn();
    const wordFile: FilePreviewItem = {
      url: 'https://example.com/files/file-sample_100kB.docx',
      fileName: 'file-sample_100kB.docx',
      fileSize: 111616,
      senderName: 'Hà Anh Thảo',
      sentAt: new Date(),
    };

    const { rerender } = render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={wordFile}
        onDownload={onDownload}
      />
    );

    expect(screen.getByTestId('preview-office-container')).toBeInTheDocument();
    expect(screen.getByTestId('office-notice-bar')).toBeInTheDocument();
    expect(screen.getByText('chat.officePreviewNotice')).toBeInTheDocument();

    const noticeDownloadBtn = screen.getByTestId('office-notice-download-btn');
    fireEvent.click(noticeDownloadBtn);
    expect(onDownload).toHaveBeenCalledWith(
      'https://example.com/files/file-sample_100kB.docx',
      'file-sample_100kB.docx'
    );

    const dismissBtn = screen.getByTestId('office-notice-dismiss-btn');
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId('office-notice-bar')).not.toBeInTheDocument();

    let iframe = screen.getByTestId('preview-office-iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fexample.com%2Ffiles%2Ffile-sample_100kB.docx'
    );
    expect(screen.getByText('file-sample_100kB.docx')).toBeInTheDocument();

    const excelFile: FilePreviewItem = {
      url: 'https://example.com/files/file_example_XLSX_10.xlsx',
      fileName: 'file_example_XLSX_10.xlsx',
      fileSize: 5120,
      senderName: 'Hà Anh Thảo',
      sentAt: new Date(),
    };

    rerender(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={excelFile} />);

    iframe = screen.getByTestId('preview-office-iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fexample.com%2Ffiles%2Ffile_example_XLSX_10.xlsx'
    );
    expect(screen.getByText('file_example_XLSX_10.xlsx')).toBeInTheDocument();

    const pptFile: FilePreviewItem = {
      url: 'https://example.com/files/NP-Solution-SUPERAPP.pptx',
      fileName: 'NP-Solution-SUPERAPP.pptx',
      fileSize: 8388608,
      senderName: 'Hà Anh Thảo',
      sentAt: new Date(),
    };

    rerender(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={pptFile} />);

    iframe = screen.getByTestId('preview-office-iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://view.officeapps.live.com/op/embed.aspx?src=https%3A%2F%2Fexample.com%2Ffiles%2FNP-Solution-SUPERAPP.pptx'
    );
    expect(screen.getByText('NP-Solution-SUPERAPP.pptx')).toBeInTheDocument();
    expect(screen.getByText(/8.00 MB/)).toBeInTheDocument();
  });

  it('should render fallback card for private, localhost, and blob Office documents', () => {
    const localhostDoc: FilePreviewItem = {
      url: 'http://localhost:3000/uploads/secret-report.docx',
      fileName: 'secret-report.docx',
      fileSize: 20480,
    };

    const { rerender } = render(
      <FilePreviewModal isOpen={true} onClose={vi.fn()} file={localhostDoc} />
    );

    expect(screen.getByTestId('preview-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-office-iframe')).not.toBeInTheDocument();
    expect(screen.getByText('chat.officePrivateNotice')).toBeInTheDocument();

    const privateIpDoc: FilePreviewItem = {
      url: 'http://192.168.1.100:8080/files/financial.xlsx',
      fileName: 'financial.xlsx',
    };

    rerender(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={privateIpDoc} />);
    expect(screen.getByTestId('preview-fallback')).toBeInTheDocument();

    const blobDoc: FilePreviewItem = {
      url: 'blob:http://localhost:5173/abc-123',
      fileName: 'presentation.pptx',
    };

    rerender(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={blobDoc} />);
    expect(screen.getByTestId('preview-fallback')).toBeInTheDocument();
  });

  it('should render fallback card when disableOfficeOnlineViewer is true even for public URLs', () => {
    const wordFile: FilePreviewItem = {
      url: 'https://example.com/files/doc.docx',
      fileName: 'doc.docx',
    };

    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={wordFile}
        disableOfficeOnlineViewer={true}
      />
    );

    expect(screen.getByTestId('preview-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-office-iframe')).not.toBeInTheDocument();
  });

  it('should infer file type and name from URL when fileName is not provided', () => {
    const videoFile: FilePreviewItem = {
      url: 'https://example.com/media/clip.mp4',
    };

    const { rerender } = render(
      <FilePreviewModal isOpen={true} onClose={vi.fn()} file={videoFile} />
    );

    expect(screen.getByTestId('preview-video-player')).toBeInTheDocument();
    expect(screen.getAllByText('clip.mp4').length).toBeGreaterThan(0);

    const imageFile: FilePreviewItem = {
      url: 'https://example.com/assets/picture.png',
    };

    rerender(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={imageFile} />);
    expect(screen.getByTestId('preview-image')).toBeInTheDocument();
  });

  it('should render Video player for video formats', () => {
    const videoFile: FilePreviewItem = {
      url: 'https://example.com/file_example_MP4_480_1_5MG.mp4',
      fileName: 'file_example_MP4_480_1_5MG.mp4',
      fileSize: 1048576,
      mimeType: 'video/mp4',
      senderName: 'Hà Anh Thảo',
      sentAt: new Date(),
    };

    render(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={videoFile} />);

    const video = screen.getByTestId('preview-video-player');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', 'https://example.com/file_example_MP4_480_1_5MG.mp4');
    expect(screen.getByText('file_example_MP4_480_1_5MG.mp4')).toBeInTheDocument();
  });

  it('should render Image element for image formats', () => {
    const imageFile: FilePreviewItem = {
      url: 'https://example.com/photo.jpg',
      fileName: 'photo.jpg',
      fileSize: 204800,
      mimeType: 'image/jpeg',
      senderName: 'Alice',
      sentAt: new Date(),
    };

    render(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={imageFile} />);

    const img = screen.getByTestId('preview-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
    expect(screen.getByText('photo.jpg')).toBeInTheDocument();
  });

  it('should render Fallback card for unsupported file types', () => {
    const zipFile: FilePreviewItem = {
      url: 'https://example.com/archive.zip',
      fileName: 'archive.zip',
      fileSize: 5242880,
      mimeType: 'application/zip',
      senderName: 'Bob',
      sentAt: new Date(),
    };

    render(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={zipFile} />);

    expect(screen.getByTestId('preview-fallback')).toBeInTheDocument();
    expect(screen.getAllByText('archive.zip').length).toBeGreaterThan(0);
    expect(screen.getByTestId('fallback-download-btn')).toBeInTheDocument();
  });


  it('should call onClose when clicking close button or pressing Escape key', () => {
    const onClose = vi.fn();
    const file: FilePreviewItem = {
      url: 'https://example.com/sample.pdf',
      fileName: 'sample.pdf',
    };

    render(<FilePreviewModal isOpen={true} onClose={onClose} file={file} />);

    const closeBtn = screen.getByTestId('preview-close-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should call onDownload when download button in bottom bar is clicked', () => {
    const onDownload = vi.fn();
    const file: FilePreviewItem = {
      url: 'https://example.com/sample.pdf',
      fileName: 'sample.pdf',
    };

    render(
      <FilePreviewModal
        isOpen={true}
        onClose={vi.fn()}
        file={file}
        onDownload={onDownload}
      />
    );

    const downloadBtn = screen.getByTestId('preview-download-btn');
    fireEvent.click(downloadBtn);

    expect(onDownload).toHaveBeenCalledWith('https://example.com/sample.pdf', 'sample.pdf');
  });

  it('should call downloadFile service when onDownload is not provided', () => {
    const mockDownloadFile = vi.spyOn(fileService, 'downloadFile').mockReturnValue({
      promise: Promise.resolve({
        blob: new Blob(['data']),
        totalBytes: 10,
        totalChunks: 1,
        durationMs: 10,
        contentType: 'application/pdf',
        fileName: 'sample.pdf',
        url: 'https://example.com/sample.pdf',
      }),
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
      state: 'completed' as const,
    });

    const file: FilePreviewItem = {
      url: 'https://example.com/sample.pdf',
      fileName: 'sample.pdf',
    };

    render(<FilePreviewModal isOpen={true} onClose={vi.fn()} file={file} />);

    const downloadBtn = screen.getByTestId('preview-download-btn');
    fireEvent.click(downloadBtn);

    expect(mockDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/sample.pdf',
        fileName: 'sample.pdf',
      })
    );
  });
});
