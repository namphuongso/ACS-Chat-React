import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PinnedItemView } from '../PinnedItemView';
import type { PinnedMessage } from '../../../types/message.types';

describe('PinnedItemView Component', () => {
  it('should render Excel file correctly according to rule: <Tên>: <Icon file> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-1',
      creator: 'Alice',
      type: 'file',
      content: 'financials.xlsx',
      attachmentType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      attachmentUrl: 'https://example.com/financials.xlsx',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-excel')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/financials\.xlsx/)).toBeInTheDocument();
  });

  it('should render PPT file correctly according to rule: <Tên>: <Icon file> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-2',
      creator: 'Bob',
      type: 'file',
      content: 'deck.pptx',
      attachmentType: 'application/vnd.ms-powerpoint',
      attachmentUrl: 'https://example.com/deck.pptx',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Bob:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-ppt')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/deck\.pptx/)).toBeInTheDocument();
  });

  it('should render Doc file correctly according to rule: <Tên>: <Icon file> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-3',
      creator: 'Carol',
      type: 'file',
      content: 'contract.docx',
      attachmentType: 'application/msword',
      attachmentUrl: 'https://example.com/contract.docx',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Carol:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-word')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/contract\.docx/)).toBeInTheDocument();
  });

  it('should render PDF file correctly according to rule: <Tên>: <Icon file> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-4',
      creator: 'Dave',
      type: 'file',
      content: 'document.pdf',
      attachmentType: 'application/pdf',
      attachmentUrl: 'https://example.com/document.pdf',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Dave:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-pdf')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/document\.pdf/)).toBeInTheDocument();
  });

  it('should render Image file correctly according to rule: <Tên>: <Image 30x30> Photo', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-5',
      creator: 'Eve',
      type: 'image',
      content: '',
      attachmentType: 'image/jpeg',
      attachmentUrl: 'https://example.com/pic.jpg',
      thumbUrl: 'https://example.com/pic_thumb.jpg',
      createdDate: '2026-01-01T00:00:00Z',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Eve:')).toBeInTheDocument();
    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/pic_thumb.jpg');
    expect(screen.getByText(/chat\.photo|Photo/)).toBeInTheDocument();
  });

  it('should render Large Image correctly according to rule: <Tên>: <Icon file> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-6',
      creator: 'Frank',
      type: 'large_image',
      content: 'huge_artwork.png',
      attachmentType: 'image/png',
      attachmentUrl: 'https://example.com/huge_artwork.png',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Frank:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-image')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/huge_artwork\.png/)).toBeInTheDocument();
  });

  it('should render Video file correctly according to rule: <Tên>: <Icon video> File <Dot> <File name>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-7',
      creator: 'Grace',
      type: 'video',
      content: 'demo.mp4',
      attachmentType: 'video/mp4',
      attachmentUrl: 'https://example.com/demo.mp4',
      createdDate: '2026-01-01T00:00:00Z',
      thumbUrl: '',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Grace:')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/demo\.mp4/)).toBeInTheDocument();
  });

  it('should render Link correctly according to rule: <Tên>: <Image 30x30> Link <Dot> <Link>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-8',
      creator: 'Heidi',
      type: 'text',
      content: 'Check out https://namphuong.com/news',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
      createdDate: '2026-01-01T00:00:00Z',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Heidi:')).toBeInTheDocument();
    expect(screen.getByText(/chat\.link|Link/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\/namphuong\.com\/news/)).toBeInTheDocument();
  });

  it('should render normal text message correctly: <Tên>: <Content>', () => {
    const msg: PinnedMessage = {
      messageId: 'msg-9',
      creator: 'Ivan',
      type: 'text',
      content: 'Hello everyone!',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
      createdDate: '2026-01-01T00:00:00Z',
    };

    render(<PinnedItemView message={msg} />);

    expect(screen.getByText('Ivan:')).toBeInTheDocument();
    expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
  });

  it('should correctly render real backend API response items (DOC, PDF, and Text)', () => {
    const docMsg: PinnedMessage = {
      messageId: '1787506963429',
      type: 'File',
      content: '',
      createdDate: '24/08/2026',
      creator: 'Hà Anh Thảo 2',
      attachmentType: 'document',
      attachmentUrl:
        'https://namphuongstoragedev.blob.core.windows.net/np-file/NPPFiles/documents/2026/08/23/14f62d31-b332-48c4-ba0e-b15d6a6cc4d3.doc',
      thumbUrl:
        'https://namphuongstoragedev.blob.core.windows.net/np-file/NPPFiles/documents/2026/08/23/14f62d31-b332-48c4-ba0e-b15d6a6cc4d3.doc',
    };

    const pdfMsg: PinnedMessage = {
      messageId: '1787506963457',
      type: 'File',
      content: '',
      createdDate: '24/08/2026',
      creator: 'Hà Anh Thảo 2',
      attachmentType: 'document',
      attachmentUrl:
        'https://namphuongstoragedev.blob.core.windows.net/np-file/NPPFiles/documents/2026/08/23/ff371ca9-62d2-4118-9f96-2a39c00217f7.pdf',
      thumbUrl:
        'https://namphuongstoragedev.blob.core.windows.net/np-file/NPPFiles/documents/2026/08/23/ff371ca9-62d2-4118-9f96-2a39c00217f7.pdf',
    };

    const textMsg: PinnedMessage = {
      messageId: '1787751587340',
      type: 'Text',
      content: 'www',
      createdDate: '26/08/2026',
      creator: 'Hà Anh Thảo 2',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    };

    const { unmount: unmountDoc } = render(<PinnedItemView message={docMsg} />);
    expect(screen.getByText('Hà Anh Thảo 2:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-word')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/14f62d31-b332-48c4-ba0e-b15d6a6cc4d3\.doc/)).toBeInTheDocument();
    unmountDoc();

    const { unmount: unmountPdf } = render(<PinnedItemView message={pdfMsg} />);
    expect(screen.getByText('Hà Anh Thảo 2:')).toBeInTheDocument();
    expect(screen.getByTestId('document-icon-pdf')).toBeInTheDocument();
    expect(screen.getByText(/chat\.file|File/)).toBeInTheDocument();
    expect(screen.getByText(/ff371ca9-62d2-4118-9f96-2a39c00217f7\.pdf/)).toBeInTheDocument();
    unmountPdf();

    render(<PinnedItemView message={textMsg} />);
    expect(screen.getByText('Hà Anh Thảo 2:')).toBeInTheDocument();
    expect(screen.getByText('www')).toBeInTheDocument();
  });

  it('should correctly classify and render link pinned message from backend data', () => {
    const linkMsg: PinnedMessage = {
      messageId: '1787505078720',
      type: 'Text',
      content: 'https://www.npmjs.com/package/link-preview-js',
      createdDate: '24/08/2026',
      creator: 'Hà Anh Thảo 2',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    };

    render(<PinnedItemView message={linkMsg} />);
    expect(screen.getByText('Hà Anh Thảo 2:')).toBeInTheDocument();
    expect(screen.getByText(/chat\.link|Link/)).toBeInTheDocument();
    expect(
      screen.getByText(/https:\/\/www\.npmjs\.com\/package\/link-preview-js/)
    ).toBeInTheDocument();
  });

  it('should correctly classify and render Album pinned message', () => {
    const albumMsg: PinnedMessage = {
      messageId: '1787372460131',
      type: 'Album',
      content: '',
      createdDate: '22/08/2026',
      creator: 'Hà Anh Thảo 2',
      attachmentType: '',
      attachmentUrl: '',
      thumbUrl: '',
    };

    render(<PinnedItemView message={albumMsg} />);
    expect(screen.getByText('Hà Anh Thảo 2:')).toBeInTheDocument();
    expect(screen.getByText(/chat\.album|Album/)).toBeInTheDocument();
  });
});
