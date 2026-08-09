# Guides

Welcome to the `np-acs-library` guides. Here you will find step-by-step instructions on how to accomplish common tasks and implement various chat features using our library.

---

## 1. Authentication Setup

Authentication in Azure Communication Services (ACS) relies on generating a user access token from a secure backend. The `np-acs-library` expects you to provide a token and a mechanism to refresh it when it expires.

### Backend Requirements
Your backend must securely communicate with the ACS Identity Service to generate and issue tokens for your users. Do not expose your ACS connection string on the client side.

### Client-Side Configuration
To configure the `ChatProvider`, you need an initial token and a `tokenRefresher` function. The library will automatically call the `tokenRefresher` when the token is close to expiration.

```tsx
import { ChatProvider, ChatConfig } from 'np-acs-library';

const fetchTokenFromBackend = async (): Promise<string> => {
  const response = await fetch('/api/get-acs-token');
  const data = await response.json();
  return data.token;
};

const config: ChatConfig = {
  endpoint: 'https://<YOUR_ACS_RESOURCE>.communication.azure.com/',
  userId: '<ACS_USER_ID>',
  token: '<INITIAL_ACCESS_TOKEN>',
  tokenRefresher: fetchTokenFromBackend,
};

function App() {
  return (
    <ChatProvider config={config}>
      <YourChatApp />
    </ChatProvider>
  );
}
```

---

## 2. 1-1 Chat

Setting up a 1-1 chat involves creating a conversation and utilizing the provided UI components or headless hooks to display messages.

### Using Built-in UI
The easiest way to start is using the pre-built `<ChatContainer />`. It handles the layout and interactions for you.

```tsx
import { ChatContainer } from 'np-acs-library';

function OneOnOneChat() {
  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ChatContainer />
    </div>
  );
}
```

### Using Headless Hooks
If you need complete control over the UI, you can use the headless hooks to fetch conversations and messages.

```tsx
import { useConversations, useMessages } from 'np-acs-library';
import { useState } from 'react';

function HeadlessChat() {
  const { conversations } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex' }}>
      {/* Conversation List Sidebar */}
      <div>
        {conversations.map(conv => (
          <div key={conv.id} onClick={() => setSelectedConversationId(conv.id)}>
            {conv.topic || 'Unknown Chat'}
          </div>
        ))}
      </div>

      {/* Message Area */}
      <div>
        {selectedConversationId ? (
          <MessageView conversationId={selectedConversationId} />
        ) : (
          <p>Select a chat</p>
        )}
      </div>
    </div>
  );
}

function MessageView({ conversationId }: { conversationId: string }) {
  const { messages, sendMessage } = useMessages(conversationId);
  const [text, setText] = useState('');

  const handleSend = () => {
    sendMessage(text);
    setText('');
  };

  return (
    <div>
      <ul>
        {messages.map(msg => (
          <li key={msg.id}>{msg.content}</li>
        ))}
      </ul>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

---

## 3. Group Chat

Group chats function similarly to 1-1 chats in ACS, but they involve multiple participants. The library manages participants implicitly for you, but you can also retrieve participant data.

### Managing Participants
Use the `useParticipants` hook to list who is in the current group chat and handle typing indicators.

```tsx
import { useParticipants, TypingIndicator } from 'np-acs-library';

function GroupChatInfo({ conversationId }: { conversationId: string }) {
  const { participants } = useParticipants(conversationId);

  return (
    <div>
      <h3>Participants ({participants.length})</h3>
      <ul>
        {participants.map(p => (
          <li key={p.id}>{p.displayName || p.id}</li>
        ))}
      </ul>
      
      {/* Show who is typing */}
      <TypingIndicator conversationId={conversationId} />
    </div>
  );
}
```

---

## 4. Custom UI

The `np-acs-library` is designed to be highly customizable. If the default `ChatContainer` doesn't fit your needs, you can compose your own layouts using the individual components or headless hooks.

### Composing Individual Components
You can mix and match the provided UI components to create a custom layout without having to build everything from scratch.

```tsx
import { ConversationList, MessageList, MessageInput } from 'np-acs-library';
import { useState } from 'react';

function CustomChatLayout() {
  const [activeId, setActiveId] = useState<string | undefined>();

  return (
    <div className="my-custom-layout">
      <aside className="sidebar">
        <ConversationList 
          selectedId={activeId} 
          onSelectConversation={setActiveId} 
        />
      </aside>
      
      <main className="chat-area">
        {activeId ? (
          <>
            <MessageList conversationId={activeId} />
            <MessageInput conversationId={activeId} />
          </>
        ) : (
          <div className="empty-state">Please select a conversation</div>
        )}
      </main>
    </div>
  );
}
```
*Note: Make sure this layout is wrapped inside a `<ChatProvider>`.*

---

## 5. Error Handling

Robust error handling is critical for a smooth user experience. The library tracks the connection state and provides error details through the `useChat` hook.

### Connection State and Errors

```tsx
import { useChat } from 'np-acs-library';

function ConnectionStatusBanner() {
  const { isConnected, error } = useChat();

  if (error) {
    return (
      <div style={{ background: 'red', color: 'white', padding: '10px' }}>
        Error: {error.message} (Code: {error.code})
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div style={{ background: 'orange', padding: '10px' }}>
        Connecting to chat service...
      </div>
    );
  }

  return null;
}
```

Common error codes you might encounter include authentication failures (e.g., token expired and refresh failed) or network issues. Always ensure your token refresher logic is robust and can handle backend outages.

---

## 6. Internationalization (i18n)

The `np-acs-library` supports internationalization out-of-the-box using `react-i18next`.

### Changing Languages
You can use the `useChatLanguage` hook to switch languages dynamically across all built-in UI components.

```tsx
import { useChatLanguage } from 'np-acs-library';

function LanguageSwitcher() {
  const { currentLanguage, changeLanguage, supportedLanguages } = useChatLanguage();

  return (
    <select 
      value={currentLanguage} 
      onChange={(e) => changeLanguage(e.target.value)}
    >
      {supportedLanguages.map(lang => (
        <option key={lang.code} value={lang.code}>
          {lang.label}
        </option>
      ))}
    </select>
  );
}
```
