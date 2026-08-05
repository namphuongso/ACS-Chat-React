# @namphuong/acs-chat-react

React + TypeScript Azure Communication Services (ACS) Chat Library for Nam Phuong.

This library provides a set of UI components and React hooks for building chat applications powered by Azure Communication Services. It supports two main approaches for integration: **Approach A (Pre-built UI Components)** and **Approach B (Headless Hooks)**.

## Installation

```bash
npm install @namphuong/acs-chat-react
```

## Setup

First, import the library styles in your application entry point if you plan to use the pre-built UI components or if you want to leverage the default CSS variables:

```tsx
import '@namphuong/acs-chat-react/dist/index.css';
```

## Integration Approaches

### Approach A: Pre-built UI Components

This is the fastest way to get a chat interface up and running. You wrap your application or chat view with `ChatProvider` and use the `ChatContainer` component, which includes a conversation list, message list, and message input.

```tsx
import React from 'react';
import { ChatProvider, ChatContainer, ChatConfig } from '@namphuong/acs-chat-react';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

const chatConfig: ChatConfig = {
  endpointUrl: 'https://<your-acs-resource>.communication.azure.com/',
  credential: new AzureCommunicationTokenCredential('<your-access-token>'),
  userId: '8:acs:123456',
  displayName: 'Current User'
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
  useMessages, 
  ChatConfig 
} from '@namphuong/acs-chat-react';
import { AzureCommunicationTokenCredential } from '@azure/communication-common';

const CustomConversationList = () => {
  const { conversations, isLoading, loadConversations } = useConversations();
  
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  if (isLoading) return <div>Loading conversations...</div>;

  return (
    <ul>
      {conversations.map(conv => (
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
  endpointUrl: 'https://<your-acs-resource>.communication.azure.com/',
  credential: new AzureCommunicationTokenCredential('<your-access-token>'),
  userId: '8:acs:123456',
  displayName: 'Current User'
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

## Available Hooks

- `useChat()`: Core chat initialization state and error handling.
- `useConnection()`: Connection status and reconnection logic.
- `useConversations()`: CRUD operations and state for conversations.
- `useMessages(threadId)`: Message history, sending, editing, deleting for a specific thread.
- `useParticipants(threadId)`: Manage participants in a thread.
- `useTypingIndicator(threadId)`: Send and receive typing indicators.
- `useReadReceipt(threadId)`: Send and track read receipts.

## Customizing Default Styles

If using the pre-built components, you can customize the appearance by overriding CSS variables in your own stylesheet:

```css
:root {
  --acs-color-primary: #0078d4;
  --acs-color-primary-hover: #106ebe;
  --acs-color-background: #ffffff;
  --acs-color-text: #323130;
  --acs-border-radius-md: 8px;
}
```
