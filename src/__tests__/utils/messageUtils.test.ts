import { describe, it, expect, afterEach } from "vitest";
import { findLastPersistedMessage } from "../../utils/messageUtils";
import type { ChatMessage } from "../../types/message.types";

describe("findLastPersistedMessage", () => {
  it("should return undefined for null, undefined, or empty arrays", () => {
    expect(findLastPersistedMessage(null)).toBeUndefined();
    expect(findLastPersistedMessage(undefined)).toBeUndefined();
    expect(findLastPersistedMessage([])).toBeUndefined();
  });

  it("should return the last message when all messages have valid IDs", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        type: "text",
        content: "Hello",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        type: "text",
        content: "World",
        sender: { id: "u2" },
        createdAt: new Date(),
        status: "sent",
      },
    ];

    const result = findLastPersistedMessage(messages);
    expect(result).toBeDefined();
    expect(result?.id).toBe("msg-2");
  });

  it("should skip temporary optimistic messages (temp-*) at the end and return the last persisted message", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        type: "text",
        content: "Hello",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        type: "text",
        content: "Persisted message",
        sender: { id: "u2" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "temp-12345",
        conversationId: "conv-1",
        type: "text",
        content: "Sending...",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sending",
      },
      {
        id: "temp-67890",
        conversationId: "conv-1",
        type: "text",
        content: "Another sending...",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sending",
      },
    ];

    const result = findLastPersistedMessage(messages);
    expect(result).toBeDefined();
    expect(result?.id).toBe("msg-2");
    expect(result?.content).toBe("Persisted message");
  });

  it("should skip messages with status sending even without temp- id", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        type: "text",
        content: "First msg",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "msg-custom-id",
        conversationId: "conv-1",
        type: "text",
        content: "Optimistic custom ID",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sending",
      },
    ];

    const result = findLastPersistedMessage(messages);
    expect(result).toBeDefined();
    expect(result?.id).toBe("msg-1");
  });

  it("should return undefined if all messages are temporary", () => {
    const messages: ChatMessage[] = [
      {
        id: "temp-1",
        conversationId: "conv-1",
        type: "text",
        content: "Sending 1",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sending",
      },
      {
        id: "temp-2",
        conversationId: "conv-1",
        type: "text",
        content: "Sending 2",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sending",
      },
    ];

    expect(findLastPersistedMessage(messages)).toBeUndefined();
  });
});

  it("should skip failed messages at the end and return the last non-failed persisted message", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        type: "text",
        content: "Hello",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "msg-2",
        conversationId: "conv-1",
        type: "text",
        content: "Persisted message",
        sender: { id: "u2" },
        createdAt: new Date(),
        status: "sent",
      },
      {
        id: "msg-failed-1",
        conversationId: "conv-1",
        type: "text",
        content: "Failed message",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "failed",
      },
    ];

    const result = findLastPersistedMessage(messages);
    expect(result).toBeDefined();
    expect(result?.id).toBe("msg-2");
    expect(result?.content).toBe("Persisted message");
  });

  it("should return undefined if all messages are failed", () => {
    const messages: ChatMessage[] = [
      {
        id: "msg-failed-1",
        conversationId: "conv-1",
        type: "text",
        content: "Failed 1",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "failed",
      },
      {
        id: "msg-failed-2",
        conversationId: "conv-1",
        type: "text",
        content: "Failed 2",
        sender: { id: "u1" },
        createdAt: new Date(),
        status: "failed",
      },
    ];

    expect(findLastPersistedMessage(messages)).toBeUndefined();
  });

describe('isDocumentVisible', () => {
  const originalVisibilityState = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');

  afterEach(() => {
    if (originalVisibilityState) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalVisibilityState);
    }
  });

  it('returns true when document is visible', async () => {
    const { isDocumentVisible } = await import('../../utils/messageUtils');
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });
    expect(isDocumentVisible()).toBe(true);
  });

  it('returns false when document is hidden', async () => {
    const { isDocumentVisible } = await import('../../utils/messageUtils');
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    expect(isDocumentVisible()).toBe(false);
  });

  it('returns true when document is undefined (SSR)', async () => {
    const { isDocumentVisible } = await import('../../utils/messageUtils');
    const origDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', { value: undefined, configurable: true });
    expect(isDocumentVisible()).toBe(true);
    Object.defineProperty(globalThis, 'document', { value: origDocument, configurable: true });
  });
});
