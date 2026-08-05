import React, { useEffect, useState, useMemo } from 'react';
import { ChatContext, ChatContextValue } from '../providers/ChatContext';
import { chatService } from '../services/chatService';
import { connectionService } from '../services/connectionService';
import { conversationService } from '../services/conversationService';
import { messageService } from '../services/messageService';
import { participantService } from '../services/participantService';
import { readReceiptService } from '../services/readReceiptService';
import { typingService } from '../services/typingService';
import type { ChatConfig } from '../types/config.types';

export interface ChatProviderProps {
  config: ChatConfig;
  children?: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = React.memo(({ config, children }) => {
  const [, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        await chatService.initialize(config);
        if (mounted) {
          connectionService.setupNetworkListeners();
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Initialization failed'));
          console.error('Failed to initialize ChatProvider:', err);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      connectionService.teardownNetworkListeners();
      chatService.dispose().catch(console.error);
    };
  }, [config]);

  const value: ChatContextValue = useMemo(() => ({
    services: {
      chatService,
      connectionService,
      conversationService,
      messageService,
      participantService,
      readReceiptService,
      typingService,
    },
  }), []);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
});
