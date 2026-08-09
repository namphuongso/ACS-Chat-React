import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ParticipantItem } from '../ParticipantItem';
import type { ConversationParticipant } from '../../../types/participant.types';

describe('ParticipantItem Component', () => {
  const mockParticipant: ConversationParticipant = {
    id: 'u1',
    displayName: 'Alice',
    role: 'admin'
  };

  it('should render participant details correctly', () => {
    render(<ParticipantItem participant={mockParticipant} isCurrentUser={false} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    // Assuming avatar renders 'A'
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should render fallback id if displayName is missing', () => {
    const unnamedParticipant: ConversationParticipant = {
      id: 'u2'
    };
    render(<ParticipantItem participant={unnamedParticipant} isCurrentUser={false} />);
    expect(screen.getByText('u2')).toBeInTheDocument();
  });

  it('should render "chat.you" badge if isCurrentUser is true', () => {
    render(<ParticipantItem participant={mockParticipant} isCurrentUser={true} />);
    expect(screen.getByText('chat.you')).toBeInTheDocument();
  });

  it('should render remove button and handle click if onRemove is provided and not current user', () => {
    const mockRemove = vi.fn();
    render(<ParticipantItem participant={mockParticipant} onRemove={mockRemove} isCurrentUser={false} />);
    
    // Open dropdown
    const moreBtn = screen.getByRole('button');
    fireEvent.click(moreBtn);
    
    const removeBtn = screen.getByText('chat.removeFromGroup');
    expect(removeBtn).toBeInTheDocument();
    
    fireEvent.click(removeBtn);
    expect(mockRemove).toHaveBeenCalledWith('u1');
  });

  it('should render leave button if onRemove is provided and is current user', () => {
    const mockRemove = vi.fn();
    render(<ParticipantItem participant={mockParticipant} onRemove={mockRemove} isCurrentUser={true} />);
    
    const moreBtn = screen.getByRole('button');
    fireEvent.click(moreBtn);
    
    const leaveBtn = screen.getByText('chat.leaveGroup');
    expect(leaveBtn).toBeInTheDocument();
    
    fireEvent.click(leaveBtn);
    expect(mockRemove).toHaveBeenCalledWith('u1');
  });

  it('should not render remove button if onRemove is not provided', () => {
    render(<ParticipantItem participant={mockParticipant} isCurrentUser={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
