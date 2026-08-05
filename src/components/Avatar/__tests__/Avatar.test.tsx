import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../index';

describe('Avatar Component', () => {
  it('should render fallback initial when no url is provided', () => {
    render(<Avatar name="John Doe" />);
    
    // Check if the fallback initial is rendered (J from John Doe)
    expect(screen.getByText('J')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('should render image when url is provided', () => {
    const imageUrl = 'https://example.com/avatar.jpg';
    render(<Avatar name="John Doe" url={imageUrl} />);
    
    const imgElement = screen.getByRole('img');
    expect(imgElement).toBeInTheDocument();
    expect(imgElement).toHaveAttribute('src', imageUrl);
    expect(imgElement).toHaveAttribute('alt', 'John Doe');
    expect(screen.queryByText('J')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Avatar name="Test User" className="custom-class" />);
    
    // The wrapper should have the custom class
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
