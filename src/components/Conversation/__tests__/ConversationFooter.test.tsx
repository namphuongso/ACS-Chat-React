import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { ConversationFooter } from '../ConversationFooter';

vi.mock('../../../services/fileService', () => ({
  uploadFile: vi.fn().mockImplementation(async (file: File) => `https://blob.example.com/${file.name}`),
}));

describe('ConversationFooter Component', () => {
  beforeAll(() => {
    document.execCommand = vi.fn();
    document.queryCommandState = vi.fn().mockReturnValue(false);
    document.queryCommandValue = vi.fn().mockReturnValue('3');
    class MockImage {
      private _src = '';
      width = 800;
      height = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        if (val.includes('tall') || val.includes('large')) {
          this.width = 1080;
          this.height = 1920;
        } else {
          this.width = 800;
          this.height = 600;
        }
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((file: File) => `blob:http://localhost/${file?.name || 'test'}`),
      revokeObjectURL: vi.fn(),
    });
  });

  it('should not include type: html in onSend options when isFormatMode is not active', () => {
    const mockSend = vi.fn();
    const mockTyping = vi.fn();

    render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={mockTyping}
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'Hello plain text' } });

    const sendBtn = screen.getByRole('button', { name: 'chat.sendMessage' });
    fireEvent.click(sendBtn);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('Hello plain text', {});
  });

  it('should include type: html in onSend options when format button is activated', () => {
    const mockSend = vi.fn();
    const mockTyping = vi.fn();

    render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={mockTyping}
      />
    );

    // Find and click the format mode toolbar button
    const formatButtons = screen.getAllByRole('button');
    const formatBtn = formatButtons.find((btn) =>
      btn.getAttribute('aria-label')?.includes('chat.toolbar.format')
    );
    expect(formatBtn).toBeDefined();
    fireEvent.click(formatBtn!);

    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: '<b>Formatted text</b>' } });

    const sendBtn = screen.getByRole('button', { name: 'chat.sendMessage' });
    fireEvent.click(sendBtn);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('<b>Formatted text</b>', { type: 'html' });
  });

  it('should not include type: html after toggling format mode off', () => {
    const mockSend = vi.fn();
    const mockTyping = vi.fn();

    render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={mockTyping}
      />
    );

    const formatButtons = screen.getAllByRole('button');
    const formatBtn = formatButtons.find((btn) =>
      btn.getAttribute('aria-label')?.includes('chat.toolbar.format')
    );
    // Turn ON
    fireEvent.click(formatBtn!);
    // Turn OFF
    fireEvent.click(formatBtn!);

    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'Normal text again' } });

    const sendBtn = screen.getByRole('button', { name: 'chat.sendMessage' });
    fireEvent.click(sendBtn);

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('Normal text again', {});
  });

  it('should have correct accept attributes for image and attachment inputs', () => {
    const { container } = render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={vi.fn()}
        onTyping={vi.fn()}
      />
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    expect(fileInputs).toHaveLength(2);

    const [imageInput, attachmentInput] = Array.from(fileInputs);
    expect(imageInput.getAttribute('accept')).toBe('.jpg,.jpeg,.png');
    expect(attachmentInput.getAttribute('accept')).toBe(
      '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.mov'
    );
  });

  it('should upload all images and call onSend once with all files in metadata when multiple normal images selected', async () => {
    const mockSend = vi.fn();
    const { container } = render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={vi.fn()}
      />
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const imageInput = fileInputs[0];

    const file1 = new File(['img1'], 'photo1.png', { type: 'image/png' });
    const file2 = new File(['img2'], 'photo2.jpg', { type: 'image/jpeg' });

    Object.defineProperty(imageInput, 'files', {
      value: [file1, file2],
      writable: true,
      configurable: true,
    });
    fireEvent.change(imageInput);

    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    expect(mockSend).toHaveBeenCalledWith(
      '',
      expect.objectContaining({
        metadata: {
          type: 'image',
          files: [
            expect.objectContaining({ fileName: 'photo1.png', url: 'https://blob.example.com/photo1.png' }),
            expect.objectContaining({ fileName: 'photo2.jpg', url: 'https://blob.example.com/photo2.jpg' }),
          ],
        },
      })
    );
  });

  it('should split large images (e.g. 50MB) into separate messages and group normal images (1MB, 3MB) regardless of order', async () => {
    const mockSend = vi.fn();
    const { container } = render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={vi.fn()}
      />
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const imageInput = fileInputs[0];

    const normalFile1 = new File(['normal1'], 'photo1_1mb.png', { type: 'image/png' });
    Object.defineProperty(normalFile1, 'size', { value: 1 * 1024 * 1024 });

    const largeFile = new File(['large1'], 'photo3_50mb.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 });

    const normalFile2 = new File(['normal2'], 'photo2_3mb.png', { type: 'image/png' });
    Object.defineProperty(normalFile2, 'size', { value: 3 * 1024 * 1024 });

    Object.defineProperty(imageInput, 'files', {
      value: [normalFile1, largeFile, normalFile2],
      writable: true,
      configurable: true,
    });
    fireEvent.change(imageInput);

    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    // API 1: Normal files (1MB, 3MB) grouped together
    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      '',
      expect.objectContaining({
        metadata: {
          type: 'image',
          files: [
            expect.objectContaining({ fileName: 'photo1_1mb.png' }),
            expect.objectContaining({ fileName: 'photo2_3mb.png' }),
          ],
        },
      })
    );

    // API 2: Large file (50MB) sent as standalone message
    expect(mockSend).toHaveBeenNthCalledWith(
      2,
      '',
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'image',
          fileName: 'photo3_50mb.jpg',
          url: 'https://blob.example.com/photo3_50mb.jpg',
          size: 50 * 1024 * 1024,
        }),
      })
    );
  });

  it('should send separate messages when all selected images are large (>= 10MB)', async () => {
    const mockSend = vi.fn();
    const { container } = render(
      <ConversationFooter
        conversationId="conv-1"
        onSend={mockSend}
        onTyping={vi.fn()}
      />
    );

    const fileInputs = container.querySelectorAll('input[type="file"]');
    const imageInput = fileInputs[0];

    const largeFile1 = new File(['large1'], 'large1_50mb.jpg', { type: 'image/jpeg' });
    Object.defineProperty(largeFile1, 'size', { value: 50 * 1024 * 1024 });

    const largeFile2 = new File(['large2'], 'large2_80mb.png', { type: 'image/png' });
    Object.defineProperty(largeFile2, 'size', { value: 80 * 1024 * 1024 });

    Object.defineProperty(imageInput, 'files', {
      value: [largeFile1, largeFile2],
      writable: true,
      configurable: true,
    });
    fireEvent.change(imageInput);

    await vi.waitFor(() => {
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    expect(mockSend).toHaveBeenNthCalledWith(
      1,
      '',
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'image',
          fileName: 'large1_50mb.jpg',
          url: 'https://blob.example.com/large1_50mb.jpg',
        }),
      })
    );

    expect(mockSend).toHaveBeenNthCalledWith(
      2,
      '',
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: 'image',
          fileName: 'large2_80mb.png',
          url: 'https://blob.example.com/large2_80mb.png',
        }),
      })
    );
  });
});


