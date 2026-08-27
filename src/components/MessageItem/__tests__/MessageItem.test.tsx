import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageItem } from '../index';

// Message link previews are resolved lazily by a service; keep tests offline.
vi.mock('../../../hooks/useLinkPreview', () => ({
  useLinkPreview: vi.fn(() => null),
}));

// Isolate from the file-upload dependency chain pulled in by LargeImageCard.
vi.mock('../../../services/fileService', () => ({
  downloadFile: vi.fn(),
  uploadFile: vi.fn(),
  uploadFiles: vi.fn(),
}));
import styles from '../MessageItem.module.scss';
import type { ChatMessage } from '../../../types/message.types';

describe('MessageItem Component', () => {
  const baseMessage: ChatMessage = {
    id: 'm1',
    content: 'Hello World',
    type: 'text',
    sender: { id: 'u1', displayName: 'Alice' },
    createdAt: new Date('2023-01-01T10:00:00Z'),
    sequenceId: '1',
    conversationId: 'c1',
    status: 'delivered',
  };

  it('should render system message', () => {
    const sysMessage: ChatMessage = {
      ...baseMessage,
      type: 'system',
      systemEvent: {
        type: 'topicUpdated',
        initiator: { id: 'u1', displayName: 'chat.system' },
        newTopic: 'General',
      },
    };
    render(<MessageItem message={sysMessage} isOwn={false} />);
    expect(
      screen.getByText('<b>chat.system</b> changed topic to <b>"General"</b>')
    ).toBeInTheDocument();
  });

  it('should render own message correctly', () => {
    render(<MessageItem message={baseMessage} isOwn={true} />);

    // Content check
    expect(screen.getByText('Hello World')).toBeInTheDocument();

    // Status should be visible for own messages
    expect(screen.getByText('delivered')).toBeInTheDocument();

    // Avatar should not be visible
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  it('should render other message correctly with sender avatar and name if showSender is true', () => {
    render(<MessageItem message={baseMessage} isOwn={false} showSender={true} />);

    // Avatar fallback 'A' for Alice
    expect(screen.getByText('A')).toBeInTheDocument();

    // Sender name check
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render HTML message securely', () => {
    const htmlMessage: ChatMessage = {
      ...baseMessage,
      type: 'html',
      content: '<strong>Bold Text</strong>',
    };
    const { container } = render(<MessageItem message={htmlMessage} isOwn={true} />);
    expect(container.querySelector('strong')).toBeInTheDocument();
    expect(screen.getByText('Bold Text')).toBeInTheDocument();
  });

  it('should show (edited) if message was edited', () => {
    const editedMessage: ChatMessage = {
      ...baseMessage,
      editedAt: new Date('2023-01-01T10:05:00Z'),
    };
    render(<MessageItem message={editedMessage} isOwn={true} />);
    expect(screen.getByText('chat.edited')).toBeInTheDocument();
  });

  it('should handle dropdown actions', () => {
    const onReply = vi.fn();
    const onCopy = vi.fn();

    render(<MessageItem message={baseMessage} isOwn={true} onReply={onReply} onCopy={onCopy} />);

    // Directly visible actions
    const replyBtn = screen.getByTitle('chat.reply');
    fireEvent.click(replyBtn);
    expect(onReply).toHaveBeenCalledWith('m1');

    // Open dropdown
    const moreBtn = screen.getByTitle('chat.moreOptions');
    fireEvent.click(moreBtn);

    // Click dropdown item
    const copyBtn = screen.getByText('chat.copyText');
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);
    expect(onCopy).toHaveBeenCalledWith('m1');

    // Dropdown should be closed now (checking if copyBtn is removed)
    expect(screen.queryByText('chat.copyText')).not.toBeInTheDocument();
  });

  it('should close dropdown when clicking outside or scrolling', () => {
    render(<MessageItem message={baseMessage} isOwn={true} />);

    const moreBtn = screen.getByTitle('chat.moreOptions');
    fireEvent.click(moreBtn);
    expect(screen.getByText('chat.copyText')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('chat.copyText')).not.toBeInTheDocument();

    // Open again and scroll
    fireEvent.click(moreBtn);
    expect(screen.getByText('chat.copyText')).toBeInTheDocument();
    fireEvent.scroll(window);
    expect(screen.queryByText('chat.copyText')).not.toBeInTheDocument();
  });

  it('should trigger pin, recall, and delete from dropdown', () => {
    const onPin = vi.fn();
    const onRecall = vi.fn();
    const onDelete = vi.fn();

    const { rerender } = render(
      <MessageItem
        message={baseMessage}
        isOwn={true}
        isPinned={false}
        onPin={onPin}
        onRecall={onRecall}
        onDelete={onDelete}
      />
    );

    const moreBtn = screen.getByTitle('chat.moreOptions');
    fireEvent.click(moreBtn);

    const pinBtn = screen.getByText('chat.pinMessage');
    fireEvent.click(pinBtn);
    expect(onPin).toHaveBeenCalledWith('m1', true);

    // Rerender as pinned
    rerender(
      <MessageItem
        message={baseMessage}
        isOwn={true}
        isPinned={true}
        onPin={onPin}
        onRecall={onRecall}
        onDelete={onDelete}
      />
    );
    fireEvent.click(moreBtn);
    const unpinBtn = screen.getByText('chat.unpinMessage');
    fireEvent.click(unpinBtn);
    expect(onPin).toHaveBeenCalledWith('m1', false);

    // Recall
    fireEvent.click(moreBtn);
    const recallBtn = screen.getByText('chat.recall');
    fireEvent.click(recallBtn);
    expect(onRecall).toHaveBeenCalledWith('m1');

    // Delete
    fireEvent.click(moreBtn);
    const deleteBtn = screen.getByText('chat.deleteMessage');
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith('m1');
  });

  it('should allow custom renderers', () => {
    render(
      <MessageItem
        message={baseMessage}
        isOwn={true}
        renderContent={(msg) => <div data-testid="custom-content">{msg.content}</div>}
        renderStatus={(status) => <div data-testid="custom-status">{status}</div>}
        renderActions={() => <div data-testid="custom-actions">Actions</div>}
      />
    );

    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    expect(screen.getByTestId('custom-status')).toBeInTheDocument();
    expect(screen.getByTestId('custom-actions')).toBeInTheDocument();
  });

  it('should render single image message', () => {
    const singleImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        url: 'https://example.com/single.png',
        fileName: 'single.png',
        width: 800,
        height: 600,
      },
    };
    render(<MessageItem message={singleImageMsg} isOwn={true} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/single.png');
    expect(img).toHaveAttribute('alt', 'single.png');
  });

  it('should render multiple images in a grid when metadata.files is provided', () => {
    const multiImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        files: [
          { url: 'https://example.com/img1.png', fileName: 'img1.png', width: 400, height: 300 },
          { url: 'https://example.com/img2.png', fileName: 'img2.png', width: 400, height: 300 },
          { url: 'https://example.com/img3.png', fileName: 'img3.png', width: 400, height: 300 },
        ],
      },
    };
    const { container } = render(<MessageItem message={multiImageMsg} isOwn={true} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(3);
    expect(imgs[0]).toHaveAttribute('src', 'https://example.com/img1.png');
    expect(imgs[1]).toHaveAttribute('src', 'https://example.com/img2.png');
    expect(imgs[2]).toHaveAttribute('src', 'https://example.com/img3.png');

    const grid = container.querySelector(`.${styles.imageGrid}`) as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });
  });

  it('should render 4 images in a single row with 4 columns', () => {
    const fourImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        files: [
          { url: 'https://example.com/img1.png' },
          { url: 'https://example.com/img2.png' },
          { url: 'https://example.com/img3.png' },
          { url: 'https://example.com/img4.png' },
        ],
      },
    };
    const { container } = render(<MessageItem message={fourImageMsg} isOwn={true} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(4);

    const grid = container.querySelector(`.${styles.imageGrid}`) as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(4, 1fr)' });
  });

  it('should render 5 images with 3-column template (3 top, 2 bottom with 1:2 ratio)', () => {
    const fiveImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        files: [
          { url: 'https://example.com/img1.png' },
          { url: 'https://example.com/img2.png' },
          { url: 'https://example.com/img3.png' },
          { url: 'https://example.com/img4.png' },
          { url: 'https://example.com/img5.png' },
        ],
      },
    };
    const { container } = render(<MessageItem message={fiveImageMsg} isOwn={true} />);
    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(5);

    const grid = container.querySelector(`.${styles.imageGrid}`) as HTMLElement;
    expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(3, 1fr)' });

    const items = container.querySelectorAll(`.${styles.imageGridItem}`);
    expect(items[0]).toHaveStyle({ gridColumn: 'span 1' });
    expect(items[1]).toHaveStyle({ gridColumn: 'span 1' });
    expect(items[2]).toHaveStyle({ gridColumn: 'span 1' });
    expect(items[3]).toHaveStyle({ gridColumn: 'span 1' });
    expect(items[4]).toHaveStyle({ gridColumn: 'span 2' });
  });

  it('should not render time and status when isLastInGroup is false for image messages', () => {
    const singleImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        url: 'https://example.com/single.png',
      },
    };
    render(<MessageItem message={singleImageMsg} isOwn={true} isLastInGroup={false} />);
    expect(screen.queryByText('delivered')).not.toBeInTheDocument();
  });

  it('should render time and status when isLastInGroup is true for image messages', () => {
    const singleImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        url: 'https://example.com/single.png',
      },
    };
    render(<MessageItem message={singleImageMsg} isOwn={true} isLastInGroup={true} />);
    expect(screen.getByText('delivered')).toBeInTheDocument();
  });

  it('should render large image message as a File Attachment Card', () => {
    const onDownloadAttachment = vi.fn();
    const onOpenAttachment = vi.fn();

    const largeImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        url: 'https://example.com/100-mb-example-jpg.jpg',
        fileName: '100-mb-example-jpg.jpg',
        size: 100.36 * 1024 * 1024,
      },
    };

    render(
      <MessageItem
        message={largeImageMsg}
        isOwn={true}
        onDownloadAttachment={onDownloadAttachment}
        onOpenAttachment={onOpenAttachment}
      />
    );

    // Should NOT render regular img
    expect(screen.queryByRole('img')).not.toBeInTheDocument();

    // Should render filename
    expect(screen.getByText('100-mb-example-jpg.jpg')).toBeInTheDocument();

    // Should render formatted size
    expect(screen.getByText('100.36 MB')).toBeInTheDocument();

    // Should render action buttons
    const downloadBtn = screen.getByTitle('chat.download');
    expect(downloadBtn).toBeInTheDocument();

    // Test actions
    fireEvent.click(downloadBtn);
    expect(onDownloadAttachment).toHaveBeenCalledWith(
      'https://example.com/100-mb-example-jpg.jpg',
      '100-mb-example-jpg.jpg'
    );

    // Large image card should not trigger preview on click
    const card = screen.getByTestId('file-card');
    fireEvent.click(card);
    expect(onOpenAttachment).not.toHaveBeenCalled();
  });

  it('should render large image message when metadata.isLarge is true even without size', () => {
    const largeImageMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'image',
        url: 'https://example.com/huge.png',
        fileName: 'huge.png',
        isLarge: 'true',
      },
    };

    render(<MessageItem message={largeImageMsg} isOwn={true} />);

    expect(screen.getByText('huge.png')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should render general file message as a Card and trigger download', () => {
    const onDownloadAttachment = vi.fn();

    const fileMsg: ChatMessage = {
      ...baseMessage,
      metadata: {
        type: 'file',
        url: 'https://example.com/document.docx',
        fileName: 'document.docx',
        size: 1024 * 50,
      },
    };

    render(
      <MessageItem message={fileMsg} isOwn={true} onDownloadAttachment={onDownloadAttachment} />
    );

    expect(screen.getByText('document.docx')).toBeInTheDocument();
    expect(screen.getByText('50.00 KB')).toBeInTheDocument();

    const downloadBtn = screen.getByTitle('chat.download');
    fireEvent.click(downloadBtn);
    expect(onDownloadAttachment).toHaveBeenCalledWith(
      'https://example.com/document.docx',
      'document.docx'
    );
  });

  it('should render message attachments array as Cards', () => {
    const onDownloadAttachment = vi.fn();

    const msgWithAttachments: ChatMessage = {
      ...baseMessage,
      attachments: [
        {
          id: 'att-1',
          name: 'specs.pdf',
          size: 2048,
          mimeType: 'application/pdf',
          url: 'https://example.com/specs.pdf',
        },
      ],
    };

    render(
      <MessageItem
        message={msgWithAttachments}
        isOwn={false}
        onDownloadAttachment={onDownloadAttachment}
      />
    );

    expect(screen.getByText('specs.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.00 KB')).toBeInTheDocument();

    const downloadBtn = screen.getByTitle('chat.download');
    fireEvent.click(downloadBtn);
    expect(onDownloadAttachment).toHaveBeenCalledWith('https://example.com/specs.pdf', 'specs.pdf');
  });

  describe('message links and link previews', () => {
    it('renders clickable links for text messages containing urls', () => {
      const msgWithLink: ChatMessage = {
        ...baseMessage,
        content: 'Check this out: https://example.com/page',
      };
      const { container } = render(<MessageItem message={msgWithLink} isOwn={true} />);

      const anchor = container.querySelector('a[href="https://example.com/page"]');
      expect(anchor).toBeInTheDocument();
      expect(anchor).toHaveAttribute('target', '_blank');
      expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
      expect(anchor?.textContent).toBe('https://example.com/page');
    });

    it('escapes html in plain text messages', () => {
      const xssMessage: ChatMessage = {
        ...baseMessage,
        content: '<img src=x onerror=alert(1)> https://example.com',
      };
      const { container } = render(<MessageItem message={xssMessage} isOwn={true} />);
      expect(container.querySelector('img')).not.toBeInTheDocument();
    });

    it('renders a preview card from linkPreview metadata', () => {
      const msgWithPreview: ChatMessage = {
        ...baseMessage,
        content: 'https://example.com/article',
        metadata: {
          linkPreview: JSON.stringify({
            url: 'https://example.com/article',
            title: 'Article Title',
            description: 'Article description',
            siteName: 'Example',
          }),
        },
      };
      render(<MessageItem message={msgWithPreview} isOwn={false} />);

      expect(screen.getByTestId('link-preview-card')).toBeInTheDocument();
      expect(screen.getByText('Article Title')).toBeInTheDocument();
    });

    it('accepts linkPreview metadata as an object', () => {
      const msgWithPreview: ChatMessage = {
        ...baseMessage,
        content: 'https://example.com/article',
        metadata: {
          linkPreview: { url: 'https://example.com/article', title: 'Object Title' } as never,
        },
      };
      render(<MessageItem message={msgWithPreview} isOwn={false} />);
      expect(screen.getByText('Object Title')).toBeInTheDocument();
    });

    it('does not render a preview card for deleted messages', () => {
      const deletedWithPreview: ChatMessage = {
        ...baseMessage,
        content: 'https://example.com/article',
        deletedAt: new Date('2023-01-01T11:00:00Z'),
        metadata: {
          linkPreview: JSON.stringify({ url: 'https://example.com/article', title: 'Hidden' }),
        },
      };
      render(<MessageItem message={deletedWithPreview} isOwn={false} />);
      expect(screen.queryByTestId('link-preview-card')).not.toBeInTheDocument();
    });
  });

  describe('Video Messages', () => {
    it('renders VideoCard for video message with metadata type video', () => {
      const videoMessage: ChatMessage = {
        ...baseMessage,
        content: '',
        metadata: {
          type: 'video',
          url: 'https://example.com/trip.mp4',
          fileName: 'trip.mp4',
          mimeType: 'video/mp4',
          size: 5242880,
        },
      };

      render(<MessageItem message={videoMessage} isOwn={true} />);

      expect(screen.getByTestId('video-card')).toBeInTheDocument();
      expect(screen.getByTestId('video-player')).toHaveAttribute(
        'src',
        'https://example.com/trip.mp4'
      );
      expect(screen.getByText('trip.mp4')).toBeInTheDocument();
      expect(screen.getByText('5.00 MB')).toBeInTheDocument();
      // Should not render link preview
      expect(screen.queryByTestId('link-preview-card')).not.toBeInTheDocument();
    });

    it('renders VideoCard for mov video message by extension', () => {
      const movMessage: ChatMessage = {
        ...baseMessage,
        content: '',
        metadata: {
          url: 'https://example.com/video.mov',
          fileName: 'video.mov',
          mimeType: 'video/quicktime',
          size: 1048576,
        },
      };

      render(<MessageItem message={movMessage} isOwn={false} />);

      expect(screen.getByTestId('video-card')).toBeInTheDocument();
      expect(screen.getByText('video.mov')).toBeInTheDocument();
      expect(screen.getByText('1.00 MB')).toBeInTheDocument();
    });

    it('renders VideoCard for attachments with video type', () => {
      const msgWithAttachment: ChatMessage = {
        ...baseMessage,
        attachments: [
          {
            id: 'att-1',
            name: 'holiday.mp4',
            url: 'https://example.com/holiday.mp4',
            mimeType: 'video/mp4',
            size: 2048000,
          },
        ],
      };

      render(<MessageItem message={msgWithAttachment} isOwn={false} />);

      expect(screen.getByTestId('video-card')).toBeInTheDocument();
      expect(screen.getByText('holiday.mp4')).toBeInTheDocument();
    });
  });

  describe('Image MIME type inference', () => {
    it('passes inferred mimeType for png and webp images to onOpenAttachment', () => {
      const onOpenAttachment = vi.fn();
      const pngMessage: ChatMessage = {
        ...baseMessage,
        metadata: {
          type: 'image',
          url: 'https://example.com/screenshot.png',
          fileName: 'screenshot.png',
          size: 2048,
        },
      };

      render(
        <MessageItem
          message={pngMessage}
          isOwn={false}
          onOpenAttachment={onOpenAttachment}
        />
      );

      const img = screen.getByRole('img');
      fireEvent.click(img);

      expect(onOpenAttachment).toHaveBeenCalledWith(
        'https://example.com/screenshot.png',
        'screenshot.png',
        expect.objectContaining({
          mimeType: 'image/png',
          fileName: 'screenshot.png',
          url: 'https://example.com/screenshot.png',
        })
      );
    });

    it('passes explicit mimeType when available in image files array', () => {
      const onOpenAttachment = vi.fn();
      const multiImageMessage: ChatMessage = {
        ...baseMessage,
        metadata: {
          type: 'image',
          files: JSON.stringify([
            {
              url: 'https://example.com/image1.webp',
              fileName: 'image1.webp',
              mimeType: 'image/webp',
              size: 5000,
            },
            {
              url: 'https://example.com/image2.gif',
              fileName: 'image2.gif',
              mimeType: 'image/gif',
              size: 8000,
            },
          ]),
        },
      };

      render(
        <MessageItem
          message={multiImageMessage}
          isOwn={false}
          onOpenAttachment={onOpenAttachment}
        />
      );

      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(2);

      fireEvent.click(images[0]);
      expect(onOpenAttachment).toHaveBeenCalledWith(
        'https://example.com/image1.webp',
        'image1.webp',
        expect.objectContaining({
          mimeType: 'image/webp',
        })
      );

      fireEvent.click(images[1]);
      expect(onOpenAttachment).toHaveBeenCalledWith(
        'https://example.com/image2.gif',
        'image2.gif',
        expect.objectContaining({
          mimeType: 'image/gif',
        })
      );
    });
  });
});

