import { useState, useEffect, useCallback } from 'react';
import { chatI18n } from '../i18n';

export interface UseChatLanguageResult {
  currentLanguage: string;
  supportedLanguages: string[];
  changeLanguage: (lng: string) => Promise<void>;
}

/**
 * Hook to manage the language of the chat library.
 * @returns {UseChatLanguageResult} Object containing current language state and methods
 */
export const useChatLanguage = (): UseChatLanguageResult => {
  const [currentLanguage, setCurrentLanguage] = useState(chatI18n.language || 'en');

  useEffect(() => {
    const handleLanguageChanged = (lng: string) => {
      setCurrentLanguage(lng);
    };

    chatI18n.on('languageChanged', handleLanguageChanged);
    return () => {
      chatI18n.off('languageChanged', handleLanguageChanged);
    };
  }, []);

  const changeLanguage = useCallback(async (lng: string) => {
    await chatI18n.changeLanguage(lng);
  }, []);

  // Extract supported languages from i18n options
  const supportedLanguages = Object.keys(chatI18n.options.resources || { en: {}, vi: {} });

  return {
    currentLanguage,
    supportedLanguages,
    changeLanguage,
  };
};
