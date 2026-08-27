import { describe, expect, it } from 'vitest';
import { classifyPinnedMessage } from '../pinnedUtils';
import type { PinnedMessage, ChatMessage } from '../../types/message.types';

function createMockPinned(overrides: Partial<PinnedMessage> = {}): PinnedMessage {
  return {
    messageId: 'msg-1',
    type: 'text',
    content: '',
    creator: 'Test User',
    createdDate: '2026-08-27T00:00:00Z',
    attachmentType: '',
    attachmentUrl: '',
    thumbUrl: '',
    ...overrides,
  };
}

describe('pinnedUtils - classifyPinnedMessage', () => {
  it('classifies video messages by type, mimeType, and extension', () => {
    const byType = createMockPinned({
      messageId: '1',
      type: 'video',
      content: 'demo.mp4',
    });
    expect(classifyPinnedMessage(byType).category).toBe('video');

    const byMime = createMockPinned({
      messageId: '2',
      type: 'file',
      attachmentType: 'video/quicktime',
      attachmentUrl: 'https://example.com/clip.mov',
    });
    expect(classifyPinnedMessage(byMime).category).toBe('video');

    const byExt = createMockPinned({
      messageId: '3',
      content: 'my_video.mkv',
    });
    expect(classifyPinnedMessage(byExt).category).toBe('video');
  });

  it('classifies large image messages', () => {
    const largeMsg = createMockPinned({
      messageId: '4',
      type: 'large_image',
      content: 'poster.png',
      attachmentType: 'image/png',
    });
    const res = classifyPinnedMessage(largeMsg);
    expect(res.category).toBe('large_image');
    expect(res.fileName).toBe('poster.png');
  });

  it('classifies album messages', () => {
    const albumMsg = createMockPinned({
      messageId: '5',
      type: 'album',
    });
    expect(classifyPinnedMessage(albumMsg).category).toBe('album');
  });

  it('classifies normal image (photo) messages', () => {
    const imgMsg = createMockPinned({
      messageId: '6',
      type: 'image',
      attachmentUrl: 'https://example.com/photo.jpg',
      thumbUrl: 'https://example.com/photo_thumb.jpg',
    });
    const res = classifyPinnedMessage(imgMsg);
    expect(res.category).toBe('image');
    expect(res.thumbUrl).toBe('https://example.com/photo_thumb.jpg');
  });

  it('classifies document types (excel, ppt, doc, pdf)', () => {
    const excelMsg = createMockPinned({
      messageId: '7',
      content: 'data.xlsx',
    });
    expect(classifyPinnedMessage(excelMsg).category).toBe('excel');

    const pptMsg = createMockPinned({
      messageId: '8',
      content: 'slides.pptx',
    });
    expect(classifyPinnedMessage(pptMsg).category).toBe('ppt');

    const docMsg = createMockPinned({
      messageId: '9',
      content: 'notes.docx',
    });
    expect(classifyPinnedMessage(docMsg).category).toBe('doc');

    const pdfMsg = createMockPinned({
      messageId: '10',
      content: 'manual.pdf',
    });
    expect(classifyPinnedMessage(pdfMsg).category).toBe('pdf');
  });

  it('classifies links accurately before generic fallback', () => {
    const linkMsg = createMockPinned({
      messageId: '11',
      content: 'Here is the link: https://example.com/pricing',
    });
    const res = classifyPinnedMessage(linkMsg);
    expect(res.category).toBe('link');
    expect(res.url).toBe('https://example.com/pricing');
  });

  it('classifies generic files', () => {
    const zipMsg = createMockPinned({
      messageId: '12',
      type: 'file',
      content: 'archive.zip',
      attachmentUrl: 'https://example.com/archive.zip',
    });
    expect(classifyPinnedMessage(zipMsg).category).toBe('file');
  });

  it('classifies plain text messages', () => {
    const textMsg = createMockPinned({
      messageId: '13',
      type: 'text',
      content: 'Hello World',
    });
    const res = classifyPinnedMessage(textMsg);
    expect(res.category).toBe('text');
    expect(res.content).toBe('Hello World');
  });

  it('extracts metadata from messagesByConversationMap when messageId is present', () => {
    const pinned = createMockPinned({
      messageId: 'msg-store-1',
      type: '',
      content: '',
    });

    const storeMock: Record<string, { messages: ChatMessage[] }> = {
      conv1: {
        messages: [
          {
            id: 'msg-store-1',
            clientMessageId: 'msg-store-1',
            conversationId: 'conv1',
            sender: { id: 'user1', displayName: 'Alice' },
            senderDisplayName: 'Alice',
            content: '',
            type: 'text',
            status: 'sent',
            createdAt: new Date(),
            metadata: {
              fileName: 'store_report.pdf',
              mimeType: 'application/pdf',
              url: 'https://example.com/store_report.pdf',
            },
          },
        ],
      },
    };

    const res = classifyPinnedMessage(pinned, storeMock);
    expect(res.category).toBe('pdf');
    expect(res.fileName).toBe('store_report.pdf');
    expect(res.url).toBe('https://example.com/store_report.pdf');
  });
});
