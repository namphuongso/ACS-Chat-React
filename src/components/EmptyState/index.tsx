import React from 'react';

export interface EmptyStateProps {
  message?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  message = 'No data available',
  className = ''
}) => {
  return (
    <div 
      className={className}
      style={{ padding: 24, textAlign: 'center', color: '#667781', fontSize: 14 }}
    >
      {message}
    </div>
  );
};
