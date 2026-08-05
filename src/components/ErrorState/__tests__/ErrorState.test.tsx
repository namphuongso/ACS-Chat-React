import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '../index';
import type { ChatError } from '../../../types/errors.types';

describe('ErrorState Component', () => {
  const mockError: ChatError = {
    message: 'Something went wrong',
    code: 'UNKNOWN_ERROR',
    retryable: false,
    timestamp: new Date()
  };

  it('should render error message', () => {
    render(<ErrorState error={mockError} />);
    expect(screen.getByText('Đã xảy ra lỗi')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should not render retry button if error is not retryable', () => {
    render(<ErrorState error={mockError} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('should render retry button and handle click if error is retryable and onRetry provided', () => {
    const retryableError = { ...mockError, retryable: true };
    const mockOnRetry = vi.fn();
    
    render(<ErrorState error={retryableError} onRetry={mockOnRetry} />);
    
    const retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryBtn).toBeInTheDocument();
    
    fireEvent.click(retryBtn);
    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('should not render retry button if onRetry is not provided even if error is retryable', () => {
    const retryableError = { ...mockError, retryable: true };
    render(<ErrorState error={retryableError} />);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<ErrorState error={mockError} className="custom-error" />);
    expect(container.firstChild).toHaveClass('custom-error');
  });
});
