import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConnectionStatus } from '../index';
import type { ConnectionState } from '../../../types/chat.types';

describe('ConnectionStatus Component', () => {
  it('should render connecting state', () => {
    render(<ConnectionStatus state="connecting" />);
    expect(screen.getByText('Đang kết nối...')).toBeInTheDocument();
  });

  it('should render reconnecting state', () => {
    render(<ConnectionStatus state="reconnecting" />);
    expect(screen.getByText('Đang kết nối lại...')).toBeInTheDocument();
  });

  it('should render disconnected state', () => {
    render(<ConnectionStatus state="disconnected" />);
    expect(screen.getByText('Mất kết nối.')).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(<ConnectionStatus state="error" />);
    expect(screen.getByText('Lỗi kết nối.')).toBeInTheDocument();
  });

  it('should render nothing by default when connected', () => {
    const { container } = render(<ConnectionStatus state="connected" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render retry button and handle click for error/disconnected states', () => {
    const onRetryMock = vi.fn();
    const { rerender } = render(<ConnectionStatus state="error" onRetry={onRetryMock} />);
    
    let retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetryMock).toHaveBeenCalledTimes(1);

    // Test disconnected state as well
    rerender(<ConnectionStatus state="disconnected" onRetry={onRetryMock} />);
    retryBtn = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryBtn).toBeInTheDocument();
  });

  it('should not render retry button for connecting states', () => {
    render(<ConnectionStatus state="connecting" onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });

  it('should render custom banner if provided', () => {
    const customRender = (state: ConnectionState, _retry?: () => void) => (
      <div data-testid="custom-banner">{state}</div>
    );
    
    render(<ConnectionStatus state="reconnecting" renderBanner={customRender} />);
    expect(screen.getByTestId('custom-banner')).toBeInTheDocument();
    expect(screen.getByText('reconnecting')).toBeInTheDocument();
    expect(screen.queryByText('Đang kết nối lại...')).not.toBeInTheDocument();
  });
});
