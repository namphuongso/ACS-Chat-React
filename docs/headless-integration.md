# Headless Integration Guide (@namphuongtechnologi/acs-chat-react)

## Introduction

The Headless approach (Approach B) provides maximum flexibility by decoupling the chat logic from the UI. The library handles all the complex data fetching, state management, real-time synchronization, and caching for Azure Communication Services (ACS). You, the developer, retain full control over the rendering and styling of the chat components.

This guide will walk you through how to integrate the headless API of `@namphuongtechnologi/acs-chat-react` into your own custom UI.

## Core Concepts

1. **`ChatProvider`**: The root component that initializes the ACS client, connects to the backend and handles real-time events. It must wrap your custom chat UI.
2. **Hooks**: A set of React hooks (`useChat`, `useConversations`, `useMessages`, etc.) that expose the state and actions for various chat features.
3. **Bring Your Own UI (BYOU)**: You design the components (lists, bubbles, inputs), and bind the data/actions provided by the hooks.

## Installation

Assuming you have already installed the package:

```bash
npm install @namphuongtechnologi/acs-chat-react
```

## Step 1: Initialize ChatProvider

Wrap your application or the chat portion of your app with the `ChatProvider`. You need to provide the `ChatConfig` with valid credentials.

```tsx
import React from 'react';
import { ChatProvider, ChatConfig } from '@namphuongtechnologi/acs-chat-react';
import { MyCustomChatUI } from './MyCustomChatUI';

const chatConfig: ChatConfig = {
  endpoint: 'https://xxx.communication.azure.com',
  token: 'eyJ...', // Valid ACS User access token
  userId: '8:acs:xxx', // Valid ACS User ID
  displayName: 'John Doe',
};

export default function App() {
  return (
    <ChatProvider config={chatConfig}>
      <MyCustomChatUI />
    </ChatProvider>
  );
}
```

## Step 2: Build the Main Chat Layout

Use the hooks to access the connection state, conversation list, and the active conversation.

```tsx
// MyCustomChatUI.tsx
import React from 'react';
import { useChat, useConversations } from '@namphuongtechnologi/acs-chat-react';
import { MySidebar } from './MySidebar';
import { MyMessageArea } from './MyMessageArea';
import './MyChatStyles.css'; // Your own custom CSS

export function MyCustomChatUI() {
  // Access global chat connection state
  const { connectionState } = useChat();

  // Access conversations
  const { conversations, activeConversation, openConversation, loadMore } = useConversations();

  return (
    <div className="my-chat-layout">
      {/* Display connection status if not connected */}
      {connectionState !== 'connected' && (
        <div className="connection-banner">Status: {connectionState}</div>
      )}

      {/* Sidebar for listing conversations */}
      <MySidebar
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={openConversation}
        onLoadMore={loadMore}
      />

      {/* Main chat area for the active conversation */}
      {activeConversation ? (
        <MyMessageArea conversationId={activeConversation.id} />
      ) : (
        <div className="empty-state">Select a conversation to start chatting</div>
      )}
    </div>
  );
}
```

## Step 3: Implement the Sidebar (Conversation List)

The sidebar displays the list of chat threads. You can use data from the `conversations` array.

```tsx
// MySidebar.tsx
import React from 'react';
import { Conversation } from '@namphuongtechnologi/acs-chat-react';

interface MySidebarProps {
  conversations: Conversation[];
  activeConversationId?: string;
  onSelectConversation: (id: string) => void;
  onLoadMore: () => void;
}

export function MySidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onLoadMore,
}: MySidebarProps) {
  return (
    <aside className="my-sidebar">
      <div className="sidebar-header">
        <h3>Chats</h3>
      </div>
      <div className="conversation-list">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`conversation-item ${conv.id === activeConversationId ? 'active' : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            <div className="conv-title">{conv.topic || 'Unknown Chat'}</div>
            {/* Show last message snippet if available */}
            {conv.lastMessage && <div className="conv-snippet">{conv.lastMessage.content}</div>}
            {/* Show unread indicator */}
            {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
          </div>
        ))}
      </div>
      <button className="load-more-btn" onClick={onLoadMore}>
        Load Older Chats
      </button>
    </aside>
  );
}
```

## Step 4: Implement the Message Area

The message area binds to `useMessages` to fetch messages for the active conversation, `useTypingIndicator` for typing states, and `useParticipants` to know who is in the chat.

```tsx
// MyMessageArea.tsx
import React, { useState } from 'react';
import {
  useMessages,
  useTypingIndicator,
  useReadReceipt,
} from '@namphuongtechnologi/acs-chat-react';

export function MyMessageArea({ conversationId }: { conversationId: string }) {
  const { messages, hasMore, loadMore, sendMessage, editMessage, deleteMessage } =
    useMessages(conversationId);

  const { typingUsers, sendTyping } = useTypingIndicator(conversationId);
  const { sendReadReceipt } = useReadReceipt(conversationId);
  const [inputText, setInputText] = useState('');

  // Handle sending a new message
  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage({ content: inputText });
    setInputText('');
  };

  // Mark messages as read when viewing this area
  // (In a real app, you might trigger this on scroll or intersection observer)
  React.useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      sendReadReceipt(lastMessage.id);
    }
  }, [messages, sendReadReceipt]);

  return (
    <main className="my-message-area">
      <div className="message-list">
        {hasMore && (
          <button className="load-older-btn" onClick={loadMore}>
            Load older messages
          </button>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message-bubble ${msg.senderId === '8:acs:xxx' ? 'mine' : 'theirs'}`}
          >
            <div className="msg-sender">{msg.senderDisplayName}</div>
            <div className="msg-content">{msg.content}</div>
            <div className="msg-status">{msg.status}</div>

            {/* Example Edit/Delete Actions */}
            {msg.senderId === '8:acs:xxx' && (
              <div className="msg-actions">
                <button onClick={() => deleteMessage(msg.id)}>Delete</button>
                <button onClick={() => editMessage(msg.id, msg.content + ' (edited)')}>Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          {typingUsers.map((u) => u.displayName).join(', ')} is typing...
        </div>
      )}

      <div className="message-input-area">
        <input
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            sendTyping(); // Notify others you are typing
          }}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </main>
  );
}
```

## Summary of Headless Hooks

| Hook                                 | Purpose                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `useChat()`                          | Returns global `ChatContext` state (config, client instance, global connection state).  |
| `useChatLanguage()`                  | Manages i18n chat locale state and language switching.                                  |
| `useConversations()`                 | Manages the list of chat threads, active thread, and creating new threads.              |
| `useMessages(conversationId)`        | Manages message history, sending, editing, and deleting messages for a specific thread. |
| `useParticipants(conversationId)`    | Provides a list of participants in a specific thread and methods to add/remove them.    |
| `useRoomMembers(conversationId)`     | Manage membership operations (join/leave) for ACS rooms.                                |
| `useTypingIndicator(conversationId)` | Returns currently typing users and a method to broadcast typing events.                 |
| `useReadReceipt(conversationId)`     | Provides methods to send read receipts and read receipt history.                        |
| `useConnection()`                    | Dedicated hook for connection lifecycle, status, and manual reconnects.                 |
| `useContactSearch()`                 | Search for contacts across chat providers with debounced fetching.                      |

By utilizing these hooks, you isolate the complex Azure Communication Services logic from your UI, leading to clean, testable, and highly customizable React applications.
