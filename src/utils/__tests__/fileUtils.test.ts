import { describe, expect, it } from 'vitest';
import {
  parseMessageFilesMetadata,
  resolveMessageFileMetadata,
  getDocumentFileType,
} from '../fileUtils';
import type { FileAttachment } from '../../types/message.types';

describe('fileUtils - parseMessageFilesMetadata', () => {
  it('returns empty array when input is null, undefined, or empty', () => {
    expect(parseMessageFilesMetadata(undefined)).toEqual([]);
    expect(parseMessageFilesMetadata(null)).toEqual([]);
    expect(parseMessageFilesMetadata('')).toEqual([]);
  });

  it('handles invalid JSON string gracefully', () => {
    expect(parseMessageFilesMetadata('invalid-json{')).toEqual([]);
    expect(parseMessageFilesMetadata('{ not: array }')).toEqual([]);
  });

  it('parses valid JSON string array of file metadata', () => {
    const json = JSON.stringify([
      {
        fileName: 'test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
      },
      { name: 'document.pdf', url: 'https://example.com/doc.pdf', size: '2048' },
    ]);

    const result = parseMessageFilesMetadata(json);
    expect(result).toHaveLength(2);
    expect(result[0].fileName).toBe('test.jpg');
    expect(result[0].name).toBe('test.jpg');
    expect(result[0].size).toBe(1024);
    expect(result[0].mimeType).toBe('image/jpeg');

    expect(result[1].fileName).toBe('document.pdf');
    expect(result[1].name).toBe('document.pdf');
    expect(result[1].size).toBe(2048);
  });

  it('normalizes object array directly provided', () => {
    const rawFiles = [
      {
        fileName: 'photo.png',
        url: 'https://example.com/photo.png',
        size: '12000000',
        isLarge: 'true',
        width: '1920',
        height: '1080',
      },
    ];

    const result = parseMessageFilesMetadata(rawFiles);
    expect(result).toHaveLength(1);
    expect(result[0].fileName).toBe('photo.png');
    expect(result[0].size).toBe(12000000);
    expect(result[0].isLarge).toBe(true);
    expect(result[0].width).toBe(1920);
    expect(result[0].height).toBe(1080);
  });
});

describe('fileUtils - resolveMessageFileMetadata', () => {
  it('resolves video metadata correctly', () => {
    const result = resolveMessageFileMetadata({
      meta: {
        type: 'video',
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        url: 'https://example.com/clip.mp4',
        thumbnailUrl: 'https://example.com/clip_thumb.jpg',
      },
      content: 'clip.mp4',
    });

    expect(result.isVideo).toBe(true);
    expect(result.resolvedType).toBe('video');
    expect(result.fileName).toBe('clip.mp4');
    expect(result.mimeType).toBe('video/mp4');
    expect(result.url).toBe('https://example.com/clip.mp4');
    expect(result.thumbUrl).toBe('https://example.com/clip_thumb.jpg');
  });

  it('resolves large image correctly based on file size threshold', () => {
    const result = resolveMessageFileMetadata({
      meta: {
        type: 'image',
        fileName: 'huge.jpg',
        url: 'https://example.com/huge.jpg',
        size: 15 * 1024 * 1024, // 15MB
      },
    });

    expect(result.isImage).toBe(true);
    expect(result.isLarge).toBe(true);
    expect(result.resolvedType).toBe('large_image');
  });

  it('resolves large image when isLarge flag is set to true', () => {
    const result = resolveMessageFileMetadata({
      meta: {
        type: 'image',
        fileName: 'poster.png',
        url: 'https://example.com/poster.png',
        isLarge: 'true',
      },
    });

    expect(result.isLarge).toBe(true);
    expect(result.resolvedType).toBe('large_image');
  });

  it('resolves album type correctly', () => {
    const result = resolveMessageFileMetadata({
      meta: {
        type: 'album',
        files: JSON.stringify([
          { fileName: 'img1.jpg', url: 'https://example.com/img1.jpg' },
          { fileName: 'img2.jpg', url: 'https://example.com/img2.jpg' },
        ]),
      },
      type: 'album',
    });

    expect(result.isImage).toBe(true);
    expect(result.resolvedType).toBe('album');
    expect(result.files).toHaveLength(2);
    expect(result.firstFile?.fileName).toBe('img1.jpg');
  });

  it('resolves attachment metadata when meta is missing', () => {
    const attachments: FileAttachment[] = [
      {
        id: 'att-1',
        name: 'report.pdf',
        size: 50000,
        mimeType: 'application/pdf',
        url: 'https://example.com/report.pdf',
        thumbnailUrl: 'https://example.com/report_thumb.jpg',
      },
    ];

    const result = resolveMessageFileMetadata({
      attachments,
      type: 'text',
    });

    expect(result.fileName).toBe('report.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.url).toBe('https://example.com/report.pdf');
    expect(result.thumbUrl).toBe('https://example.com/report_thumb.jpg');
    expect(result.size).toBe(50000);
    expect(result.resolvedType).toBe('file');
  });

  it('resolves link messages correctly', () => {
    const result = resolveMessageFileMetadata({
      content: 'Check this link: https://namphuong.com',
      type: 'text',
    });

    expect(result.resolvedType).toBe('link');
    expect(result.isVideo).toBe(false);
    expect(result.isImage).toBe(false);
  });

  it('handles completely empty input safely with defaults', () => {
    const result = resolveMessageFileMetadata({});
    expect(result.fileName).toBe('');
    expect(result.mimeType).toBe('');
    expect(result.url).toBe('');
    expect(result.thumbUrl).toBe('');
    expect(result.size).toBeUndefined();
    expect(result.isVideo).toBe(false);
    expect(result.isImage).toBe(false);
    expect(result.isLarge).toBe(false);
    expect(result.resolvedType).toBe('text');
  });
});

describe('fileUtils - getDocumentFileType', () => {
  it('detects PDF by file name and MIME type', () => {
    expect(getDocumentFileType('document.pdf')).toBe('pdf');
    expect(getDocumentFileType('report.PDF')).toBe('pdf');
    expect(getDocumentFileType(undefined, 'application/pdf')).toBe('pdf');
  });

  it('detects Word documents by file name and MIME type', () => {
    expect(getDocumentFileType('contract.docx')).toBe('word');
    expect(getDocumentFileType('letter.doc')).toBe('word');
    expect(getDocumentFileType(undefined, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('word');
    expect(getDocumentFileType(undefined, 'application/msword')).toBe('word');
  });

  it('detects Excel spreadsheets by file name and MIME type', () => {
    expect(getDocumentFileType('budget.xlsx')).toBe('excel');
    expect(getDocumentFileType('data.csv')).toBe('excel');
    expect(getDocumentFileType(undefined, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('excel');
    expect(getDocumentFileType(undefined, 'application/vnd.ms-excel')).toBe('excel');
  });

  it('detects PowerPoint presentations by file name and MIME type', () => {
    expect(getDocumentFileType('slides.pptx')).toBe('ppt');
    expect(getDocumentFileType('deck.ppt')).toBe('ppt');
    expect(getDocumentFileType(undefined, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('ppt');
    expect(getDocumentFileType(undefined, 'application/vnd.ms-powerpoint')).toBe('ppt');
  });

  it('detects image files', () => {
    expect(getDocumentFileType('photo.png')).toBe('image');
    expect(getDocumentFileType(undefined, 'image/jpeg')).toBe('image');
    expect(getDocumentFileType('image.svg')).toBe('image');
  });

  it('detects archive files', () => {
    expect(getDocumentFileType('backup.zip')).toBe('archive');
    expect(getDocumentFileType('backup.tar.gz')).toBe('archive');
    expect(getDocumentFileType(undefined, 'application/zip')).toBe('archive');
  });

  it('detects text files', () => {
    expect(getDocumentFileType('notes.txt')).toBe('text');
    expect(getDocumentFileType('config.json')).toBe('text');
    expect(getDocumentFileType(undefined, 'text/plain')).toBe('text');
  });

  it('falls back to generic when type cannot be determined', () => {
    expect(getDocumentFileType('unknown.xyz')).toBe('generic');
    expect(getDocumentFileType(undefined, 'application/octet-stream')).toBe('generic');
    expect(getDocumentFileType()).toBe('generic');
  });
});
