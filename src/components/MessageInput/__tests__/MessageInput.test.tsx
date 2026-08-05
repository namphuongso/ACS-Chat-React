import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MessageInput } from '../index';

describe('MessageInput Component', () => {
  it('should render correctly with default placeholder', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  });

  it('should call onTyping when typing in textarea', () => {
    const mockTyping = vi.fn();
    render(<MessageInput onSend={vi.fn()} onTyping={mockTyping} />);
    
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'a' } });
    
    expect(mockTyping).toHaveBeenCalledTimes(1);
  });

  it('should call onSend and clear input when send button is clicked', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'test message' } });
    
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendBtn);
    
    expect(mockSend).toHaveBeenCalledWith('test message');
    expect(textarea).toHaveValue('');
  });

  it('should not call onSend if input is empty or just whitespace', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendBtn);
    
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(sendBtn);
    
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should call onSend when Enter is pressed without Shift', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'enter text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    
    expect(mockSend).toHaveBeenCalledWith('enter text');
  });

  it('should not call onSend when Shift+Enter is pressed', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'shift enter text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should show character count if maxLength is provided', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} maxLength={100} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'abc' } });
    expect(screen.getByText('3/100')).toBeInTheDocument();
  });

  it('should disable input and send button when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} disabled={true} />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    
    expect(textarea).toBeDisabled();
    expect(sendBtn).toBeDisabled();
  });

  it('should render custom toolbar and send button if provided', () => {
    render(
      <MessageInput 
        onSend={vi.fn()} 
        onTyping={vi.fn()} 
        renderToolbar={() => <div data-testid="custom-toolbar">Toolbar</div>}
        renderSendButton={(props) => <button data-testid="custom-send" onClick={props.onClick} disabled={props.disabled}>Custom Send</button>}
      />
    );
    
    expect(screen.getByTestId('custom-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('custom-send')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument(); // Default send button should not exist
  });
});
