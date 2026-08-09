import React, { useEffect, useState, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';
import { chatI18n } from '../i18n';
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
  locale?: 'en' | 'vi' | string;
  translations?: Record<string, unknown>;
  children?: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = React.memo(({ config, locale = 'en', translations, children }) => {
  const [, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (locale) {
      chatI18n.changeLanguage(locale);
    }
  }, [locale]);

  useEffect(() => {
    if (translations) {
      chatI18n.addResourceBundle(locale, 'translation', translations, true, true);
    }
  }, [translations, locale]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        conversationService.setChatService(chatService);
        messageService.setChatService(chatService);
        readReceiptService.setChatService(chatService);
        typingService.setChatService(chatService);
        
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

  return (
    <I18nextProvider i18n={chatI18n}>
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    </I18nextProvider>
  );
});
