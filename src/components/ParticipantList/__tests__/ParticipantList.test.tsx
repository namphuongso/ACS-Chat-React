import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantList } from '../index';
import type { ConversationParticipant } from '../../../types/participant.types';
import type { ParticipantItemProps } from '../ParticipantItem';

// Mock child to simplify testing
vi.mock('../ParticipantItem', () => ({
  ParticipantItem: ({ participant, onRemove, isCurrentUser }: ParticipantItemProps) => (
    <div data-testid="mock-participant-item">
      <span>{participant.displayName}</span>
      {isCurrentUser && <span data-testid="current-user-badge">You</span>}
      {onRemove && <button onClick={() => onRemove(participant.id)}>Remove</button>}
    </div>
  )
}));

describe('ParticipantList Component', () => {
  const mockParticipants: ConversationParticipant[] = [
    { id: 'u1', displayName: 'Alice', role: 'admin' },
    { id: 'u2', displayName: 'Bob' },
  ];

  it('should render the list of participants and correct count', () => {
    render(<ParticipantList participants={mockParticipants} currentUserId="u3" />);
    
    expect(screen.getByText('Listing members (2)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should pass isCurrentUser true for the current user', () => {
    render(<ParticipantList participants={mockParticipants} currentUserId="u1" />);
    
    // Alice is current user, so she gets the badge
    expect(screen.getByTestId('current-user-badge')).toBeInTheDocument();
  });

  it('should render Add members button if onAddParticipant is provided', () => {
    const mockAdd = vi.fn();
    render(<ParticipantList participants={mockParticipants} currentUserId="u3" onAddParticipant={mockAdd} />);
    
    const addBtn = screen.getByRole('button', { name: /Add members/i });
    expect(addBtn).toBeInTheDocument();
    
    fireEvent.click(addBtn);
    expect(mockAdd).toHaveBeenCalledTimes(1);
  });

  it('should not render Add members button if onAddParticipant is not provided', () => {
    render(<ParticipantList participants={mockParticipants} currentUserId="u3" />);
    expect(screen.queryByRole('button', { name: /Add members/i })).not.toBeInTheDocument();
  });

  it('should pass onRemoveParticipant to ParticipantItem and handle click', () => {
    const mockRemove = vi.fn();
    render(<ParticipantList participants={mockParticipants} currentUserId="u3" onRemoveParticipant={mockRemove} />);
    
    const removeBtns = screen.getAllByRole('button', { name: 'Remove' });
    fireEvent.click(removeBtns[0]);
    
    expect(mockRemove).toHaveBeenCalledWith('u1');
  });

  it('should use custom renderItem if provided', () => {
    const customRender = (p: ConversationParticipant) => <div data-testid="custom-participant">{p.id}</div>;
    render(<ParticipantList participants={mockParticipants} currentUserId="u3" renderItem={customRender} />);
    
    expect(screen.getAllByTestId('custom-participant')).toHaveLength(2);
    expect(screen.queryByTestId('mock-participant-item')).not.toBeInTheDocument();
  });
});
