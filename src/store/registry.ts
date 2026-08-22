import type { useMessageStore } from './messageStore';

/**
 * Late-binding registry for cross-store accessors.
 *
 * `conversationStore` and `messageStore` used to import each other at module
 * load, forming a circular dependency (harmless at call-time via getState(),
 * but fragile). messageStore registers itself here, and conversationStore
 * resolves it lazily — only type imports cross module boundaries.
 */

let messageStoreHook: typeof useMessageStore | null = null;

export function registerMessageStore(hook: typeof useMessageStore): void {
  messageStoreHook = hook;
}

export function getMessageStoreHook(): typeof useMessageStore | null {
  return messageStoreHook;
}