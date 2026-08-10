# @namphuongtechnologi/acs-chat-react

[![npm version](https://img.shields.io/npm/v/@namphuongtechnologi/acs-chat-react.svg?style=flat-square)](https://www.npmjs.com/package/@namphuongtechnologi/acs-chat-react)
[![npm downloads](https://img.shields.io/npm/dm/@namphuongtechnologi/acs-chat-react.svg?style=flat-square)](https://www.npmjs.com/package/@namphuongtechnologi/acs-chat-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**React + TypeScript Azure Communication Services (ACS) Chat Library**

A powerful, customizable, and production-ready React chat library for **Azure Communication Services (ACS)**. Build feature-rich chat applications quickly with our pre-built UI components, or create fully custom chat experiences using our headless React hooks.

## ✨ Key Features

- 🧩 **Two Integration Modes**: Choose between pre-built UI components or headless hooks for complete design freedom.
- 🎨 **Highly Customizable**: Easily theme the chat UI using CSS variables to match your brand identity.
- 🌍 **Internationalization (i18n)**: Built-in multi-language support using `react-i18next`.
- 💬 **Full Chat Capabilities**: Real-time messaging, typing indicators, read receipts, message editing, and deletion.
- 👥 **Advanced Contact Management**: Search contacts, view avatars, and handle room membership automatically.
- 📌 **Conversation Management**: Support for pinned conversations, unread message counts, and dynamic sorting.
- 🛡️ **TypeScript Ready**: Written in TypeScript with full type definitions included out of the box.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Approach A: Pre-built UI Components](#approach-a-pre-built-ui-components)
  - [Approach B: Headless Hooks (Custom UI)](#approach-b-headless-hooks-custom-ui)
- [Configuration](#configuration)
  - [ChatConfig Object](#chatconfig-object)
- [Available Hooks](#available-hooks)
- [Customizing Default Styles](#customizing-default-styles)

---

## Installation

You can install the library via npm or yarn:

```bash
npm install @namphuongtechnologi/acs-chat-react
# or
yarn add @namphuongtechnologi/acs-chat-react
```

### Peer Dependencies

Make sure you have React and React DOM installed in your project:

```bash
npm install react react-dom
```

---

## Quick Start

Before using the library, ensure you import the library styles in your application's entry point if you plan to use the pre-built UI components or if you want to leverage the default CSS variables:

```tsx
import '@namphuongtechnologi/acs-chat-react/dist/index.css';
```

### Approach A: Pre-built UI Components

This is the fastest way to get a chat interface up and running. You wrap your application or chat view with `ChatProvider` and use the `ChatContainer` component, which includes a conversation list, message list, and message input.

```tsx
import React from 'react';
import { ChatProvider, ChatContainer, ChatConfig } from '@namphuongtechnologi/acs-chat-react';

const chatConfig: ChatConfig = {
  endpoint: 'https://<your-acs-resource>.communication.azure.com/',
  userId: '8:acs:123456',
  displayName: 'Current User',
  token: '<your-access-token>',
  tokenRefresher: async () => {
    // Fetch a new token from your backend
    const response = await fetch('/api/get-token');
    const data = await response.json();
    return data.token;
  },
};

const App = () => {
  return (
    <ChatProvider config={chatConfig}>
      <div style={{ height: '100vh', width: '100vw' }}>
        <ChatContainer />
      </div>
    </ChatProvider>
  );
};

export default App;
```

### Approach B: Headless Hooks (Custom UI)

If you need complete control over the UI, you can use the headless hooks provided by the library. The `ChatProvider` handles the connection and state management, while you build your own components using the data returned by the hooks.

```tsx
import React, { useEffect } from 'react';
import {
  ChatProvider,
  useChat,
  useConversations,
  ChatConfig,
} from '@namphuongtechnologi/acs-chat-react';

const CustomConversationList = () => {
  const { conversations, isLoading, fetchConversations } = useConversations();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  if (isLoading) return <div>Loading conversations...</div>;

  return (
    <ul>
      {conversations.map((conv) => (
        <li key={conv.id}>{conv.topic || 'Untitled'}</li>
      ))}
    </ul>
  );
};

const CustomChatApp = () => {
  const { isInitialized, error } = useChat();

  if (error) return <div>Error: {error.message}</div>;
  if (!isInitialized) return <div>Initializing Chat...</div>;

  return (
    <div className="my-custom-chat">
      <CustomConversationList />
      {/* Build other custom components for Messages, Input, etc. */}
    </div>
  );
};

const chatConfig: ChatConfig = {
  endpoint: 'https://<your-acs-resource>.communication.azure.com/',
  userId: '8:acs:123456',
  displayName: 'Current User',
  token: '<your-access-token>',
  tokenRefresher: async () => {
    // Refresh token logic
    return 'new-token';
  },
};

const App = () => {
  return (
    <ChatProvider config={chatConfig}>
      <CustomChatApp />
    </ChatProvider>
  );
};

export default App;
```

---

## Configuration

### `ChatConfig` Object

The `ChatProvider` requires a `config` object of type `ChatConfig` to initialize the connection to Azure Communication Services.

| Property              | Type                                      | Required | Description                                                                                                            |
| :-------------------- | :---------------------------------------- | :------: | :--------------------------------------------------------------------------------------------------------------------- |
| **`endpoint`**        | `string`                                  | **Yes**  | Your ACS resource endpoint URL (e.g., `https://<resource>.communication.azure.com/`).                                  |
| **`userId`**          | `string`                                  | **Yes**  | The current user's ACS Communication User ID (e.g., `8:acs:123456`).                                                   |
| **`displayName`**     | `string`                                  | **Yes**  | The display name of the current user.                                                                                  |
| **`token`**           | `string`                                  | **Yes**  | The initial ACS access token.                                                                                          |
| **`tokenRefresher`**  | `() => Promise<string>`                   | **Yes**  | An async callback function that fetches and returns a new access token when the current one expires.                   |
| **`backendUrl`**      | `string`                                  |    No    | Optional backend API base URL for custom integrations.                                                                 |
| **`backendHeaders`**  | `Record<string, string>`                  |    No    | Optional custom headers to include with requests to the `backendUrl`.                                                  |
| **`reconnectPolicy`** | `ReconnectPolicy`                         |    No    | Configuration for reconnecting to ACS. Includes `maxRetries`, `initialDelayMs`, `maxDelayMs`, and `backoffMultiplier`. |
| **`logger`**          | `ChatLogger`                              |    No    | Optional custom logger implementation (`debug`, `info`, `warn`, `error`).                                              |
| **`onFileUpload`**    | `(file: File) => Promise<FileAttachment>` |    No    | Optional callback to handle file uploads, returning metadata for attachment.                                           |

#### Reconnect Policy (`ReconnectPolicy`)

- **`maxRetries`**: Maximum number of reconnection attempts (default: `10`).
- **`initialDelayMs`**: Initial delay before first reconnection attempt (default: `1000`).
- **`maxDelayMs`**: Maximum delay between reconnection attempts (default: `30000`).
- **`backoffMultiplier`**: Multiplier for exponential backoff (default: `2`).

---

## Available Hooks

The library exposes several hooks for headless UI implementations:

- **`useChat()`**: Core chat initialization state and error handling.
- **`useConnection()`**: Connection status and manual reconnection logic.
- **`useConversations()`**: CRUD operations and state for conversations.
- **`useMessages(threadId)`**: Message history, sending, editing, and deleting for a specific thread.
- **`useParticipants(threadId)`**: Manage participants (add/remove) in a thread.
- **`useTypingIndicator(threadId)`**: Send and receive typing indicators.
- **`useReadReceipt(threadId)`**: Send and track read receipts for messages.

---

## Customizing Default Styles

If you are using the pre-built UI components, you can easily customize the appearance by overriding the default CSS variables in your own stylesheet:

```css
:root {
  /* Colors */
  --acs-color-primary: #0078d4;
  --acs-color-primary-hover: #106ebe;
  --acs-color-background: #ffffff;
  --acs-color-background-muted: #f3f2f1;

  /* Text */
  --acs-color-text: #323130;
  --acs-color-text-muted: #605e5c;

  /* Borders */
  --acs-border-color: #edebe9;
  --acs-border-radius-md: 8px;

  /* Typography */
  --acs-font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
}
```
