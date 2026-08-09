import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../index';

describe('SearchInput Component', () => {
  it('should render with default placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('chat.search')).toBeInTheDocument();
  });

  it('should render with custom placeholder', () => {
    render(<SearchInput value="" onChange={vi.fn()} placeholder="Find messages..." />);
    expect(screen.getByPlaceholderText('Find messages...')).toBeInTheDocument();
  });

  it('should display the current value', () => {
    render(<SearchInput value="test query" onChange={vi.fn()} />);
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('should call onChange when input changes', () => {
    const mockOnChange = vi.fn();
    render(<SearchInput value="" onChange={mockOnChange} />);
    
    const input = screen.getByPlaceholderText('chat.search');
    fireEvent.change(input, { target: { value: 'hello' } });
    
    expect(mockOnChange).toHaveBeenCalledWith('hello');
  });

  it('should apply custom className to container', () => {
    const { container } = render(<SearchInput value="" onChange={vi.fn()} className="custom-search" />);
    expect(container.firstChild).toHaveClass('custom-search');
  });
});
