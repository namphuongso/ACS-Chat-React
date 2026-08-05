import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TypingIndicator } from '../index';

describe('TypingIndicator Component', () => {
  it('should return null if no typing users', () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render correctly for 1 typing user', () => {
    render(
      <TypingIndicator 
        typingUsers={[{ user: { id: 'u1', displayName: 'Alice' }, startedAt: new Date() }]} 
      />
    );
    expect(screen.getByText('Alice is typing')).toBeInTheDocument();
  });

  it('should render correctly for 2 typing users', () => {
    render(
      <TypingIndicator 
        typingUsers={[
          { user: { id: 'u1', displayName: 'Alice' }, startedAt: new Date() },
          { user: { id: 'u2', displayName: 'Bob' }, startedAt: new Date() }
        ]} 
      />
    );
    expect(screen.getByText('Alice and Bob are typing')).toBeInTheDocument();
  });

  it('should render correctly for more than 2 typing users', () => {
    render(
      <TypingIndicator 
        typingUsers={[
          { user: { id: 'u1', displayName: 'Alice' }, startedAt: new Date() },
          { user: { id: 'u2', displayName: 'Bob' }, startedAt: new Date() },
          { user: { id: 'u3', displayName: 'Charlie' }, startedAt: new Date() }
        ]} 
      />
    );
    expect(screen.getByText('Alice, Bob and 1 others are typing')).toBeInTheDocument();
  });

  it('should render "Someone" if displayName is missing', () => {
    render(
      <TypingIndicator 
        typingUsers={[{ user: { id: 'u1' }, startedAt: new Date() }]} 
      />
    );
    expect(screen.getByText('Someone is typing')).toBeInTheDocument();
  });

  it('should use custom renderText when provided', () => {
    const customRender = (users: unknown[]) => <span data-testid="custom-typing">{users.length} writing</span>;
    render(
      <TypingIndicator 
        typingUsers={[{ user: { id: 'u1', displayName: 'Alice' }, startedAt: new Date() }]} 
        renderText={customRender}
      />
    );
    expect(screen.getByTestId('custom-typing')).toHaveTextContent('1 writing');
    expect(screen.queryByText('Alice is typing')).not.toBeInTheDocument();
  });
});
