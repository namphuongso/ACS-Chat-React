# API Reference

This document provides a comprehensive overview of the `np-acs-library` API, including React Hooks, UI Components, and core TypeScript Types.

---

## 1. Components

### `<ChatProvider />`

The top-level context provider that initializes the Chat Service, connects to Azure Communication Services (ACS), and manages global state for all descendant hooks and components.

**Props:**

- `config` (`ChatConfig`): The main configuration object (includes endpoint, userId, token, tokenRefresher). **(Required)**
- `children` (`React.ReactNode`): The application components that will consume the chat state. **(Required)**

### `<ChatContainer />`

A fully-featured, out-of-the-box UI component that integrates the conversation list, message list, and message input into a single chat experience. Ideal for quick integration.

**Props:**

- `onConversationClick?` (`(conversationId: string) => void`): Callback triggered when a conversation is selected.
- `renderConversationList?` (`(props: ConversationListRenderProps) => ReactNode`): Custom render prop for overriding the conversation list area.
- `renderConversation?` (`(props: ConversationRenderProps) => ReactNode`): Custom render prop for overriding the conversation view area.

### `<ConversationList />`

Displays a list of available conversations for the current user, complete with unread counts and last message previews.

**Props:**

- `onSelectConversation?` (`(conversationId: string) => void`): Event handler for selecting a conversation.
- `selectedId?` (`string`): The currently selected conversation ID.

### `<ConversationHeader />`

Displays the header for a conversation, including the title, avatar, and back button (if applicable).

**Props:**

- `conversationId` (`string`): The ID of the conversation. **(Required)**
- `onBackClick?` (`() => void`): Callback when the back button is clicked.

### `<ConversationFooter />`

Displays the footer for a conversation, typically housing the message input and typing indicators.

**Props:**

- `conversationId` (`string`): The ID of the conversation. **(Required)**

### `<MessageList />`

Renders a scrollable list of messages for a specific conversation, utilizing virtualization for high performance with long histories.

**Props:**

- `conversationId` (`string`): The ID of the conversation to display messages for. **(Required)**
- `autoScroll?` (`boolean`): Automatically scroll to the bottom when new messages arrive. Default is `true`.

### `<MessageInput />`

An input component for typing and sending messages, with built-in support for typing indicators.

**Props:**

- `conversationId` (`string`): The ID of the conversation. **(Required)**
- `onSend?` (`(content: string) => void`): Optional override for the default send behavior.

### `<TypingIndicator />`

Displays visual indicators showing which participants are currently typing in a conversation.

**Props:**

- `conversationId` (`string`): The ID of the conversation. **(Required)**

### `<ParticipantList />`

Shows the list of participants in a given conversation.

**Props:**

- `conversationId` (`string`): The ID of the conversation. **(Required)**

### `<ConnectionStatus />`

A utility component that displays the current ACS real-time connection state (e.g., Connecting, Connected, Reconnecting, Error).

### `<ErrorState />` and `<ErrorFallback />`

Components used for rendering error boundaries and displaying inline error messages when API or connection failures occur.

---

## 2. Hooks

All hooks must be used within a component wrapped by `<ChatProvider />`.

### `useChat()`

Returns global chat state and client control methods.

**Returns:**

- `isInitialized` (`boolean`): True if the chat client has successfully initialized.
- `error` (`ChatError | null`): Any global initialization error.
- `logout()` (`() => Promise<void>`): Disconnects the client and clears local state.

### `useConnection()`

Exposes the real-time ACS connection state.

**Returns:**

- `state` (`ConnectionState`): Current connection status (`'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'`).
- `error` (`ChatError | null`): Details of any connection error.
- `reconnect()` (`() => Promise<void>`): Forces a manual reconnection attempt.

### `useConversations()`

Provides access to the authenticated user's conversation list and related actions.

**Returns:**

- `conversations` (`Conversation[]`): Array of all loaded conversations.
- `isLoading` (`boolean`): True if the initial conversation fetch is in progress.
- `error` (`ChatError | null`): Any error that occurred while fetching conversations.
- `createDirectConversation(options: CreateDirectConversationOptions)`: Creates a new 1-on-1 direct chat.
- `createGroupConversation(options: CreateGroupConversationOptions)`: Creates a new group chat.

### `useMessages(conversationId: string)`

Access messages and messaging actions for a specific conversation.

**Returns:**

- `messages` (`ChatMessage[]`): Chronologically sorted list of messages.
- `isLoading` (`boolean`): True if fetching the initial message history.
- `hasMore` (`boolean`): True if there is more message history that can be loaded.
- `loadMore()` (`() => Promise<void>`): Loads the next page of older messages.
- `sendMessage(options: SendMessageOptions)`: Sends a new text message (or attachment).
- `deleteMessage(messageId: string)`: Deletes an existing message.
- `editMessage(messageId: string, content: string)`: Edits an existing message.
- `retryMessage(messageId: string)`: Retries sending a failed message.

### `useParticipants(conversationId: string)`

Manage participants for a specific group conversation.

**Returns:**

- `participants` (`ConversationParticipant[]`): Array of current participants.
- `addParticipants(users: ChatUser[])`: Adds new users to the group chat.
- `removeParticipant(userId: string)`: Removes a user from the group chat.

### `useTypingIndicator(conversationId: string)`

Manage typing indicator events.

**Returns:**

- `typingUsers` (`TypingUser[]`): List of users currently typing.
- `sendTypingEvent()` (`() => Promise<void>`): Notifies others that the current user is typing (debounced automatically).

### `useReadReceipt(conversationId: string)`

Manage read receipts for a conversation.

**Returns:**

- `readReceipts` (`MessageReadStatus[]`): Read receipt status information.
- `sendReadReceipt(messageId: string)`: Marks a specific message as read.

### `useChatLanguage()`

Manage internationalization (i18n) and locale state.

**Returns:**

- `currentLanguage` (`string`): The currently active language code.
- `supportedLanguages` (`{ code: string, label: string }[]`): List of available languages.
- `changeLanguage(code: string)`: Switches the active language.

### `useContactSearch()`

Search for contacts across providers with debounced fetching.

**Returns:**

- `results` (`Contact[]`): Array of search results.
- `isSearching` (`boolean`): True if a search request is currently pending.
- `search(query: string)`: Triggers a search with the given query.
- `clearSearch()`: Clears current results and search state.

### `useRoomMembers(conversationId: string)`

Manage membership operations (join/leave) for ACS rooms.

**Returns:**

- `members` (`RoomMember[]`): Array of current room members.
- `isJoining` (`boolean`): True if currently attempting to join.
- `joinRoom()`: Attempts to join the room.
- `leaveRoom()`: Leaves the room.

---

## 3. Core Types

### `ChatConfig`

Primary configuration object passed to `<ChatProvider />`.

```typescript
interface ChatConfig {
  endpoint: string;
  userId: string;
  displayName: string;
  token: string;
  tokenRefresher: () => Promise<string>;
  backendUrl?: string;
  backendHeaders?: Record<string, string>;
  reconnectPolicy?: ReconnectPolicy;
  logger?: ChatLogger;
  linkPreview?: LinkPreviewConfig;
}
```

### `LinkPreviewConfig`

Configuration for a custom link-preview / SEO crawler endpoint. When provided, URL previews are resolved through this endpoint before falling back to the built-in backend and client-side parsing.

```typescript
interface LinkPreviewConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  requestBody?: Record<string, unknown> | ((url: string) => Record<string, unknown>);
  responseMapper?: (data: unknown) => Partial<LinkPreview>;
}
```

### `Conversation`

A discriminated union representing a chat thread.

```typescript
type Conversation = DirectConversation | GroupConversation;

interface BaseConversation {
  id: string;
  type: 'direct' | 'group';
  createdAt: Date;
  updatedAt?: Date;
  lastMessage?: ChatMessage;
  unreadCount: number;
  participants: ConversationParticipant[];
  metadata?: Record<string, string>;
}
```

### `ChatMessage`

Represents an individual message.

```typescript
interface ChatMessage {
  id: string;
  conversationId: string;
  type: 'text' | 'html' | 'system' | 'image' | 'file';
  content: string;
  sender: ChatUser;
  createdAt: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  attachments?: FileAttachment[];
  metadata?: Record<string, string>;
}
```

### `ChatParticipant`

```typescript
interface ChatParticipant extends ChatUser {
  role?: 'admin' | 'member' | 'guest';
  joinedAt?: Date;
}
```

### `ChatError`

Standardized error structure.

```typescript
interface ChatError {
  code: ChatErrorCode;
  message: string;
  details?: unknown;
  retryable?: boolean;
}
```
