import React from 'react';

export interface ChatProviderProps {
  children?: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  return <>{children}</>;
};
