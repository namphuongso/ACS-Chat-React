import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MessageIcon, InfoIcon, AlertIcon, SendIcon } from '../index';

describe('Icons Components', () => {
  it('should render MessageIcon', () => {
    const { container } = render(<MessageIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render InfoIcon with custom props', () => {
    const { container } = render(<InfoIcon width={24} height={24} className="test-icon" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
    expect(svg).toHaveClass('test-icon');
  });

  it('should render AlertIcon', () => {
    const { container } = render(<AlertIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('should render SendIcon', () => {
    const { container } = render(<SendIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
