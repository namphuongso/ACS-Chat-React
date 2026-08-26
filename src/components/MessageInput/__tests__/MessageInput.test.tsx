import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { MessageInput } from '../index';
import { linkPreviewService } from '../../../services/linkPreviewService';

vi.mock('../../../services/linkPreviewService', () => ({
  linkPreviewService: {
    getCached: vi.fn(() => undefined),
    fetchLinkPreview: vi.fn(() => Promise.resolve({ url: 'https://example.com/' })),
    clearCache: vi.fn(),
  },
}));

const mockGetCached = vi.mocked(linkPreviewService.getCached);

describe('MessageInput Component', () => {
  beforeAll(() => {
    document.execCommand = vi.fn();
  });

  it('should render correctly with default placeholder', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText('chat.typeMessage')).toBeInTheDocument();
  });

  it('should render correctly with custom placeholder', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} placeholder="Type something special..." />);
    expect(screen.getByText('Type something special...')).toBeInTheDocument();
  });

  it('should hide placeholder when content is typed and show it when cleared', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} placeholder="Write a message..." />);
    expect(screen.getByText('Write a message...')).toBeInTheDocument();

    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'Hello' } });
    expect(screen.queryByText('Write a message...')).not.toBeInTheDocument();

    fireEvent.input(textarea, { target: { innerHTML: '' } });
    expect(screen.getByText('Write a message...')).toBeInTheDocument();
  });

  it('should call onTyping when typing in textarea', () => {
    const mockTyping = vi.fn();
    render(<MessageInput onSend={vi.fn()} onTyping={mockTyping} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'a' } });
    
    expect(mockTyping).toHaveBeenCalledTimes(1);
  });

  it('should call onSend and clear input when send button is clicked', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'test message' } });
    
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendBtn);
    
    expect(mockSend).toHaveBeenCalledWith('test message');
    expect(textarea).toHaveTextContent('');
  });

  it('should not call onSend if input is empty or just whitespace', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    fireEvent.click(sendBtn);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: '   ' } });
    fireEvent.click(sendBtn);
    
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should call onSend when Enter is pressed without Shift', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'enter text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    
    expect(mockSend).toHaveBeenCalledWith('enter text');
  });

  it('should not call onSend when Shift+Enter is pressed', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'shift enter text' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should show character count if maxLength is provided', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} maxLength={100} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'abc' } });
    expect(screen.getByText('3/100')).toBeInTheDocument();
  });

  it('should disable input and send button when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} disabled={true} />);
    const textarea = screen.getByRole('textbox');
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    
    expect(textarea).toHaveAttribute('contentEditable', 'false');
    expect(sendBtn).toBeDisabled();
  });

  it('should not call onSend when Enter is pressed during IME composition (isComposing or keyCode 229)', () => {
    const mockSend = vi.fn();
    render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.input(textarea, { target: { innerHTML: 'tiếng việt' } });

    // 1. isComposing: true
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, isComposing: true });
    expect(mockSend).not.toHaveBeenCalled();

    // 2. keyCode: 229
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, keyCode: 229 });
    expect(mockSend).not.toHaveBeenCalled();

    // 3. Composition events (compositionstart / compositionend)
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(mockSend).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith('tiếng việt');
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

  describe('link preview when sending', () => {
    it('attaches linkPreview metadata when the message contains a url', () => {
      const mockSend = vi.fn();
      render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.input(textarea, { target: { innerHTML: 'Check this https://example.com' } });

      const sendBtn = screen.getByRole('button', { name: 'Send message' });
      fireEvent.click(sendBtn);

      expect(mockSend).toHaveBeenCalledWith('Check this https://example.com', {
        metadata: { linkPreview: JSON.stringify({ url: 'https://example.com/' }) },
      });
    });

    it('uses the resolved compose preview when it matches the sent url', () => {
      mockGetCached.mockReturnValue({
        url: 'https://example.com/',
        title: 'Example',
      });

      const mockSend = vi.fn();
      render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.input(textarea, { target: { innerHTML: 'https://example.com' } });

      const sendBtn = screen.getByRole('button', { name: 'Send message' });
      fireEvent.click(sendBtn);

      expect(mockSend).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          metadata: {
            linkPreview: JSON.stringify({ url: 'https://example.com/', title: 'Example' }),
          },
        })
      );
      mockGetCached.mockReturnValue(undefined);
    });

    it('does not attach metadata when there is no url', () => {
      const mockSend = vi.fn();
      render(<MessageInput onSend={mockSend} onTyping={vi.fn()} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.input(textarea, { target: { innerHTML: 'plain message' } });
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

      expect(mockSend).toHaveBeenCalledWith('plain message');
    });

    it('shows a preview card in the compose area and allows dismissing it', () => {
      mockGetCached.mockReturnValue({
        url: 'https://example.com/',
        title: 'Example',
      });

      render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.input(textarea, { target: { innerHTML: 'look at https://example.com' } });

      expect(screen.getByTestId('link-preview-card')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('chat.close'));
      expect(screen.queryByTestId('link-preview-card')).not.toBeInTheDocument();
      mockGetCached.mockReturnValue(undefined);
    });

    it('does not show a preview card when enableLinkPreview is false', () => {
      mockGetCached.mockReturnValue({
        url: 'https://example.com/',
        title: 'Example',
      });

      render(<MessageInput onSend={vi.fn()} onTyping={vi.fn()} enableLinkPreview={false} />);

      const textarea = screen.getByRole('textbox');
      fireEvent.input(textarea, { target: { innerHTML: 'look at https://example.com' } });

      expect(screen.queryByTestId('link-preview-card')).not.toBeInTheDocument();
      mockGetCached.mockReturnValue(undefined);
    });
  });
});
