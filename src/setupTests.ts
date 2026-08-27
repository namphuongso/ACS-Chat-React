import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';
import { en } from './i18n/locales/en';

// Resolve a dotted i18n key (e.g. "chat.system.topicUpdated") against the en locale.
const resolveKey = (key: string): string => {
  const parts = key.split('.');
  let current: unknown = en;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Standard mock behavior: t always returns the key itself so tests can assert on key names
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({
    i18nKey,
    children,
    defaults,
    values,
  }: {
    i18nKey?: string;
    children?: React.ReactNode;
    defaults?: string;
    values?: Record<string, string>;
  }) => {
    let text: string =
      (i18nKey ? resolveKey(i18nKey) : undefined) ??
      (typeof children === 'string' ? children : defaults || '');
    if (values) {
      Object.keys(values).forEach((key) => {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), values[key]);
      });
    }
    return text;
  },
}));
