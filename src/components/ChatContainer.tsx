import React from 'react';

export interface ChatContainerProps {
  children?: React.ReactNode;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({ children }) => {
  return <div>{children}</div>;
};
