import type { ChatLogger } from '../types/config.types';

let customLogger: ChatLogger | null = null;

export const setLogger = (l: ChatLogger | null): void => {
  customLogger = l;
};

export const logger: ChatLogger = {
  debug: (message: string, ...args: unknown[]) =>
    customLogger ? customLogger.debug(message, ...args) : console.debug(message, ...args),
  info: (message: string, ...args: unknown[]) =>
    customLogger ? customLogger.info(message, ...args) : console.info(message, ...args),
  warn: (message: string, ...args: unknown[]) =>
    customLogger ? customLogger.warn(message, ...args) : console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) =>
    customLogger ? customLogger.error(message, ...args) : console.error(message, ...args),
};
