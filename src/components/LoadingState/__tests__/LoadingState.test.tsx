import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingState } from '../index';

describe('LoadingState Component', () => {
  it('should render default loading message', () => {
    render(<LoadingState />);
    expect(screen.getByText('chat.loading')).toBeInTheDocument();
  });

  it('should render custom loading message', () => {
    render(<LoadingState message="Vui lòng chờ..." />);
    expect(screen.getByText('Vui lòng chờ...')).toBeInTheDocument();
    expect(screen.queryByText('chat.loading')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingState className="custom-loading" />);
    expect(container.firstChild).toHaveClass('custom-loading');
  });

  it('should render spinner element', () => {
    const { container } = render(<LoadingState />);
    // Checking for the spinner class, assuming it's applied correctly 
    // Testing the existence of the wrapper node child which represents the spinner
    expect(container.querySelector('[class*="spinner"]')).toBeInTheDocument();
  });
});
