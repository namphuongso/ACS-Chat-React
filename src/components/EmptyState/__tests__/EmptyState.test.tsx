import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../index';

describe('EmptyState Component', () => {
  it('should render default message for no-conversations', () => {
    render(<EmptyState type="no-conversations" />);
    expect(screen.getByText('Không có cuộc hội thoại nào')).toBeInTheDocument();
  });

  it('should render default message for no-messages', () => {
    render(<EmptyState type="no-messages" />);
    expect(screen.getByText('Chưa có tin nhắn nào')).toBeInTheDocument();
  });

  it('should render default message for no-participants', () => {
    render(<EmptyState type="no-participants" />);
    expect(screen.getByText('Không có thành viên nào')).toBeInTheDocument();
  });

  it('should render custom message when provided', () => {
    const customMessage = 'Custom Empty Message';
    render(<EmptyState type="no-conversations" message={customMessage} />);
    expect(screen.getByText(customMessage)).toBeInTheDocument();
    expect(screen.queryByText('Không có cuộc hội thoại nào')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<EmptyState type="no-messages" className="custom-empty-class" />);
    expect(container.firstChild).toHaveClass('custom-empty-class');
  });
});
