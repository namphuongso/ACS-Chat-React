import { createContext, useContext } from 'react';
import { chatService } from '../services/chatService';
import { connectionService } from '../services/connectionService';
import { conversationService } from '../services/conversationService';
import { messageService } from '../services/messageService';
import { participantService } from '../services/participantService';
import { readReceiptService } from '../services/readReceiptService';
import { typingService } from '../services/typingService';
import { websocketService } from '../services/websocketService';

export interface ChatServices {
  chatService: typeof chatService;
  connectionService: typeof connectionService;
  conversationService: typeof conversationService;
  messageService: typeof messageService;
  participantService: typeof participantService;
  readReceiptService: typeof readReceiptService;
  typingService: typeof typingService;
  websocketService: typeof websocketService;
}

export interface ChatContextValue {
  services: ChatServices;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatServices = (): ChatServices => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatServices must be used within a ChatProvider');
  }
  return context.services;
};
