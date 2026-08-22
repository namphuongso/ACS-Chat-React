import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
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
    children,
    defaults,
    values,
  }: {
    children?: React.ReactNode;
    defaults?: string;
    values?: Record<string, string>;
  }) => {
    let text: string = typeof children === 'string' ? children : defaults || '';
    if (values) {
      Object.keys(values).forEach((key) => {
        text = text.replace(new RegExp(`{{${key}}}`, 'g'), values[key]);
      });
    }
    return text;
  },
}));
