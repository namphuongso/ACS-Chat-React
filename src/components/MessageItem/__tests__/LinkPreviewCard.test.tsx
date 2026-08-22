import { fireEvent, render, screen } from '@testing-library/react';
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
  it('renders title, description, image and site name', () => {
    const { container } = render(<LinkPreviewCard preview={fullPreview} />);

    expect(screen.getByText('Article Title')).toBeInTheDocument();
    expect(screen.getByText('Article description')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();

    const images = container.querySelectorAll('img');
    const sources = Array.from(images).map((img) => img.getAttribute('src'));
    expect(sources).toContain('https://example.com/image.png');
    expect(sources).toContain('https://example.com/favicon.ico');
  });

  it('falls back to the domain when no title/siteName is provided', () => {
    render(<LinkPreviewCard preview={{ url: 'https://bare.example.com/path' }} />);
    expect(screen.getAllByText('bare.example.com').length).toBeGreaterThan(0);
  });

  it('hides the preview image when it fails to load', () => {
    const { container } = render(<LinkPreviewCard preview={fullPreview} />);
    const mainImage = Array.from(container.querySelectorAll('img')).find(
      (img) => img.getAttribute('src') === 'https://example.com/image.png'
    );
    expect(mainImage).toBeDefined();

    fireEvent.error(mainImage as HTMLElement);
    const sources = Array.from(container.querySelectorAll('img')).map((img) =>
      img.getAttribute('src')
    );
    expect(sources).not.toContain('https://example.com/image.png');
  });

  it('opens the url in a new tab on click by default', () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    render(<LinkPreviewCard preview={fullPreview} />);
    fireEvent.click(screen.getByTestId('link-preview-card'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/article',
      '_blank',
      'noopener,noreferrer'
    );
    vi.unstubAllGlobals();
  });

  it('invokes the custom onClick handler instead of opening the url', () => {
    const onClick = vi.fn();
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    render(<LinkPreviewCard preview={fullPreview} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('link-preview-card'));

    expect(onClick).toHaveBeenCalledWith('https://example.com/article');
    expect(openSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('omits the description in compact mode', () => {
    render(<LinkPreviewCard preview={fullPreview} compact />);
    expect(screen.queryByText('Article description')).not.toBeInTheDocument();
    expect(screen.getByText('Article Title')).toBeInTheDocument();
  });
});
