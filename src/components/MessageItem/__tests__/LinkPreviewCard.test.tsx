import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LinkPreviewCard } from '../LinkPreviewCard';
import type { LinkPreview } from '../../../types/message.types';

const fullPreview: LinkPreview = {
  url: 'https://example.com/article',
  title: 'Article Title',
  description: 'Article description',
  imageUrl: 'https://example.com/image.png',
  siteName: 'Example',
  favicon: 'https://example.com/favicon.ico',
};

describe('LinkPreviewCard', () => {
  it('renders title, description, image and site name', async () => {
    const { container } = render(<LinkPreviewCard preview={fullPreview} />);

    expect(await screen.findByText('Article description')).toBeInTheDocument();
    expect(screen.getByText('Article Title')).toBeInTheDocument();
    expect(screen.getByText(/Example/)).toBeInTheDocument();

    const imageContainer = container.querySelector('[data-testid="image-container"]');
    expect(imageContainer).toBeInTheDocument();
    expect(imageContainer?.getAttribute('style')).toContain('https://example.com/image.png');
  });

  it('falls back to the domain when no title/siteName is provided', async () => {
    render(<LinkPreviewCard preview={{ url: 'https://bare.example.com/path' }} />);
    await waitFor(() => {
      expect(screen.getAllByText(/bare\.example\.com/).length).toBeGreaterThan(0);
    });
  });

  it('renders compact mode with thumbnail, title, description and domain', () => {
    const { container } = render(<LinkPreviewCard preview={fullPreview} compact />);

    expect(screen.getByText('Article Title')).toBeInTheDocument();
    expect(screen.getByText('Article description')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();

    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();
    expect(image?.getAttribute('src')).toBe('https://example.com/image.png');
  });

  it('hides the thumbnail in compact mode when image fails to load', () => {
    const { container } = render(<LinkPreviewCard preview={fullPreview} compact />);
    const image = container.querySelector('img');
    expect(image).toBeInTheDocument();

    fireEvent.error(image as HTMLElement);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders anchor with target="_blank" and rel="noopener noreferrer" by default in compact mode', () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    render(<LinkPreviewCard preview={fullPreview} compact />);
    const card = screen.getByTestId('link-preview-card');

    expect(card.tagName).toBe('A');
    expect(card).toHaveAttribute('href', 'https://example.com/article');
    expect(card).toHaveAttribute('target', '_blank');
    expect(card).toHaveAttribute('rel', 'noopener noreferrer');
    // Ensure window.open is not called to prevent double navigation
    fireEvent.click(card);
    expect(openSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('invokes the custom onClick handler instead of opening the url in full mode', async () => {
    const onClick = vi.fn();
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    render(<LinkPreviewCard preview={fullPreview} onClick={onClick} />);
    await screen.findByText('Article description');

    fireEvent.click(screen.getByTestId('link-preview-card'));

    expect(onClick).toHaveBeenCalledWith('https://example.com/article');
    expect(openSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('invokes the custom onClick handler in compact mode', () => {
    const onClick = vi.fn();

    render(<LinkPreviewCard preview={fullPreview} onClick={onClick} compact />);
    fireEvent.click(screen.getByTestId('link-preview-card'));

    expect(onClick).toHaveBeenCalledWith('https://example.com/article');
  });
});
