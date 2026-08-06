# React + TypeScript ACS Chat Library — Implementation Plan

> **Version**: 1.0  
> **Date**: 2026-08-03  
> **Status**: Draft — Awaiting Review

---

## Table of Contents

1. [Mục tiêu tổng quan](#1-mục-tiêu-tổng-quan)
2. [Phân tích Azure Communication Services](#2-phân-tích-azure-communication-services)
3. [Overall Architecture](#3-overall-architecture)
4. [Layer Architecture](#4-layer-architecture)
5. [Conversation Management](#5-conversation-management)
6. [1-1 Conversation](#6-1-1-conversation)
7. [Group Conversation](#7-group-conversation)
8. [Group Roles & Permissions](#8-group-roles--permissions)
9. [Conversation List](#9-conversation-list)
10. [Conversation State](#10-conversation-state)
11. [Conversation Realtime Events](#11-conversation-realtime-events)
12. [Public Conversation API](#12-public-conversation-api)
13. [Direct vs Group Architecture Decision](#13-direct-vs-group-architecture-decision)
14. [Backend vs React Library vs ACS Responsibility Matrix](#14-backend-vs-react-library-vs-acs-responsibility-matrix)
15. [Chat Client Initialization](#15-chat-client-initialization)
16. [Authentication & Token Lifecycle](#16-authentication--token-lifecycle)
17. [Message Management](#17-message-management)
18. [Message Pagination](#18-message-pagination)
19. [Read Receipt](#19-read-receipt)
20. [Typing Indicator](#20-typing-indicator)
21. [Realtime Event Architecture](#21-realtime-event-architecture)
22. [State Management](#22-state-management)
23. [Connection & Reconnection](#23-connection--reconnection)
24. [Error Handling](#24-error-handling)
25. [UI Components](#25-ui-components)
26. [UI Customization](#26-ui-customization)
27. [TypeScript API](#27-typescript-api)
28. [Package Architecture](#28-package-architecture)
29. [Public Package API](#29-public-package-api)
30. [Attachment / File](#30-attachment--file)
31. [Security](#31-security)
32. [Performance](#32-performance)
33. [Testing Strategy](#33-testing-strategy)
34. [Implementation Phases](#34-implementation-phases)
35. [Definition of Done](#35-definition-of-done)
36. [Open Questions / Decisions Required](#36-open-questions--decisions-required)
37. [Recommended Architecture](#37-recommended-architecture)

---

## 1. Mục tiêu tổng quan

Xây dựng một **reusable React Chat Library** sử dụng **TypeScript** và **Azure Communication Services (ACS)** làm nền tảng chat. Thư viện phải:

- **Production-ready** — đủ tin cậy để tích hợp vào nhiều React application khác nhau.
- **TypeScript-first** — mọi public API đều type-safe, có IntelliSense.
- **Tách biệt ACS SDK** — ứng dụng tiêu thụ thư viện không cần biết ACS tồn tại.
- **Layered architecture** — UI / hooks / domain / state / adapter tách rời rõ ràng.
- Hỗ trợ **1-1 chat**, **group chat**, **realtime messaging**, **pagination**, **read receipt**, **typing indicator**, **message lifecycle** (send/edit/delete), **participant management**, **authentication/token lifecycle**, **reconnect**.
- **Extensible** và cho phép application **custom UI**.

---

## 2. Phân tích Azure Communication Services

### 2.1 Packages cần sử dụng

| Package | Purpose |
|---|---|
| `@azure/communication-chat` (v1.6.0) | Chat SDK — ChatClient, ChatThreadClient |
| `@azure/communication-common` | `AzureCommunicationTokenCredential`, CommunicationIdentifier |
| `@azure/communication-signaling` | Realtime signaling (peer dependency, auto-included in browser builds) |

> **Lưu ý**: `@azure/communication-identity` dùng trên **server-side only** để tạo user & token. React Library **KHÔNG** import package này.

### 2.2 ACS Capability Matrix

| Capability | ACS API/SDK | Input | Output | Realtime Event | Limitation |
|---|---|---|---|---|---|
| **Create Thread** | `ChatClient.createChatThread(request, options)` | `{ topic: string, metadata?: Record<string,string> }`, `{ participants: ChatParticipant[], idempotencyToken?: string }` | `CreateChatThreadResult { chatThread: ChatThreadProperties, errors?: ChatError[] }` | `chatThreadCreated` (fired to all participants) | Max 250 participants per thread. Metadata max 1KB total. Max 200 participants per batch add. |
| **Delete Thread** | `ChatClient.deleteChatThread(threadId)` | `threadId: string` | `void` | `chatThreadDeleted` | Deletes for ALL participants (not per-user). |
| **List Threads** | `ChatClient.listChatThreads(options?)` | `{ maxPageSize?: number, startTime?: Date }` | `PagedAsyncIterableIterator<ChatThreadItem>` where `ChatThreadItem { id, topic, lastMessageReceivedOn?, deletedOn? }` | N/A | Does **NOT** return: lastMessage content, unreadCount, participants, metadata. Only returns threads where current user is a participant. |
| **Get Thread Properties** | `ChatThreadClient.getProperties()` | N/A | `ChatThreadProperties { id, topic, createdOn, createdBy, deletedOn?, metadata? }` | `chatThreadPropertiesUpdated` | Does NOT return participants. |
| **Update Thread Topic** | `ChatThreadClient.updateTopic(topic)` | `topic: string` | `void` | `chatThreadPropertiesUpdated` | — |
| **Send Message** | `ChatThreadClient.sendMessage(request, options?)` | `{ content: string }`, `{ senderDisplayName?: string, type?: 'text'\|'html', metadata?: Record<string,string> }` | `SendChatMessageResult { id: string }` | `chatMessageReceived` | Max message size ~28KB. |
| **Get Message** | `ChatThreadClient.getMessage(messageId)` | `messageId: string` | `ChatMessage` | N/A | — |
| **List Messages** | `ChatThreadClient.listMessages(options?)` | `{ maxPageSize?: number, startTime?: Date }` | `PagedAsyncIterableIterator<ChatMessage>` | N/A | Max page size 200. Returns system messages (topicUpdated, participantAdded, etc.) alongside user messages. Messages returned newest-first. |
| **Update Message** | `ChatThreadClient.updateMessage(messageId, options)` | `messageId: string`, `{ content?: string, metadata?: Record<string,string> }` | `void` | `chatMessageEdited` | Can only update own messages. |
| **Delete Message** | `ChatThreadClient.deleteMessage(messageId)` | `messageId: string` | `void` | `chatMessageDeleted` | Can only delete own messages. Soft-delete (deletedOn set). |
| **Add Participants** | `ChatThreadClient.addParticipants(request)` | `{ participants: ChatParticipant[] }` where `ChatParticipant { id: CommunicationIdentifier, displayName?: string, shareHistoryTime?: Date }` | `AddChatParticipantsResult { invalidParticipants?: ChatError[] }` | `participantsAdded` | Max 200 per batch. |
| **Remove Participant** | `ChatThreadClient.removeParticipant(identifier)` | `CommunicationIdentifier` | `void` | `participantsRemoved` | — |
| **List Participants** | `ChatThreadClient.listParticipants(options?)` | `{ maxPageSize?: number, skip?: number }` | `PagedAsyncIterableIterator<ChatParticipant>` | N/A | — |
| **Send Read Receipt** | `ChatThreadClient.sendReadReceipt(request)` | `{ chatMessageId: string }` | `void` | `readReceiptReceived` | **NOT supported for threads >20 participants.** |
| **List Read Receipts** | `ChatThreadClient.listReadReceipts(options?)` | `{ maxPageSize?: number, skip?: number }` | `PagedAsyncIterableIterator<ChatMessageReadReceipt>` where `ChatMessageReadReceipt { chatMessageId, sender, readOn }` | N/A | **NOT supported for threads >20 participants.** |
| **Send Typing Notification** | `ChatThreadClient.sendTypingNotification(options?)` | `{ senderDisplayName?: string }` | `void` | `typingIndicatorReceived` | **NOT supported for threads >20 participants.** ACS auto-expires typing after ~8 seconds. |
| **Start Realtime Notifications** | `ChatClient.startRealtimeNotifications()` | N/A | `void` (opens WebSocket) | All events below | Client-side only. |
| **Stop Realtime Notifications** | `ChatClient.stopRealtimeNotifications()` | N/A | `void` | N/A | — |

### 2.3 Realtime Events

| Event Name | Payload Key Properties | When Fired |
|---|---|---|
| `chatMessageReceived` | `id, threadId, sender, senderDisplayName, message (content), type, createdOn, metadata, version, recipient, attachments` | New message in any thread user participates in |
| `chatMessageEdited` | `id, threadId, sender, senderDisplayName, message (content), editedOn, metadata, version` | Message edited |
| `chatMessageDeleted` | `id, threadId, sender, senderDisplayName, deletedOn, version` | Message deleted |
| `typingIndicatorReceived` | `threadId, sender, senderDisplayName, receivedOn` | Participant typing |
| `readReceiptReceived` | `threadId, chatMessageId, sender, readOn` | Participant reads message |
| `chatThreadCreated` | `threadId, properties (topic, createdBy, createdOn), participants` | Thread created |
| `chatThreadDeleted` | `threadId, deletedOn, deletedBy` | Thread deleted |
| `chatThreadPropertiesUpdated` | `threadId, properties (topic), updatedOn, updatedBy` | Thread topic/properties changed |
| `participantsAdded` | `threadId, participantsAdded, addedBy, addedOn` | Participants added |
| `participantsRemoved` | `threadId, participantsRemoved, removedBy, removedOn` | Participants removed |
| `realTimeNotificationConnected` | N/A | WebSocket connected |
| `realTimeNotificationDisconnected` | N/A | WebSocket disconnected |

### 2.4 ACS Message Types

`ChatMessage.type` values:

| Type | Description |
|---|---|
| `text` | Plain text user message |
| `html` | HTML user message |
| `topicUpdated` | System message — topic changed |
| `participantAdded` | System message — participant(s) added |
| `participantRemoved` | System message — participant(s) removed |

### 2.5 ChatMessage Properties

```ts
// ACS ChatMessage (from SDK)
interface ChatMessage {
  id: string;
  type: ChatMessageType;      // 'text' | 'html' | 'topicUpdated' | 'participantAdded' | 'participantRemoved'
  sequenceId: string;
  version: string;
  content: ChatMessageContent; // { message?: string, topic?: string, participants?: ChatParticipant[], initiator?: CommunicationIdentifier, attachments?: ChatAttachment[] }
  senderDisplayName?: string;
  createdOn: Date;
  sender?: CommunicationIdentifier;
  deletedOn?: Date;
  editedOn?: Date;
  metadata?: Record<string, string>;
}
```

### 2.6 ChatThreadItem Properties (from listChatThreads)

```ts
interface ChatThreadItem {
  id: string;
  topic: string;
  lastMessageReceivedOn?: Date;
  deletedOn?: Date;
  // NOTE: No lastMessage content, no unreadCount, no participants, no metadata
}
```

### 2.7 Giới hạn quan trọng của ACS

| Constraint | Value |
|---|---|
| Max participants per thread | 250 |
| Max message size | ~28KB |
| Max metadata size (thread) | 1KB |
| Max participants per batch add | 200 |
| Max page size for listMessages | 200 |
| Read receipts & typing — max participants | 20 (disabled for larger threads) |
| Message retention policy | 30-90 days (configurable at thread creation) |
| Token expiration | Default 24h (customizable 60-1440 minutes) |
| Typing indicator auto-expiry | ~8 seconds |
| Rate limit: Add/Remove participants | 10 ops per thread per 10s |
| Rate limit: Get thread / List threads | 50 ops per user per 10s |
| Rate limit: Get message | 50 ops per user per thread per 10s |
| HTTP 429 on rate limit exceeded | Must implement backoff |

### 2.8 Những gì ACS KHÔNG hỗ trợ trực tiếp

| Feature | ACS Support | Giải pháp |
|---|---|---|
| Direct conversation lookup (tìm thread giữa 2 user cụ thể) | ❌ NOT SUPPORTED | Backend phải quản lý mapping `(UserA, UserB) → threadId` |
| Prevent duplicate direct conversation | ❌ NOT SUPPORTED | Backend phải validate trước khi tạo thread |
| Unread count | ❌ NOT SUPPORTED (listChatThreads không trả về) | Backend hoặc Library tự tính dựa trên read receipt + local state |
| Last message content in thread list | ❌ NOT SUPPORTED (listChatThreads chỉ trả `lastMessageReceivedOn`) | Backend cache hoặc Library fetch riêng per-thread |
| Thread metadata in list | ❌ NOT SUPPORTED (listChatThreads không trả metadata) | Backend cache hoặc Library fetch per-thread via `getProperties()` |
| Group roles/permissions (owner/admin/member) | ❌ NOT SUPPORTED natively | Backend quản lý role mapping + validate permissions |
| File/image attachment | ❌ NOT SUPPORTED (chỉ text/html) | Backend + Azure Blob Storage + message metadata chứa file URL |
| Pin/Archive/Mute thread | ❌ NOT SUPPORTED | Backend per-user thread settings |
| Search messages | ❌ NOT SUPPORTED | Backend full-text search (Azure Cognitive Search hoặc tương đương) |
| Per-user thread delete (leave without deleting for others) | ❌ NOT SUPPORTED (`deleteChatThread` deletes for all) | Use `removeParticipant(self)` to "leave" |
| Offline message queue | ❌ NOT SUPPORTED | Library local queue + retry |
| Message reactions/emoji | ❌ NOT SUPPORTED | Backend + message metadata |
| Thread categories/tags | ❌ NOT SUPPORTED | Backend |
| User presence/online status | ❌ NOT SUPPORTED trong Chat SDK | Separate service hoặc Backend |

---

## 3. Overall Architecture

```
React Application
       │
       │  Uses library hooks/components
       ▼
┌──────────────────────────────────┐
│        React Chat Library        │
│                                  │
│  ┌────────────────────────────┐  │
│  │     UI Components          │  │
│  │  (ChatContainer, Lists...) │  │
│  └─────────────┬──────────────┘  │
│                │                 │
│  ┌─────────────▼──────────────┐  │
│  │     React Hooks            │  │
│  │  (useChat, useMessages...) │  │
│  └─────────────┬──────────────┘  │
│                │                 │
│  ┌─────────────▼──────────────┐  │
│  │     Chat Domain            │  │
│  │  (Business logic, mappers) │  │
│  └─────────────┬──────────────┘  │
│                │                 │
│  ┌─────────────▼──────────────┐  │
│  │     State Management       │  │
│  │  (Zustand stores)         │  │
│  └─────────────┬──────────────┘  │
│                │                 │
│  ┌─────────────▼──────────────┐  │
│  │     Chat Services          │  │
│  │  (Orchestration layer)     │  │
│  └─────────────┬──────────────┘  │
│                │                 │
│  ┌─────────────▼──────────────┐  │
│  │     ACS Adapter            │  │
│  │  (ACS SDK wrapper)        │  │
│  └─────────────┬──────────────┘  │
│                │                 │
└────────────────┼─────────────────┘
                 │
       ┌─────────┴─────────┐
       │                   │
       ▼                   ▼
 Application           Azure
   Backend          Communication
                     Services
```

### Responsibility Matrix

| Layer | Responsibility |
|---|---|
| **React Application** | Cung cấp token (thông qua backend call), mount `<ChatProvider>`, sử dụng hooks/components, custom UI nếu cần |
| **React Chat Library** | Toàn bộ chat logic: khởi tạo ACS client, quản lý state, provide hooks & UI components, xử lý realtime events, error handling, reconnect |
| **Application Backend** | Tạo ACS user identity, issue/refresh token, quản lý direct conversation mapping, group metadata mở rộng, roles/permissions, file storage, search, unread count persistence |
| **Azure Communication Services** | Thread CRUD, message CRUD, participant management, read receipts, typing indicators, realtime signaling (WebSocket), authentication |

---

## 4. Layer Architecture

```
src/
├── components/         # React UI components
│   ├── ChatProvider.tsx
│   ├── ChatContainer.tsx
│   ├── ConversationList/
│   ├── Conversation/
│   ├── MessageList/
│   ├── MessageItem/
│   ├── MessageInput/
│   ├── TypingIndicator/
│   ├── ReadReceipt/
│   ├── ParticipantList/
│   ├── ConnectionStatus/
│   ├── LoadingState/
│   ├── EmptyState/
│   └── ErrorState/
├── hooks/              # React hooks (public API)
│   ├── useChat.ts
│   ├── useConversations.ts
│   ├── useConversation.ts
│   ├── useMessages.ts
│   ├── useParticipants.ts
│   ├── useTypingIndicator.ts
│   ├── useReadReceipt.ts
│   └── useConnection.ts
├── providers/          # React context providers
│   └── ChatContext.tsx
├── store/              # State management (Zustand)
│   ├── chatStore.ts
│   ├── conversationStore.ts
│   ├── messageStore.ts
│   ├── participantStore.ts
│   ├── connectionStore.ts
│   └── selectors.ts
├── domain/             # Business logic, pure functions
│   ├── conversationDomain.ts
│   ├── messageDomain.ts
│   ├── participantDomain.ts
│   └── eventDomain.ts
├── services/           # Orchestration layer
│   ├── chatService.ts
│   ├── conversationService.ts
│   ├── messageService.ts
│   ├── participantService.ts
│   ├── typingService.ts
│   ├── readReceiptService.ts
│   └── connectionService.ts
├── adapters/           # External integrations
│   └── acs/
│       ├── acsClientAdapter.ts
│       ├── acsThreadAdapter.ts
│       ├── acsEventAdapter.ts
│       └── acsMappers.ts
├── models/             # Domain models (library-internal)
│   ├── Conversation.ts
│   ├── Message.ts
│   ├── Participant.ts
│   ├── User.ts
│   └── ReadReceipt.ts
├── types/              # Public TypeScript types
│   ├── chat.types.ts
│   ├── conversation.types.ts
│   ├── message.types.ts
│   ├── participant.types.ts
│   ├── events.types.ts
│   ├── errors.types.ts
│   └── config.types.ts
├── utils/              # Utilities
│   ├── retry.ts
│   ├── debounce.ts
│   ├── throttle.ts
│   ├── id.ts
│   ├── date.ts
│   └── logger.ts
├── constants/
│   ├── events.ts
│   ├── errors.ts
│   └── defaults.ts
└── index.ts            # Public exports barrel
```

### Layer Responsibilities

| Layer | Responsibility | Can Import |
|---|---|---|
| **components/** | React UI rendering, event delegation to hooks | hooks/, types/, utils/ |
| **hooks/** | React interface, subscribe to store, call services | services/, store/, types/ |
| **providers/** | React Context setup, lifecycle | store/, services/, adapters/ |
| **store/** | State containers (Zustand), actions, selectors | models/, types/ |
| **domain/** | Pure business logic: validation, transformation, derivation | models/, types/, utils/ |
| **services/** | Orchestrate domain + adapter + store. Stateless coordinators | domain/, adapters/, store/, types/ |
| **adapters/acs/** | ACS SDK wrapper, model mapping, event normalization | `@azure/communication-chat`, `@azure/communication-common`, models/ |
| **models/** | Internal domain model interfaces/classes | types/ |
| **types/** | Public TypeScript type definitions | Nothing (leaf) |
| **utils/** | Pure utility functions | Nothing (leaf) |
| **constants/** | Constants, enums | Nothing (leaf) |

### Dependency Rule

```
Components → Hooks → Services → Domain + Adapters → ACS SDK
                               → Store
```

**Components KHÔNG BAO GIỜ import trực tiếp từ adapters/ hoặc ACS SDK.**

---

## 5. Conversation Management

### 5.1 Conversation Model

```ts
type ConversationType = 'direct' | 'group';

interface Conversation {
  id: string;                        // ACS Thread ID
  type: ConversationType;            // Library determines (based on metadata/backend)

  // From ACS
  topic: string;                     // ACS thread topic
  createdAt: Date;                   // ACS createdOn
  
  // From ACS (partially) + Library state
  participants: ChatParticipant[];   // ACS listParticipants() — lazily loaded
  
  // Library-maintained (local state)
  lastMessage?: ChatMessage;         // Maintained by library from events/API
  unreadCount: number;               // Calculated locally or from backend
  updatedAt?: Date;                  // lastMessage.createdAt or last event time
  
  // Group-specific (from ACS metadata or Backend)
  name?: string;                     // For group: explicit name. For direct: derived from other participant
  description?: string;              // Backend-managed or ACS metadata
  avatarUrl?: string;                // Backend-managed

  // Backend-managed (optional)
  metadata?: Record<string, string>; // Custom metadata from backend
  isPinned?: boolean;                // Backend per-user setting
  isMuted?: boolean;                 // Backend per-user setting
  isArchived?: boolean;              // Backend per-user setting
}
```

#### Field Origin Map

| Field | Source | Notes |
|---|---|---|
| `id` | ACS | Thread ID from `createChatThread` or `listChatThreads` |
| `type` | Backend + Library | ACS doesn't distinguish direct/group. Backend stores mapping, Library reads from metadata or backend API |
| `topic` | ACS | From `ChatThreadItem.topic` or `getProperties().topic` |
| `createdAt` | ACS | From `getProperties().createdOn` |
| `participants` | ACS | From `listParticipants()` — lazy loaded when conversation opened |
| `lastMessage` | Library (local) | Updated from realtime events and API calls. ACS `listChatThreads` only provides `lastMessageReceivedOn` (timestamp, not content) |
| `unreadCount` | Library (local) / Backend | ACS does NOT provide unread count. Library tracks locally based on read receipts, or Backend persists |
| `updatedAt` | Derived | `lastMessage?.createdAt` or latest event timestamp |
| `name` | Backend / ACS metadata | For direct: derived from other participant's displayName. For group: from ACS topic or backend |
| `description` | Backend | ACS thread metadata limited to 1KB, not ideal for description |
| `avatarUrl` | Backend | NOT in ACS |
| `isPinned/isMuted/isArchived` | Backend | Per-user settings, NOT in ACS |

### 5.2 Conversation Type Determination

ACS không phân biệt direct vs group thread. Strategy:

**Option 1 (Recommended): ACS Thread Metadata**
- Khi tạo thread, set `metadata: { type: 'direct' }` hoặc `metadata: { type: 'group' }`.
- Khi load thread properties via `getProperties()`, đọc metadata.
- **Limitation**: `listChatThreads()` không trả metadata → phải fetch per-thread hoặc cache.

**Option 2: Backend Mapping**
- Backend lưu `threadId → { type, ...extra metadata }`.
- Library gọi backend API để lấy conversation list kèm type.

**Recommendation**: Sử dụng **cả hai**:
- ACS thread metadata cho type determination khi đã mở conversation.
- Backend API cho enriched conversation list (type, unreadCount, lastMessage, etc.).

---

## 6. 1-1 Conversation

### 6.1 Business Flow

```
User A muốn chat với User B
        │
        ▼
Library gọi Backend API: POST /conversations/direct
        │ Body: { targetUserId: UserB.id }
        │
        ▼
Backend kiểm tra: đã có direct conversation giữa A ↔ B chưa?
        │
        ├── CÓ → Trả về existing threadId
        │
        └── CHƯA → Backend gọi ACS:
                    createChatThread({
                      topic: "Direct: A-B",
                      metadata: { type: 'direct', user1: A.acsId, user2: B.acsId }
                    }, {
                      participants: [A, B],
                      idempotencyToken: uuid()
                    })
                    │
                    ▼
                Backend lưu mapping:
                    direct_conversations: { user1, user2, threadId }
                    │
                    ▼
                Trả về threadId cho Library
        │
        ▼
Library nhận threadId
        │
        ▼
Library getChatThreadClient(threadId)
        │
        ▼
Load messages, subscribe events
        │
        ▼
Open conversation UI
```

### 6.2 Duplicate Prevention

**ACS KHÔNG hỗ trợ** query "tìm thread giữa 2 users cụ thể".

`listChatThreads()` trả về tất cả threads của user hiện tại, nhưng:
- Không filter theo participants.
- Không trả participant list.
- Phải iterate tất cả threads, fetch properties, rồi check participants → **không khả thi cho production**.

**→ Backend PHẢI quản lý mapping:**

```
Table: direct_conversations
┌───────────┬───────────┬──────────────┐
│ user_id_1 │ user_id_2 │ acs_thread_id│
├───────────┼───────────┼──────────────┤
│ userA     │ userB     │ thread_xyz   │
└───────────┴───────────┴──────────────┘

Constraint: UNIQUE (min(user_id_1, user_id_2), max(user_id_1, user_id_2))
```

**Library responsibility**:
- Gọi backend API để tìm hoặc tạo direct conversation.
- KHÔNG tự gọi ACS createChatThread cho direct conversation.

**Backend responsibility**:
- Validate request.
- Check existing mapping.
- Create ACS thread nếu chưa có.
- Return threadId.

### 6.3 Direct Conversation API

```ts
// Library provides this hook
const { createDirectConversation } = useConversations();

// Usage in application
const conversation = await createDirectConversation({
  targetUserId: 'user-b-id',
  displayName: 'User B' // Optional, for backend to set participant displayName
});
```

**Internal flow**:
1. Hook calls `conversationService.createDirectConversation(targetUserId)`.
2. Service calls backend API: `POST /api/conversations/direct`.
3. Backend creates or finds existing thread.
4. Backend returns `{ conversationId, threadId, type: 'direct', ... }`.
5. Service calls `acsAdapter.getChatThreadClient(threadId)`.
6. Service dispatches to store: `conversationStore.addConversation(conversation)`.
7. Hook returns conversation object.

### 6.4 ACS API Used

| Action | ACS API | Called By |
|---|---|---|
| Create direct thread | `chatClient.createChatThread()` | **Backend** (not library) |
| Get thread client | `chatClient.getChatThreadClient(threadId)` | Library adapter |
| Load messages | `chatThreadClient.listMessages()` | Library adapter |
| Send message | `chatThreadClient.sendMessage()` | Library adapter |
| Send read receipt | `chatThreadClient.sendReadReceipt()` | Library adapter |
| Send typing | `chatThreadClient.sendTypingNotification()` | Library adapter |

### 6.5 Error Cases

| Error | Cause | Handling |
|---|---|---|
| Backend API unreachable | Network issue | Retry with backoff, show error state |
| Target user not found | Invalid userId | Show "User not found" error |
| ACS thread creation fails | ACS service error | Backend retries, returns error to library |
| Token expired during creation | Token lifecycle | Refresh token, retry operation |
| Duplicate creation race condition | Two concurrent requests | Backend uses idempotencyToken + DB unique constraint |

### 6.6 Edge Cases

- User A mở app trên 2 devices, cả 2 tạo direct conversation cùng lúc → Backend unique constraint prevents duplicate.
- User A bị remove khỏi direct thread → Library receives `participantsRemoved` event → Update conversation state, show appropriate message.
- User B không tồn tại trong ACS → Backend phải tạo ACS identity cho User B trước.

---

## 7. Group Conversation

### 7.1 Lifecycle

```
Create Group
    ↓
Set Group Information (name/topic, description)
    ↓
Add Participants (at creation or later)
    ↓
Open Group → Load Messages
    ↓
Send / Receive Messages
    ↓
Manage Participants (add/remove)
    ↓
Update Group Info
    ↓
Leave Group (removeParticipant(self))
```

### 7.2 Group Operations

| Operation | ACS Support | Backend Required | Library Responsibility |
|---|---|---|---|
| **Create group** | ✓ `createChatThread()` | ✓ Store group metadata, roles | ✓ Orchestrate via backend API |
| **Get group info** | ✓ Partial (`getProperties()` → topic, metadata) | ✓ Extended metadata (description, avatarUrl) | ✓ Merge ACS + backend data |
| **Update group topic/name** | ✓ `updateTopic()` | ✗ | ✓ Call ACS via adapter |
| **Update group description** | ✗ NOT SUPPORTED (metadata 1KB limit) | ✓ Store in backend DB | ✓ Call backend API |
| **Update group avatar** | ✗ NOT SUPPORTED | ✓ Store URL in backend DB | ✓ Call backend API |
| **Delete group** | ✓ `deleteChatThread()` — deletes for ALL | ✓ Clean up backend data | ✓ Confirm destructive action |
| **Leave group** | ✓ `removeParticipant(self)` | ✓ Update backend state | ✓ Call adapter |
| **Add member** | ✓ `addParticipants()` | ✓ Validate permissions | ✓ Call adapter via backend |
| **Remove member** | ✓ `removeParticipant()` | ✓ Validate permissions | ✓ Call adapter via backend |
| **Get members** | ✓ `listParticipants()` | ✗ | ✓ Call adapter |
| **Group metadata (custom)** | ✓ Limited (1KB metadata) | ✓ For extended metadata | ✓ Merge sources |

### 7.3 Create Group Flow

```ts
// Library API
const { createGroupConversation } = useConversations();

const conversation = await createGroupConversation({
  name: 'Project Team',
  participants: [
    { userId: 'user-b', displayName: 'User B' },
    { userId: 'user-c', displayName: 'User C' },
  ],
  description: 'Team chat for Project X', // Optional
});
```

**Internal flow**:
1. Hook calls `conversationService.createGroupConversation(options)`.
2. Service calls backend: `POST /api/conversations/group`.
3. Backend validates permissions, resolves ACS identities.
4. Backend calls ACS: `createChatThread({ topic: name, metadata: { type: 'group' } }, { participants, idempotencyToken })`.
5. Backend stores extended metadata (description, roles).
6. Backend returns conversation data.
7. Service updates store.
8. Library subscribes to thread events.

### 7.4 Leave Group vs Delete Group

**Leave Group**: 
- `removeParticipant(currentUser)` — removes self from ACS thread.
- User no longer receives events for this thread.
- Thread continues for other participants.
- Library removes conversation from local state.

**Delete Group**: 
- `deleteChatThread(threadId)` — **deletes thread for ALL participants**.
- All participants receive `chatThreadDeleted` event.
- Library removes conversation from all local states.
- **Destructive action** — should require confirmation.
- Should be restricted to group owner/admin (backend validates).

### 7.5 Error Cases

| Error | Handling |
|---|---|
| Max participants exceeded (250) | Prevent add, show error |
| Invalid participant | Show which participants failed (from `invalidParticipants`) |
| Permission denied (add/remove member) | Backend rejects, show permission error |
| Thread deleted while user in it | `chatThreadDeleted` event → remove from state, show message |
| Rate limit (429) | Backoff retry |

---

## 8. Group Roles & Permissions

### 8.1 ACS Support

> **ACS KHÔNG hỗ trợ native role/permission system cho chat threads.**
> 
> Không có concept "owner", "admin", "member" trong ACS.
> Bất kỳ participant nào cũng có thể add/remove participants, update topic, delete messages (chỉ message của mình).

### 8.2 Backend Permission System

Backend phải implement permission layer:

```
Table: conversation_roles
┌─────────────────┬─────────┬────────┐
│ conversation_id │ user_id │ role   │
├─────────────────┼─────────┼────────┤
│ thread_abc      │ userA   │ owner  │
│ thread_abc      │ userB   │ admin  │
│ thread_abc      │ userC   │ member │
└─────────────────┴─────────┴────────┘
```

### 8.3 Permission Matrix

| Action | Owner | Admin | Member | Enforcement |
|---|:---:|:---:|:---:|---|
| Send message | ✓ | ✓ | ✓ | ACS (any participant can send) |
| Edit own message | ✓ | ✓ | ✓ | ACS (only own messages) |
| Delete own message | ✓ | ✓ | ✓ | ACS (only own messages) |
| Add member | ✓ | ✓ | ✗ | **Backend** validates before calling ACS |
| Remove member | ✓ | ✓ | ✗ | **Backend** validates before calling ACS |
| Update group info | ✓ | ✓ | ✗ | **Backend** validates before calling ACS |
| Delete group | ✓ | ✗ | ✗ | **Backend** validates before calling ACS |
| Leave group | ✓ | ✓ | ✓ | ACS (removeParticipant(self)) |
| Transfer ownership | ✓ | ✗ | ✗ | **Backend** only |

### 8.4 Library Role Implementation

```ts
// Library tracks roles for UI purposes
interface ConversationParticipant extends ChatParticipant {
  role?: 'owner' | 'admin' | 'member'; // From backend
}

// Hook provides permission check
const { canAddMember, canRemoveMember, canUpdateGroup, canDeleteGroup } = useConversationPermissions(conversationId);
```

**Flow for permission-gated action:**
```
User clicks "Remove Member"
        ↓
Library calls Backend: DELETE /api/conversations/{id}/participants/{userId}
        ↓
Backend checks: does caller have 'owner' or 'admin' role?
        ├── NO → 403 Forbidden
        └── YES → Backend calls ACS: removeParticipant()
                        ↓
                   Return success
                        ↓
                   Library updates store
```

---

## 9. Conversation List

### 9.1 Data Loading Strategy

Vì ACS `listChatThreads()` trả về rất ít data (chỉ id, topic, lastMessageReceivedOn, deletedOn):

**Recommended Strategy: Backend-first conversation list**

```
Library startup
       ↓
GET /api/conversations?page=1&limit=20
       ↓
Backend returns enriched list:
{
  conversations: [
    {
      id: 'thread_abc',
      type: 'direct',
      name: 'User B',
      lastMessage: { content: 'Hello!', createdAt: '...', sender: {...} },
      unreadCount: 3,
      participants: [{ id: '...', displayName: 'User B' }],
      updatedAt: '...',
      isPinned: false,
      isMuted: false,
    }
  ],
  pagination: { hasMore: true, cursor: '...' }
}
```

**Why not use ACS `listChatThreads()` as primary source:**
- Missing lastMessage content.
- Missing unreadCount.
- Missing conversation type.
- Missing metadata.
- Missing participant info.
- Would require N+1 queries to enrich each thread.

**ACS `listChatThreads()` can be used:**
- As fallback/sync mechanism.
- To detect threads created outside the app (e.g., via Teams interop).
- For initial sync when backend is unavailable.

### 9.2 API

```ts
const {
  conversations,         // Conversation[]
  activeConversation,    // Conversation | null
  loading,
  error,
  hasMore,
  
  // Actions
  loadConversations,     // () => Promise<void> — initial load
  loadMore,              // () => Promise<void> — pagination
  openConversation,      // (id: string) => void
  closeConversation,     // () => void
  createDirectConversation,  // (opts) => Promise<Conversation>
  createGroupConversation,   // (opts) => Promise<Conversation>
  deleteConversation,    // (id: string) => Promise<void>
  leaveConversation,     // (id: string) => Promise<void>
} = useConversations();
```

### 9.3 Sorting

Default sort: `updatedAt DESC` (most recently active conversation first).

```ts
// In store selector
const sortedConversations = useMemo(
  () => [...conversations].sort((a, b) => {
    // Pinned first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // Then by updatedAt DESC
    return (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0);
  }),
  [conversations]
);
```

### 9.4 Dữ liệu Source Map

| Data | Source | When Loaded |
|---|---|---|
| Conversation list + metadata | Backend API | Initial load, pagination |
| Real-time updates (new message, typing) | ACS Realtime Events | Continuous |
| Participant list (per conversation) | ACS `listParticipants()` | When conversation opened |
| Unread count | Backend or local calculation | Initial load + realtime update |
| Last message | Backend (initial) + ACS events (updates) | Initial load + realtime |

---

## 10. Conversation State

### 10.1 State Structure

```ts
interface ConversationState {
  // Normalized conversation storage
  conversations: Record<string, Conversation>;
  
  // Ordered list of conversation IDs (for display)
  conversationIds: string[];
  
  // Currently active/open conversation
  activeConversationId: string | null;
  
  // Loading states
  loading: boolean;
  loadingMore: boolean;
  
  // Pagination
  pagination: {
    hasMore: boolean;
    cursor?: string;
  };
  
  // Error
  error: ChatError | null;
}
```

### 10.2 State Updates on Events

**New Message Received:**
```
chatMessageReceived event
        ↓
Is message from current user? → Skip update (already handled optimistically)
        ↓
Update conversation:
  - conversation.lastMessage = newMessage
  - conversation.updatedAt = newMessage.createdAt
        ↓
Is conversation active?
  ├── YES → Do NOT increment unreadCount
  │         → Send read receipt (debounced)
  └── NO  → Increment unreadCount
        ↓
Re-sort conversationIds (move to top if not pinned-sort)
        ↓
React re-renders conversation list
```

**Conversation Opened:**
```
User clicks conversation
        ↓
Set activeConversationId
        ↓
Reset unreadCount to 0
        ↓
Load messages (if not cached)
        ↓
Load participants (if not cached)
        ↓
Send read receipt for latest message
```

**Conversation Closed:**
```
User navigates away
        ↓
Set activeConversationId = null
        ↓
Optionally: trim cached messages to save memory
```

---

## 11. Conversation Realtime Events

### 11.1 Event Handling Flow

```
ACS WebSocket
      ↓
chatClient.on('eventName', rawPayload)
      ↓
┌─────────────────────────────────┐
│  ACS Event Adapter              │
│  acsEventAdapter.ts             │
│                                 │
│  1. Normalize event payload     │
│  2. Map ACS types → Library     │
│  3. Emit domain event           │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│  Event Domain                   │
│  eventDomain.ts                 │
│                                 │
│  1. Validate event              │
│  2. Determine state changes     │
│  3. Apply business rules        │
└───────────────┬─────────────────┘
                ↓
┌─────────────────────────────────┐
│  Store Updates                  │
│  conversationStore / messageStore│
│                                 │
│  1. Update normalized state     │
│  2. Trigger selectors           │
└───────────────┬─────────────────┘
                ↓
         React Re-render
```

### 11.2 Event-to-State Mapping

| ACS Event | State Changes |
|---|---|
| `chatMessageReceived` | Add message to messageStore. Update conversation lastMessage, updatedAt. Increment unreadCount if not active. Re-sort conversation list. |
| `chatMessageEdited` | Update message content, editedAt in messageStore. Update lastMessage if was last message. |
| `chatMessageDeleted` | Set message deletedAt in messageStore. Update lastMessage if was last message. |
| `chatThreadCreated` | Add new conversation to conversationStore. |
| `chatThreadDeleted` | Remove conversation from conversationStore. If was active, close. |
| `chatThreadPropertiesUpdated` | Update conversation topic/name. |
| `participantsAdded` | Add participants to participantStore. Update conversation participant count. |
| `participantsRemoved` | Remove participants. If current user removed, remove conversation. |
| `typingIndicatorReceived` | Add to typingUsers map with timestamp. Auto-remove after timeout. |
| `readReceiptReceived` | Update read receipts in readReceiptStore. Update message read status. |
| `realTimeNotificationConnected` | Set connectionState = 'connected'. |
| `realTimeNotificationDisconnected` | Set connectionState = 'disconnected'. Trigger reconnect logic. |

---

## 12. Public Conversation API

### 12.1 useConversations()

```ts
interface UseConversationsReturn {
  // Data
  conversations: Conversation[];
  activeConversation: Conversation | null;
  loading: boolean;
  loadingMore: boolean;
  error: ChatError | null;
  hasMore: boolean;

  // Actions
  loadConversations: () => Promise<void>;
  loadMore: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  openConversation: (conversationId: string) => void;
  closeConversation: () => void;
  createDirectConversation: (options: CreateDirectConversationOptions) => Promise<Conversation>;
  createGroupConversation: (options: CreateGroupConversationOptions) => Promise<Conversation>;
  deleteConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => Promise<void>;
}

interface CreateDirectConversationOptions {
  targetUserId: string;
  displayName?: string;
}

interface CreateGroupConversationOptions {
  name: string;
  participants: Array<{ userId: string; displayName?: string }>;
  description?: string;
}
```

### 12.2 useConversation(conversationId)

```ts
interface UseConversationReturn {
  conversation: Conversation | null;
  loading: boolean;
  error: ChatError | null;

  // Group actions
  updateTopic: (topic: string) => Promise<void>;
  updateDescription: (description: string) => Promise<void>;
}
```

### 12.3 useConversationParticipants(conversationId)

```ts
interface UseConversationParticipantsReturn {
  participants: ConversationParticipant[];
  loading: boolean;
  error: ChatError | null;

  addParticipant: (userId: string, displayName?: string) => Promise<void>;
  removeParticipant: (userId: string) => Promise<void>;
  loadParticipants: () => Promise<void>;
}
```

---

## 13. Direct vs Group Architecture Decision

### 13.1 Option A: Unified Conversation

```ts
interface Conversation {
  id: string;
  type: 'direct' | 'group';
  // All fields available, some optional based on type
  name?: string;          // Group only
  description?: string;   // Group only
  // ...
}
```

### 13.2 Option B: Separate Types

```ts
interface DirectConversation {
  id: string;
  type: 'direct';
  otherParticipant: ChatParticipant;
  // Direct-specific fields
}

interface GroupConversation {
  id: string;
  type: 'group';
  name: string;
  description?: string;
  // Group-specific fields
}

type Conversation = DirectConversation | GroupConversation;
```

### 13.3 Evaluation

| Criteria | Option A (Unified) | Option B (Discriminated Union) |
|---|---|---|
| TypeScript type safety | ⚠️ Many optional fields, less strict | ✅ Type narrowing via discriminated union |
| API complexity | ✅ Simpler — one type everywhere | ⚠️ More types, type guards needed |
| Extensibility | ✅ Easy to add new types | ✅ Easy to add new variants |
| ACS compatibility | ✅ ACS treats all as ChatThread | ✅ Both work — mapping layer handles |
| UI complexity | ✅ Single component with conditional rendering | ⚠️ Potentially separate components per type |
| Business logic | ⚠️ Runtime checks for type-specific logic | ✅ Compile-time safety for type-specific logic |
| Maintainability | ✅ Less code duplication | ⚠️ Some duplication possible |

### 13.4 Recommendation: **Option B — Discriminated Union**

```ts
// Base interface
interface BaseConversation {
  id: string;
  type: ConversationType;
  createdAt: Date;
  updatedAt?: Date;
  lastMessage?: ChatMessage;
  unreadCount: number;
  participants: ConversationParticipant[];
  metadata?: Record<string, string>;
}

interface DirectConversation extends BaseConversation {
  type: 'direct';
  otherParticipant: ConversationParticipant; // Derived: the other user
}

interface GroupConversation extends BaseConversation {
  type: 'group';
  name: string;
  description?: string;
  avatarUrl?: string;
}

type Conversation = DirectConversation | GroupConversation;
```

**Rationale**:
- TypeScript discriminated unions enable `switch(conversation.type)` patterns with compile-time exhaustiveness checks.
- Direct conversations have a natural `otherParticipant` concept that group conversations don't.
- Group conversations have name/description/avatar that direct conversations don't.
- Minimal code overhead — shared `BaseConversation` prevents duplication.

---

## 14. Backend vs React Library vs ACS Responsibility Matrix

| Feature | Backend | React Library | ACS | Explanation |
|---|:---:|:---:|:---:|---|
| **Create ACS user identity** | ✓ | ✗ | ✓ | Backend calls `@azure/communication-identity` server-side |
| **Issue/refresh ACS token** | ✓ | ✗ | ✓ | Backend generates tokens; Library provides `tokenRefresher` callback |
| **Create direct thread** | ✓ | ✗ | ✓ | Backend validates uniqueness + calls ACS |
| **Find direct conversation** | ✓ | ✗ | ✗ | ACS cannot query threads by participants; Backend owns mapping |
| **Prevent duplicate direct chat** | ✓ | ✗ | ✗ | Backend DB unique constraint; ACS has no such concept |
| **Create group thread** | ✓ | ✗ | ✓ | Backend validates + calls ACS (or Library calls via backend) |
| **Group metadata (description, avatar)** | ✓ | ✗ | ✗ | ACS metadata limited to 1KB; Backend stores extended data |
| **Group roles/permissions** | ✓ | ✓ (display) | ✗ | Backend enforces; Library reads for UI |
| **Conversation list (enriched)** | ✓ | ✓ (consume) | ✓ (basic) | Backend provides enriched list; ACS provides basic thread list |
| **Unread count** | ✓ (persist) | ✓ (compute locally) | ✗ | ACS doesn't track; Library computes from events; Backend persists |
| **Last message in list** | ✓ (cache) | ✓ (realtime updates) | ✗ | ACS listChatThreads has no message content |
| **List participants** | ✗ | ✓ | ✓ | Library calls ACS directly |
| **Add/remove participants** | ✓ (validate) | ✓ (orchestrate) | ✓ | Backend validates permissions; Library calls ACS |
| **Send/receive messages** | ✗ | ✓ | ✓ | Pure ACS capability, Library wraps |
| **Edit/delete messages** | ✗ | ✓ | ✓ | ACS enforces own-message-only; Library wraps |
| **Message pagination** | ✗ | ✓ | ✓ | Library uses ACS `listMessages` with pagination |
| **Read receipt** | ✗ | ✓ | ✓ | Library calls ACS send/list read receipts |
| **Typing indicator** | ✗ | ✓ | ✓ | Library calls ACS sendTypingNotification |
| **Realtime events** | ✗ | ✓ | ✓ | Library subscribes via ACS ChatClient |
| **File/attachment upload** | ✓ | ✓ (UI) | ✗ | Backend stores files in Blob Storage; Library sends metadata via ACS message |
| **Search messages** | ✓ | ✓ (consume) | ✗ | Backend provides search API |
| **Pin/archive/mute** | ✓ | ✓ (consume) | ✗ | Backend per-user settings |
| **Connection management** | ✗ | ✓ | ✓ | Library manages WebSocket lifecycle |

---

## 15. Chat Client Initialization

### 15.1 ChatProvider

```tsx
interface ChatConfig {
  // Required
  endpoint: string;           // ACS resource endpoint URL
  userId: string;             // Current user's ACS Communication User ID
  displayName: string;        // Current user's display name
  
  // Token management
  token: string;              // Initial ACS access token
  tokenRefresher: () => Promise<string>; // Callback to refresh token
  
  // Optional: Backend integration
  backendUrl?: string;        // Backend API base URL
  backendHeaders?: Record<string, string>; // Auth headers for backend
  
  // Optional: Configuration
  reconnectPolicy?: ReconnectPolicy;
  logger?: ChatLogger;
}

// Usage
<ChatProvider config={chatConfig}>
  <ChatContainer />
</ChatProvider>
```

### 15.2 Initialization Flow

```
<ChatProvider> mounts
        ↓
1. Create AzureCommunicationTokenCredential
   with token + tokenRefresher + refreshProactively: true
        ↓
2. Create ChatClient(endpoint, credential)
        ↓
3. Start realtime notifications
   await chatClient.startRealtimeNotifications()
        ↓
4. Subscribe to all realtime events
   chatClient.on('chatMessageReceived', handler)
   chatClient.on('chatMessageEdited', handler)
   chatClient.on('chatMessageDeleted', handler)
   chatClient.on('typingIndicatorReceived', handler)
   chatClient.on('readReceiptReceived', handler)
   chatClient.on('chatThreadCreated', handler)
   chatClient.on('chatThreadDeleted', handler)
   chatClient.on('chatThreadPropertiesUpdated', handler)
   chatClient.on('participantsAdded', handler)
   chatClient.on('participantsRemoved', handler)
   chatClient.on('realTimeNotificationConnected', handler)
   chatClient.on('realTimeNotificationDisconnected', handler)
        ↓
5. Set connectionState = 'connected'
        ↓
6. Initialize stores with currentUser info
        ↓
7. Load initial conversation list
```

### 15.3 Cleanup (unmount)

```
<ChatProvider> unmounts
        ↓
1. Stop realtime notifications
   chatClient.stopRealtimeNotifications()
        ↓
2. Remove all event listeners
        ↓
3. Dispose AzureCommunicationTokenCredential
   credential.dispose()
        ↓
4. Clear all stores
        ↓
5. Set connectionState = 'disconnected'
```

### 15.4 Error Cases

| Error | Handling |
|---|---|
| Invalid endpoint | Throw `ChatError { code: 'INVALID_ENDPOINT', retryable: false }` |
| Invalid/expired token | Token refresh via `tokenRefresher` |
| `startRealtimeNotifications()` fails | Retry with backoff; set connectionState = 'error' |
| Network unavailable at init | Queue initialization; retry when online |
| Multiple ChatProvider instances | Warn in console; each instance independent |

---

## 16. Authentication & Token Lifecycle

### 16.1 Token Flow

```
React Application
        │
        │ (on app startup or login)
        ▼
Application Backend
        │
        │ POST /api/auth/communication-token
        │ Body: { userId: 'app-user-id' }
        │
        ▼
Backend:
  1. Lookup or create ACS User Identity
     CommunicationIdentityClient.createUser() or getToken(existingUser)
  2. Issue token with ['chat'] scope
     CommunicationIdentityClient.getToken(user, ['chat'])
  3. Return { acsUserId, token, expiresOn }
        │
        ▼
React Application receives:
  { acsUserId: '8:acs:xxx', token: 'eyJ...', expiresOn: '...' }
        │
        ▼
Pass to ChatProvider:
  <ChatProvider config={{
    endpoint: 'https://xxx.communication.azure.com',
    userId: acsUserId,
    token: token,
    tokenRefresher: async () => {
      const res = await fetch('/api/auth/communication-token', { ... });
      const { token } = await res.json();
      return token;
    },
    ...
  }}>
```

### 16.2 Token Refresh

**AzureCommunicationTokenCredential** handles automatic refresh:

```ts
// In ChatProvider initialization
const credential = new AzureCommunicationTokenCredential({
  tokenRefresher: async (abortSignal) => {
    const response = await fetch(backendUrl + '/api/auth/communication-token', {
      method: 'POST',
      headers: backendHeaders,
      signal: abortSignal,
    });
    const { token } = await response.json();
    return token;
  },
  refreshProactively: true, // SDK refreshes BEFORE expiry
  token: initialToken,      // Initial token
});
```

**Key behaviors**:
- `refreshProactively: true` → SDK calls `tokenRefresher` **before** token expires (typically ~10 minutes before).
- If proactive refresh fails → SDK retries on next API call.
- `tokenRefresher` receives `AbortSignal` for cancellation.

### 16.3 Token Security Rules

| Rule | Implementation |
|---|---|
| NEVER store ACS connection string on frontend | Backend only |
| NEVER store ACS secret/key on frontend | Backend only |
| Token stored only in memory (not localStorage) | `ChatProvider` holds credential in ref |
| Token refresh via secure backend endpoint | `tokenRefresher` calls authenticated backend API |
| Token scope limited to 'chat' | Backend issues with `['chat']` scope only |
| Short-lived tokens preferred | Backend can customize TTL (60-1440 min) |

### 16.4 Logout/Cleanup

```ts
// When user logs out
1. ChatProvider unmount triggers cleanup
2. credential.dispose() — cancels pending refresh
3. chatClient.stopRealtimeNotifications()
4. Clear all stores
5. Application discards token from memory
```

### 16.5 Error Cases

| Error | Handling |
|---|---|
| `tokenRefresher` returns expired token | SDK detects, calls refresher again |
| `tokenRefresher` throws/rejects | SDK propagates error → Library catches → Set connectionState = 'auth_error' |
| Backend auth endpoint down | Retry with backoff; after N failures, notify user |
| User session expired on backend | Backend returns 401 → Library emits `onAuthError` callback |
| Token with wrong scope | ACS rejects API calls → Library catches → Request new token |

---

## 17. Message Management

### 17.1 Message Model

```ts
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

type MessageType = 'text' | 'html' | 'system';

interface ChatMessage {
  id: string;                          // ACS message ID (or temporary client ID for optimistic)
  conversationId: string;              // ACS thread ID
  type: MessageType;                   // Mapped from ACS ChatMessageType
  
  content: string;                     // Message body text
  
  sender: ChatUser;                    // Mapped from ACS CommunicationIdentifier
  senderDisplayName?: string;
  
  createdAt: Date;                     // ACS createdOn
  editedAt?: Date;                     // ACS editedOn
  deletedAt?: Date;                    // ACS deletedOn
  
  status: MessageStatus;              // Library-computed
  
  metadata?: Record<string, string>;  // ACS metadata passthrough
  
  // System message specifics
  systemEvent?: {
    type: 'topicUpdated' | 'participantAdded' | 'participantRemoved';
    initiator?: ChatUser;
    participants?: ChatUser[];
    newTopic?: string;
  };
  
  // For optimistic updates
  clientMessageId?: string;           // Temporary ID before server confirms
}
```

### 17.2 Send Message Flow

```
User types message and hits Send
        ↓
1. Generate clientMessageId (uuid)
        ↓
2. Optimistic update:
   - Add message to messageStore with status: 'sending'
   - Update conversation lastMessage
   - Scroll to bottom
        ↓
3. Call ACS:
   chatThreadClient.sendMessage(
     { content: messageText },
     { senderDisplayName: currentUser.displayName, type: 'text', metadata }
   )
        ↓
4a. SUCCESS:
    - Receive { id: serverMessageId }
    - Replace clientMessageId with serverMessageId
    - Set status: 'sent'
    - When chatMessageReceived event arrives for own message: ignore duplicate
        ↓
4b. FAILURE:
    - Set status: 'failed'
    - Show retry button
    - Keep message in store
```

### 17.3 Edit Message Flow

```
User clicks Edit on own message
        ↓
1. Show edit UI (message input with existing content)
        ↓
2. User submits edit
        ↓
3. Optimistic update:
   - Update message content in store
   - Set editedAt to now
        ↓
4. Call ACS:
   chatThreadClient.updateMessage(messageId, { content: newContent })
        ↓
5a. SUCCESS → Keep optimistic state
5b. FAILURE → Revert to original content, show error
```

### 17.4 Delete Message Flow

```
User clicks Delete on own message
        ↓
1. Confirmation dialog
        ↓
2. Optimistic update:
   - Set deletedAt in store
   - Show "Message deleted" placeholder
        ↓
3. Call ACS:
   chatThreadClient.deleteMessage(messageId)
        ↓
4a. SUCCESS → Keep state
4b. FAILURE → Revert deletedAt, show error
```

### 17.5 Public API

```ts
interface UseMessagesReturn {
  messages: ChatMessage[];           // Ordered oldest → newest
  loading: boolean;                   // Initial load
  loadingMore: boolean;              // Loading older messages
  error: ChatError | null;
  hasMore: boolean;                  // More older messages available
  
  sendMessage: (content: string, options?: SendMessageOptions) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  retryMessage: (clientMessageId: string) => Promise<void>;
  loadMore: () => Promise<void>;     // Load older messages
}

interface SendMessageOptions {
  type?: 'text' | 'html';
  metadata?: Record<string, string>;
}
```

### 17.6 ACS API Mapping

| Library Method | ACS SDK Method | Notes |
|---|---|---|
| `sendMessage` | `chatThreadClient.sendMessage(request, options)` | Optimistic update before ACS call |
| `editMessage` | `chatThreadClient.updateMessage(messageId, options)` | Only own messages |
| `deleteMessage` | `chatThreadClient.deleteMessage(messageId)` | Only own messages, soft delete |
| `loadMore` | `chatThreadClient.listMessages(options)` | Cursor-based pagination |

### 17.7 Error Cases

| Error | Handling |
|---|---|
| Send fails (network) | Status → 'failed', show retry |
| Send fails (rate limit 429) | Backoff retry automatically |
| Edit message not found | Show error, refresh messages |
| Edit someone else's message | ACS rejects → show permission error |
| Delete someone else's message | ACS rejects → show permission error |
| Message too large (>28KB) | Validate before send, show error |

---

## 18. Message Pagination

### 18.1 Strategy: Cursor-based Reverse Pagination

ACS `listMessages()` returns messages **newest-first**. For chat UI, we need **oldest-first** display with "load more" at top.

```
┌──────────────────────────────┐
│  ↑ Load More (older)         │  ← User scrolls up
│  ─────────────────────────── │
│  Message 1 (oldest loaded)   │
│  Message 2                   │
│  Message 3                   │
│  ...                         │
│  Message N (newest)          │  ← Auto-scroll here
│  ─────────────────────────── │
│  [Message Input]             │
└──────────────────────────────┘
```

### 18.2 Implementation

```ts
// Message Store structure per conversation
interface ConversationMessages {
  messages: ChatMessage[];         // Ordered oldest → newest
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  
  // ACS pagination state
  oldestLoadedMessageId?: string;  // For cursor
  pageIterator?: AsyncIterableIterator<ChatMessage[]>; // ACS page iterator
}

// Store: messageStore
interface MessageState {
  messagesByConversation: Record<string, ConversationMessages>;
}
```

### 18.3 Initial Load Flow

```
Open conversation
        ↓
1. Create ChatThreadClient for thread
        ↓
2. Call listMessages({ maxPageSize: 50 })
        ↓
3. Get first page (newest messages)
        ↓
4. Filter: exclude system messages if needed
        ↓
5. Reverse order: newest-first → oldest-first
        ↓
6. Store messages
        ↓
7. Store page iterator for next page
        ↓
8. Set hasMore = iterator has more pages
        ↓
9. Scroll to bottom
```

### 18.4 Load More (Older Messages) Flow

```
User scrolls to top / clicks "Load More"
        ↓
1. Set loadingMore = true
        ↓
2. Capture current scroll position
        ↓
3. Get next page from stored iterator
        ↓
4. Filter system messages
        ↓
5. Reverse order
        ↓
6. Prepend to existing messages
        ↓
7. Deduplicate (by message ID)
        ↓
8. Set hasMore = iterator has more
        ↓
9. Restore scroll position (so view doesn't jump)
        ↓
10. Set loadingMore = false
```

### 18.5 New Message (Realtime) + Pagination Sync

**Problem**: When user is viewing old messages (scrolled up) and new message arrives.

```
Current state: user scrolled up, viewing message 20-40 of 100
New message arrives (message 101)
        ↓
Strategy:
1. Append message 101 to messages array
2. Do NOT auto-scroll (user is reading old messages)
3. Show "New message ↓" indicator at bottom
4. User clicks indicator → scroll to bottom
5. If user is already at bottom → auto-scroll
```

**Duplicate Prevention**:
```ts
// Before adding any message to store
function addMessage(conversationId: string, message: ChatMessage) {
  const existing = state.messagesByConversation[conversationId]?.messages;
  
  // Check by server ID
  if (existing?.some(m => m.id === message.id)) return; // Duplicate
  
  // Check by clientMessageId (optimistic update already in store)
  if (message.clientMessageId && existing?.some(m => m.clientMessageId === message.clientMessageId)) {
    // Replace optimistic with server-confirmed
    replaceMessage(conversationId, message.clientMessageId, message);
    return;
  }
  
  // Add and sort by createdAt
  appendMessage(conversationId, message);
}
```

### 18.6 Message Ordering

```ts
// Messages are ordered by sequenceId (ACS provides) or createdAt
messages.sort((a, b) => {
  // Use sequenceId if available (more reliable than timestamp)
  if (a.sequenceId && b.sequenceId) {
    return parseInt(a.sequenceId) - parseInt(b.sequenceId);
  }
  return a.createdAt.getTime() - b.createdAt.getTime();
});
```

---

## 19. Read Receipt

### 19.1 When to Send Read Receipt

| Trigger | Condition | Action |
|---|---|---|
| Open conversation | Messages exist | Send read receipt for latest message |
| New message arrives | Conversation is active AND user at bottom | Send read receipt for new message |
| User scrolls to bottom | Was viewing older messages | Send read receipt for latest visible message |
| App returns to foreground | Active conversation exists | Send read receipt for latest message |

### 19.2 Read Receipt Flow

```
Determine latest readable message
        ↓
Is it already read (receipt sent)?
  ├── YES → Skip
  └── NO →
        ↓
Debounce (300ms)
        ↓
Call ACS: chatThreadClient.sendReadReceipt({ chatMessageId: latestMessageId })
        ↓
Update local state: mark messages as read
```

### 19.3 Receiving Read Receipts

```
readReceiptReceived event
        ↓
Extract: { threadId, chatMessageId, sender, readOn }
        ↓
Is sender === currentUser?
  ├── YES → Skip (own receipt)
  └── NO →
        ↓
Store in readReceiptStore:
  readReceipts[threadId][sender.id] = { messageId, readOn }
        ↓
Compute per-message read status:
  For message M, "read" = at least one other participant's latest receipt >= M.id
        ↓
React re-renders read indicators
```

### 19.4 Debounce/Throttle Strategy

```ts
// Read receipt sender — debounced to avoid flooding ACS
const sendReadReceipt = debounce(async (conversationId: string, messageId: string) => {
  const chatThreadClient = adapter.getChatThreadClient(conversationId);
  await chatThreadClient.sendReadReceipt({ chatMessageId: messageId });
}, 300);

// Additional optimization: only send if messageId changed
let lastSentReceiptId: Record<string, string> = {};

function maybeSendReadReceipt(conversationId: string, messageId: string) {
  if (lastSentReceiptId[conversationId] === messageId) return;
  lastSentReceiptId[conversationId] = messageId;
  sendReadReceipt(conversationId, messageId);
}
```

### 19.5 ACS Limitations

- **Read receipts NOT supported for threads with >20 participants.**
- Library MUST check participant count before sending/displaying read receipts.
- When participants > 20: hide read receipt UI, skip sending.

### 19.6 API

```ts
interface UseReadReceiptReturn {
  // Per-message read status
  getMessageReadStatus: (messageId: string) => {
    readBy: Array<{ user: ChatUser; readOn: Date }>;
    isReadByAll: boolean;
  };
  
  // Are read receipts supported for this conversation?
  readReceiptsSupported: boolean;
  
  // Manual send (usually automatic)
  sendReadReceipt: (messageId: string) => Promise<void>;
}
```

---

## 20. Typing Indicator

### 20.1 Sending Typing Indicator

```
User starts typing in message input
        ↓
Throttle: has 8+ seconds passed since last send?
  ├── NO → Skip (ACS auto-expires after ~8s)
  └── YES →
        ↓
Call ACS: chatThreadClient.sendTypingNotification({ senderDisplayName })
        ↓
Reset throttle timer
```

### 20.2 Receiving Typing Indicator

```
typingIndicatorReceived event
        ↓
Extract: { threadId, sender, senderDisplayName, receivedOn }
        ↓
Is sender === currentUser?
  ├── YES → Skip
  └── NO →
        ↓
Add to typingUsers store:
  typingUsers[threadId][sender.id] = { displayName, timestamp }
        ↓
Set auto-remove timer (8 seconds)
        ↓
After 8s with no new typing event from same user:
  Remove from typingUsers store
        ↓
React re-renders: "User B is typing..." or "User B, User C are typing..."
```

### 20.3 Cleanup

```ts
// On conversation close
clearTypingUsers(conversationId);

// On component unmount
clearAllTimers();

// On connection lost
clearAllTypingUsers(); // Stale data
```

### 20.4 ACS Limitations

- **Typing indicators NOT supported for threads with >20 participants.**
- ACS auto-expires typing after ~8 seconds — Library should match this timeout.
- `sendTypingNotification()` can fail silently; no critical error handling needed.

### 20.5 API

```ts
interface UseTypingIndicatorReturn {
  // Who is currently typing in this conversation
  typingUsers: Array<{ user: ChatUser; startedAt: Date }>;
  
  // Display string: "User B is typing..." or "User B, User C are typing..."
  typingDisplayText: string | null;
  
  // Are typing indicators supported?
  typingSupported: boolean;
  
  // Trigger typing notification (called from MessageInput on change)
  sendTyping: () => void;
}
```

---

## 21. Realtime Event Architecture

### 21.1 Event Registration

```ts
// In ACS Event Adapter — called once during ChatProvider initialization

class AcsEventAdapter {
  private chatClient: ChatClient;
  private handlers: Map<string, Function> = new Map();

  subscribeAll(): void {
    const events = [
      'chatMessageReceived',
      'chatMessageEdited',
      'chatMessageDeleted',
      'typingIndicatorReceived',
      'readReceiptReceived',
      'chatThreadCreated',
      'chatThreadDeleted',
      'chatThreadPropertiesUpdated',
      'participantsAdded',
      'participantsRemoved',
      'realTimeNotificationConnected',
      'realTimeNotificationDisconnected',
    ] as const;

    for (const event of events) {
      const handler = (payload: any) => this.handleEvent(event, payload);
      this.handlers.set(event, handler);
      this.chatClient.on(event, handler);
    }
  }

  unsubscribeAll(): void {
    for (const [event, handler] of this.handlers) {
      this.chatClient.off(event, handler as any);
    }
    this.handlers.clear();
  }

  private handleEvent(eventName: string, rawPayload: any): void {
    // 1. Normalize
    const domainEvent = this.normalize(eventName, rawPayload);
    
    // 2. Dispatch to event bus / service layer
    this.eventBus.emit(domainEvent);
  }
}
```

### 21.2 Event Normalization

```ts
// ACS Event → Library Domain Event

interface ChatDomainEvent {
  type: ChatEventType;
  conversationId: string;
  timestamp: Date;
  payload: unknown;
}

type ChatEventType =
  | 'message:received'
  | 'message:edited'
  | 'message:deleted'
  | 'typing:started'
  | 'readReceipt:received'
  | 'conversation:created'
  | 'conversation:deleted'
  | 'conversation:updated'
  | 'participant:added'
  | 'participant:removed'
  | 'connection:connected'
  | 'connection:disconnected';

// Mapper example
function normalizeMessageReceived(acsEvent: any): ChatDomainEvent {
  return {
    type: 'message:received',
    conversationId: acsEvent.threadId,
    timestamp: new Date(acsEvent.createdOn),
    payload: {
      id: acsEvent.id,
      content: acsEvent.message,
      sender: mapAcsIdentifier(acsEvent.sender),
      senderDisplayName: acsEvent.senderDisplayName,
      type: acsEvent.type === 'RichText/Html' ? 'html' : 'text',
      metadata: acsEvent.metadata,
      createdAt: new Date(acsEvent.createdOn),
    },
  };
}
```

### 21.3 Event-to-State Flow

```
ACS Event Adapter
       ↓
    Normalize
       ↓
Event Domain Service
       ↓
  ┌────┴────────────────────────────────┐
  │                                     │
  ▼                                     ▼
messageStore.dispatch()          conversationStore.dispatch()
  │                                     │
  ▼                                     ▼
Message state updated            Conversation state updated
  │                                     │
  ▼                                     ▼
useMessages() re-renders         useConversations() re-renders
```

### 21.4 Duplicate Listener Prevention

```ts
// Ensure subscribeAll() is called only once
private subscribed = false;

subscribeAll(): void {
  if (this.subscribed) {
    console.warn('Event listeners already subscribed');
    return;
  }
  // ... subscribe
  this.subscribed = true;
}
```

### 21.5 Reconnect Re-subscription

```
realTimeNotificationDisconnected
        ↓
Set connectionState = 'disconnected'
        ↓
Wait for reconnect...
        ↓
realTimeNotificationConnected (OR manual startRealtimeNotifications)
        ↓
Set connectionState = 'connected'
        ↓
Event listeners are automatically restored by ACS SDK
        ↓
Resync: fetch latest messages for active conversation
        (to catch messages missed during disconnect)
```

---

## 22. State Management

### 22.1 Evaluation

| Solution | Performance | Re-render Control | External Store | Bundle Size | Learning Curve |
|---|---|---|---|---|---|
| **React Context** | ❌ All consumers re-render on any change | ❌ Poor without split contexts | ❌ React-only | ✅ 0KB | ✅ Low |
| **Zustand** | ✅ Selector-based, minimal re-renders | ✅ Excellent — subscriptions | ✅ Works outside React | ✅ ~1KB | ✅ Low |
| **Redux Toolkit** | ✅ Good with selectors | ✅ Good | ✅ External | ⚠️ ~11KB | ⚠️ Medium |
| **Custom EventEmitter Store** | ✅ Full control | ✅ Full control | ✅ External | ✅ ~0.5KB | ⚠️ Medium |

### 22.2 Recommendation: **Zustand**

**Reasons**:
1. **Minimal re-renders** — hooks subscribe to specific state slices, not the entire store.
2. **External store** — services can update state without React context.
3. **Tiny bundle** — ~1KB gzipped.
4. **No boilerplate** — much less code than Redux.
5. **Works with React concurrent mode**.
6. **Easy to test** — stores are plain objects.
7. **Supports middleware** (devtools, persist, etc.).

### 22.3 Store Structure

```ts
// Main Chat Store
interface ChatStore {
  // Current user
  currentUser: ChatUser | null;
  
  // Connection
  connectionState: ConnectionState; // 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error'
  
  // Global loading/error
  initializing: boolean;
  initError: ChatError | null;
}

// Conversation Store
interface ConversationStore {
  conversations: Record<string, Conversation>;
  conversationIds: string[];
  activeConversationId: string | null;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  cursor: string | null;
  error: ChatError | null;
  
  // Actions
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  // ... more actions
}

// Message Store
interface MessageStore {
  messagesByConversation: Record<string, {
    messages: ChatMessage[];
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: ChatError | null;
  }>;
  
  // Actions
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  prependMessages: (conversationId: string, messages: ChatMessage[]) => void;
  // ...
}

// Participant Store
interface ParticipantStore {
  participantsByConversation: Record<string, ConversationParticipant[]>;
  
  // Typing
  typingUsers: Record<string, Record<string, { displayName: string; timestamp: Date }>>;
  
  // Read Receipts
  readReceipts: Record<string, Record<string, { messageId: string; readOn: Date }>>;
}
```

### 22.4 Selector Examples

```ts
// Efficient selectors to prevent unnecessary re-renders
const useActiveConversation = () => useConversationStore(
  (state) => state.activeConversationId 
    ? state.conversations[state.activeConversationId] 
    : null
);

const useConversationMessages = (conversationId: string) => useMessageStore(
  (state) => state.messagesByConversation[conversationId]?.messages ?? []
);

const useTypingUsers = (conversationId: string) => useParticipantStore(
  (state) => Object.values(state.typingUsers[conversationId] ?? {})
);
```

---

## 23. Connection & Reconnection

### 23.1 Connection States

```ts
type ConnectionState = 
  | 'connecting'     // Initial startup
  | 'connected'      // WebSocket active
  | 'disconnected'   // WebSocket dropped
  | 'reconnecting'   // Attempting reconnect
  | 'error';         // Failed to connect/reconnect
```

### 23.2 State Machine

```
                  startup
                     │
                     ▼
              ┌──────────────┐
              │  connecting   │
              └──────┬───────┘
                     │
           ┌─────────┴─────────┐
           ▼                   ▼
    ┌──────────────┐    ┌───────────┐
    │  connected   │    │   error   │
    └──────┬───────┘    └───────────┘
           │                   ▲
    disconnect event           │ max retries exceeded
           │                   │
           ▼                   │
    ┌──────────────┐    ┌──────┴──────┐
    │ disconnected │───►│ reconnecting│
    └──────────────┘    └──────┬──────┘
                               │
                        success│
                               │
                        ┌──────▼──────┐
                        │  connected  │
                        └─────────────┘
```

### 23.3 Reconnection Strategy

```ts
interface ReconnectPolicy {
  maxRetries: number;          // Default: 10
  initialDelayMs: number;      // Default: 1000
  maxDelayMs: number;          // Default: 30000
  backoffMultiplier: number;   // Default: 2
}

// Reconnect flow
async function reconnect(policy: ReconnectPolicy): Promise<void> {
  let attempt = 0;
  let delay = policy.initialDelayMs;
  
  while (attempt < policy.maxRetries) {
    setConnectionState('reconnecting');
    attempt++;
    
    try {
      // 1. Check if token needs refresh
      // (AzureCommunicationTokenCredential handles this)
      
      // 2. Restart realtime notifications
      await chatClient.startRealtimeNotifications();
      
      // 3. Re-subscribe events (if needed — ACS SDK may handle)
      
      // 4. Resync active conversation
      if (activeConversationId) {
        await resyncConversation(activeConversationId);
      }
      
      // 5. Refresh conversation list
      await refreshConversations();
      
      setConnectionState('connected');
      return;
    } catch (error) {
      delay = Math.min(delay * policy.backoffMultiplier, policy.maxDelayMs);
      await sleep(delay);
    }
  }
  
  setConnectionState('error');
}
```

### 23.4 Resync After Reconnect

```
Connected after disconnect
        ↓
1. Refresh conversation list from backend
   (catch any new conversations created while disconnected)
        ↓
2. For active conversation:
   a. Fetch latest messages since lastKnownMessageId
   b. Merge with existing messages (dedup by ID)
   c. Update unread counts
   d. Refresh participants
        ↓
3. Update connection state = 'connected'
```

### 23.5 Browser Online/Offline Detection

```ts
// In ConnectionService
function setupNetworkListeners(): void {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

function handleOffline(): void {
  setConnectionState('disconnected');
  // Don't attempt reconnect — no network
}

function handleOnline(): void {
  // Network restored — attempt reconnect
  reconnect(reconnectPolicy);
}

// Cleanup
function teardownNetworkListeners(): void {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
}
```

---

## 24. Error Handling

### 24.1 Unified Error Model

```ts
interface ChatError {
  code: ChatErrorCode;
  message: string;
  cause?: unknown;              // Original error
  operation?: string;           // Which operation failed
  conversationId?: string;      // Related conversation
  messageId?: string;           // Related message
  retryable: boolean;
  timestamp: Date;
}

type ChatErrorCode =
  // Auth
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_REFRESH_FAILED'
  | 'AUTH_UNAUTHORIZED'
  
  // Network
  | 'NETWORK_ERROR'
  | 'NETWORK_TIMEOUT'
  
  // ACS
  | 'ACS_SERVICE_ERROR'
  | 'ACS_RATE_LIMITED'
  | 'ACS_NOT_FOUND'
  
  // Permission
  | 'PERMISSION_DENIED'
  
  // Conversation
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_DELETED'
  | 'CONVERSATION_DUPLICATE'
  
  // Message
  | 'MESSAGE_NOT_FOUND'
  | 'MESSAGE_TOO_LARGE'
  | 'MESSAGE_SEND_FAILED'
  
  // Connection
  | 'CONNECTION_LOST'
  | 'CONNECTION_FAILED'
  | 'RECONNECT_FAILED'
  
  // General
  | 'UNKNOWN_ERROR'
  | 'INVALID_INPUT';
```

### 24.2 Error Classification

| ACS HTTP Status | ChatErrorCode | Retryable |
|---|---|---|
| 401 | AUTH_TOKEN_EXPIRED / AUTH_UNAUTHORIZED | ✓ (with token refresh) |
| 403 | PERMISSION_DENIED | ✗ |
| 404 | ACS_NOT_FOUND | ✗ |
| 429 | ACS_RATE_LIMITED | ✓ (with backoff) |
| 500-503 | ACS_SERVICE_ERROR | ✓ |
| Network Error | NETWORK_ERROR | ✓ |
| Timeout | NETWORK_TIMEOUT | ✓ |

### 24.3 Retry Strategy

```ts
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrors: ChatErrorCode[];
  }
): Promise<T> {
  let lastError: ChatError;
  let delay = options.initialDelay;
  
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = mapToChatError(error);
      
      if (!lastError.retryable || !options.retryableErrors.includes(lastError.code)) {
        throw lastError;
      }
      
      if (attempt < options.maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * options.backoffMultiplier, options.maxDelay);
      }
    }
  }
  
  throw lastError!;
}
```

### 24.4 Error Propagation

```
ACS SDK throws
        ↓
ACS Adapter catches → maps to ChatError
        ↓
Service catches → handles retryable, propagates non-retryable
        ↓
Hook catches → sets error in store
        ↓
Component renders error state OR ErrorBoundary catches
```

### 24.5 Application Error Callback

```ts
interface ChatConfig {
  // ...
  onError?: (error: ChatError) => void;     // Global error callback
  onAuthError?: (error: ChatError) => void;  // Auth-specific callback
}
```

---

## 25. UI Components

### 25.1 Core Components

```tsx
// 1. ChatProvider — Context/Store setup
<ChatProvider config={chatConfig}>
  {children}
</ChatProvider>

// 2. ChatContainer — Full chat UI layout
<ChatContainer
  className?: string
  style?: CSSProperties
  renderConversationList?: (props) => ReactNode
  renderConversation?: (props) => ReactNode
/>

// 3. ConversationList — Left sidebar
<ConversationList
  conversations: Conversation[]
  activeId?: string
  onSelect: (id: string) => void
  onLoadMore: () => void
  hasMore: boolean
  loading: boolean
  renderItem?: (conversation: Conversation) => ReactNode
  renderEmpty?: () => ReactNode
/>

// 4. ConversationItem — Single item in list
<ConversationItem
  conversation: Conversation
  isActive: boolean
  onClick: () => void
/>

// 5. MessageList — Chat messages area
<MessageList
  messages: ChatMessage[]
  currentUserId: string
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
  renderMessage?: (message: ChatMessage) => ReactNode
  renderSystemMessage?: (message: ChatMessage) => ReactNode
/>

// 6. MessageItem — Single message
<MessageItem
  message: ChatMessage
  isOwn: boolean
  onEdit?: (messageId: string) => void
  onDelete?: (messageId: string) => void
  onRetry?: (clientMessageId: string) => void
/>

// 7. MessageInput — Input area
<MessageInput
  onSend: (content: string) => void
  onTyping: () => void
  placeholder?: string
  disabled?: boolean
/>
```

### 25.2 Supporting Components

```tsx
// Typing Indicator
<TypingIndicator
  typingUsers: Array<{ user: ChatUser; startedAt: Date }>
/>

// Read Receipt
<ReadReceipt
  readBy: Array<{ user: ChatUser; readOn: Date }>
  isReadByAll: boolean
/>

// Participant List
<ParticipantList
  participants: ConversationParticipant[]
  currentUserId: string
  onAddParticipant?: () => void
  onRemoveParticipant?: (userId: string) => void
  renderItem?: (participant: ConversationParticipant) => ReactNode
/>

// Connection Status
<ConnectionStatus
  state: ConnectionState
  onRetry?: () => void
/>

// Loading State
<LoadingState message?: string />

// Empty State
<EmptyState
  type: 'no-conversations' | 'no-messages' | 'no-participants'
  message?: string
/>

// Error State
<ErrorState
  error: ChatError
  onRetry?: () => void
/>
```

---

## 26. UI Customization

### 26.1 Customization Approaches

| Approach | Use Case | Complexity |
|---|---|---|
| **CSS Variables** | Colors, fonts, spacing | Low |
| **className/style props** | Container styling | Low |
| **Render props** | Replace specific component renders | Medium |
| **Component overrides** | Replace entire components | Medium |
| **Headless hooks** | Build completely custom UI | High |

### 26.2 Recommendation: **Layered Approach**

1. **CSS Variables** for theming (default)
2. **Render props** for component-level customization
3. **Headless hooks** for full custom UI

### 26.3 CSS Variables

```css
:root {
  /* Colors */
  --chat-primary: #0078d4;
  --chat-primary-hover: #106ebe;
  --chat-bg: #ffffff;
  --chat-bg-secondary: #f5f5f5;
  --chat-text: #242424;
  --chat-text-secondary: #616161;
  --chat-border: #e0e0e0;
  
  /* Message bubbles */
  --chat-message-own-bg: #e1f5fe;
  --chat-message-other-bg: #f5f5f5;
  --chat-message-system-bg: transparent;
  
  /* Typography */
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --chat-font-size: 14px;
  --chat-font-size-sm: 12px;
  
  /* Spacing */
  --chat-spacing-xs: 4px;
  --chat-spacing-sm: 8px;
  --chat-spacing-md: 16px;
  
  /* Border radius */
  --chat-radius: 8px;
  --chat-radius-message: 12px;
}
```

### 26.4 Render Props Example

```tsx
// Application code — custom message rendering
<ChatContainer
  renderMessage={(message, defaultRender) => {
    if (message.metadata?.type === 'file') {
      return <CustomFileMessage message={message} />;
    }
    return defaultRender(message);
  }}
  
  renderConversationItem={(conversation, defaultRender) => {
    return (
      <div className="custom-item">
        {defaultRender(conversation)}
        <CustomBadge count={conversation.unreadCount} />
      </div>
    );
  }}
  
  renderMessageInput={(props) => (
    <CustomMessageInput {...props} enableFileUpload />
  )}
/>
```

### 26.5 Headless Hooks API

```tsx
// Application builds entirely custom UI using only hooks
function CustomChatApp() {
  const { conversations, openConversation } = useConversations();
  const { messages, sendMessage, loadMore } = useMessages(activeConversationId);
  const { typingUsers, sendTyping } = useTypingIndicator(activeConversationId);
  const { connectionState } = useConnection();
  
  // Complete custom rendering
  return <div>...</div>;
}
```

---

## 27. TypeScript API

### 27.1 Public Types

```ts
// User
interface ChatUser {
  id: string;                  // ACS Communication User ID
  displayName?: string;
}

// Participant
interface ChatParticipant extends ChatUser {
  joinedAt?: Date;
}

interface ConversationParticipant extends ChatParticipant {
  role?: 'owner' | 'admin' | 'member';
}

// Conversation (see Section 13 for full definition)
type ConversationType = 'direct' | 'group';
type Conversation = DirectConversation | GroupConversation;

// Message (see Section 17 for full definition)
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
type MessageType = 'text' | 'html' | 'system';
interface ChatMessage { /* ... */ }

// Connection
type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';

// Error
interface ChatError { /* see Section 24 */ }
type ChatErrorCode = /* see Section 24 */;

// Config
interface ChatConfig { /* see Section 15 */ }

// Events
type ChatEventType = /* see Section 21 */;
interface ChatDomainEvent { /* see Section 21 */ }
```

### 27.2 ACS Type Mapping

```
ACS Model                    →    Library Model
─────────────────────────────────────────────────
CommunicationIdentifier      →    ChatUser { id, displayName }
ChatThreadItem               →    Conversation (partial)
ChatThreadProperties         →    Conversation (full)
ChatMessage (ACS)             →    ChatMessage (Library)
ChatParticipant (ACS)         →    ConversationParticipant
ChatMessageReadReceipt        →    ReadReceipt { messageId, user, readOn }
ChatMessageType (ACS)         →    MessageType
```

### 27.3 Mapper Implementation

```ts
// adapters/acs/acsMappers.ts

export function mapAcsIdentifierToUser(
  identifier: CommunicationIdentifier,
  displayName?: string
): ChatUser {
  if ('communicationUserId' in identifier) {
    return {
      id: identifier.communicationUserId,
      displayName,
    };
  }
  // Handle other identifier types if needed
  return { id: String(identifier), displayName };
}

export function mapAcsMessageToMessage(
  acsMessage: AcsChatMessage,
  conversationId: string,
  currentUserId: string
): ChatMessage {
  const isSystem = ['topicUpdated', 'participantAdded', 'participantRemoved'].includes(acsMessage.type);
  
  return {
    id: acsMessage.id,
    conversationId,
    type: isSystem ? 'system' : (acsMessage.type as 'text' | 'html'),
    content: acsMessage.content?.message ?? '',
    sender: mapAcsIdentifierToUser(acsMessage.sender!, acsMessage.senderDisplayName),
    senderDisplayName: acsMessage.senderDisplayName,
    createdAt: acsMessage.createdOn,
    editedAt: acsMessage.editedOn ?? undefined,
    deletedAt: acsMessage.deletedOn ?? undefined,
    status: determineSendStatus(acsMessage, currentUserId),
    metadata: acsMessage.metadata,
    systemEvent: isSystem ? mapSystemEvent(acsMessage) : undefined,
  };
}

export function mapAcsThreadItemToConversation(
  threadItem: ChatThreadItem
): Partial<Conversation> {
  return {
    id: threadItem.id,
    topic: threadItem.topic,
    updatedAt: threadItem.lastMessageReceivedOn,
  };
}
```

---

## 28. Package Architecture

### 28.1 Dependency Boundaries

```
External Dependencies:
├── @azure/communication-chat (peer dependency)
├── @azure/communication-common (peer dependency)
├── react (peer dependency ≥ 18)
├── react-dom (peer dependency ≥ 18)
├── zustand (dependency)
└── uuid (dependency)
```

### 28.2 Circular Dependency Prevention

Rules:
1. **Leaf layers** (types/, utils/, constants/) import NOTHING from other layers.
2. **models/** imports only from types/.
3. **adapters/** imports only from models/, types/, and external SDKs.
4. **domain/** imports from models/, types/, utils/.
5. **store/** imports from models/, types/.
6. **services/** imports from domain/, adapters/, store/, types/ — this is the **orchestration layer**.
7. **hooks/** imports from services/, store/, types/.
8. **components/** imports from hooks/, types/.

No upward imports. No circular layer references.

### 28.3 Build Output

```
dist/
├── index.js          # CJS
├── index.mjs         # ESM
├── index.d.ts        # TypeScript declarations
└── styles.css        # Optional default styles
```

---

## 29. Public Package API

### 29.1 Exports

```ts
// src/index.ts

// Components
export { ChatProvider } from './components/ChatProvider';
export { ChatContainer } from './components/ChatContainer';
export { ConversationList } from './components/ConversationList';
export { MessageList } from './components/MessageList';
export { MessageInput } from './components/MessageInput';
export { MessageItem } from './components/MessageItem';
export { ConversationItem } from './components/ConversationList/ConversationItem';
export { TypingIndicator } from './components/TypingIndicator';
export { ReadReceipt } from './components/ReadReceipt';
export { ParticipantList } from './components/ParticipantList';
export { ConnectionStatus } from './components/ConnectionStatus';

// Hooks
export { useChat } from './hooks/useChat';
export { useConversations } from './hooks/useConversations';
export { useConversation } from './hooks/useConversation';
export { useMessages } from './hooks/useMessages';
export { useParticipants } from './hooks/useParticipants';
export { useTypingIndicator } from './hooks/useTypingIndicator';
export { useReadReceipt } from './hooks/useReadReceipt';
export { useConnection } from './hooks/useConnection';

// Types
export type {
  ChatConfig,
  ChatUser,
  ChatParticipant,
  ConversationParticipant,
  Conversation,
  DirectConversation,
  GroupConversation,
  ConversationType,
  ChatMessage,
  MessageStatus,
  MessageType,
  ConnectionState,
  ChatError,
  ChatErrorCode,
  ChatDomainEvent,
  ChatEventType,
  CreateDirectConversationOptions,
  CreateGroupConversationOptions,
  SendMessageOptions,
  ReconnectPolicy,
} from './types';
```

### 29.2 Internal API (NOT exported)

- All store internals (Zustand stores).
- ACS adapter classes.
- Service classes.
- Domain functions.
- ACS model mappers.
- Utility functions.

---

## 30. Attachment / File

### 30.1 ACS Support

> **ACS Chat SDK KHÔNG hỗ trợ native file/image attachment.**
> 
> ACS chỉ hỗ trợ text và HTML messages (max ~28KB).
> File phải được xử lý bên ngoài ACS.

### 30.2 Recommended Architecture

```
User selects file
        ↓
Library calls Backend: POST /api/files/upload
  Body: FormData (file)
        ↓
Backend:
  1. Validate file (type, size, virus scan)
  2. Upload to Azure Blob Storage
  3. Generate SAS URL (time-limited)
  4. Return { fileId, fileName, fileSize, mimeType, url, expiresAt }
        ↓
Library sends ACS message:
  chatThreadClient.sendMessage(
    { content: 'Shared a file' },
    {
      type: 'text',
      metadata: {
        attachmentType: 'file',
        fileId: 'xxx',
        fileName: 'document.pdf',
        fileSize: '1048576',
        mimeType: 'application/pdf',
        fileUrl: 'https://blob.../file?sas=...',
        thumbnailUrl: 'https://blob.../thumb?sas=...',
      }
    }
  )
        ↓
Receivers:
  chatMessageReceived event → check metadata.attachmentType
  If 'file' → render file preview/download component
```

### 30.3 File Types

| Type | Handling |
|---|---|
| Image (jpg, png, gif, webp) | Show preview/thumbnail inline |
| Document (pdf, docx, etc.) | Show file icon + name + download link |
| Video (mp4, etc.) | Show video player or thumbnail + download |
| Audio (mp3, etc.) | Show audio player |
| Other | Show generic file icon + download |

### 30.4 Security Considerations

- Backend validates file type and size before upload.
- SAS URLs have expiration (e.g., 24 hours).
- File access requires valid SAS token.
- Backend can revoke access by regenerating container SAS.
- Virus/malware scanning before storage (Azure Defender for Storage).

### 30.5 Library API

```ts
interface FileAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  expiresAt?: Date;
}

// The library provides a callback interface
interface ChatConfig {
  // ...
  onFileUpload?: (file: File) => Promise<FileAttachment>; // Application implements upload
}
```

---

## 31. Security

### 31.1 Frontend Responsibilities

| Concern | Implementation |
|---|---|
| Token storage | Memory only (no localStorage/sessionStorage) |
| Token refresh | Via authenticated backend endpoint |
| XSS prevention | Sanitize HTML messages before rendering (DOMPurify) |
| Input validation | Validate message content length client-side |
| CSP compliance | No inline scripts, proper Content-Security-Policy headers |
| File URL validation | Only render URLs from trusted domains |
| Error messages | Never expose internal errors to end users |

### 31.2 Backend Responsibilities

| Concern | Implementation |
|---|---|
| ACS credentials | Connection string/key ONLY on backend |
| Token issuance | Backend validates user session before issuing ACS token |
| Permission enforcement | Backend validates roles before ACS operations |
| File upload security | Validate type, size, virus scan |
| Rate limiting | Backend-level rate limiting for API endpoints |
| Input sanitization | Server-side validation of all inputs |
| Audit logging | Log chat actions for compliance |

### 31.3 Message Content Security

```ts
// When rendering HTML messages
import DOMPurify from 'dompurify';

function sanitizeMessageContent(content: string, type: MessageType): string {
  if (type === 'html') {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    });
  }
  // Plain text — escape HTML
  return escapeHtml(content);
}
```

---

## 32. Performance

### 32.1 Virtualized Message List

For conversations with many messages, render only visible messages:

```ts
// Recommended: react-virtuoso (supports reverse scrolling, prepend, scroll position)
import { Virtuoso } from 'react-virtuoso';

<Virtuoso
  data={messages}
  firstItemIndex={firstItemIndex}
  initialTopMostItemIndex={messages.length - 1}
  followOutput="smooth"
  itemContent={(index, message) => <MessageItem message={message} />}
  startReached={handleLoadMore}
/>
```

**Why react-virtuoso**: Supports reverse scroll (chat needs newest at bottom), dynamic item heights, scroll anchoring when prepending items.

### 32.2 Memoization Strategy

```ts
// Memoize expensive components
const MemoizedMessageItem = React.memo(MessageItem, (prev, next) => {
  return prev.message.id === next.message.id
    && prev.message.content === next.message.content
    && prev.message.status === next.message.status
    && prev.message.editedAt === next.message.editedAt
    && prev.message.deletedAt === next.message.deletedAt;
});

// Memoize derived data
const sortedConversations = useMemo(
  () => sortConversations(conversations),
  [conversations]
);
```

### 32.3 Event Batching

```ts
// Batch multiple rapid state updates
import { unstable_batchedUpdates } from 'react-dom';

function handleBulkMessages(messages: ChatMessage[]) {
  unstable_batchedUpdates(() => {
    for (const message of messages) {
      messageStore.addMessage(message.conversationId, message);
      conversationStore.updateLastMessage(message.conversationId, message);
    }
  });
}
```

### 32.4 Memory Management

```ts
// Limit cached messages per conversation
const MAX_CACHED_MESSAGES = 200;

function trimMessages(conversationId: string) {
  const messages = messageStore.getMessages(conversationId);
  if (messages.length > MAX_CACHED_MESSAGES) {
    // Keep newest messages, mark hasMore = true
    const trimmed = messages.slice(-MAX_CACHED_MESSAGES);
    messageStore.setMessages(conversationId, trimmed);
    messageStore.setHasMore(conversationId, true);
  }
}

// When switching conversations, trim inactive conversation messages
function onConversationChange(prevId: string | null, nextId: string) {
  if (prevId) {
    trimMessages(prevId);
  }
}
```

### 32.5 Recommended Libraries

| Library | Purpose | Size |
|---|---|---|
| `zustand` | State management | ~1KB gzip |
| `react-virtuoso` | Virtualized list | ~15KB gzip |
| `dompurify` | HTML sanitization | ~7KB gzip |
| `uuid` | Generate client message IDs | ~1KB gzip |

---

## 33. Testing Strategy

### 33.1 Unit Tests

| Target | What to Test | Tool |
|---|---|---|
| `acsMappers.ts` | ACS model → Library model mapping correctness | Vitest |
| `conversationDomain.ts` | Conversation sorting, filtering, type determination | Vitest |
| `messageDomain.ts` | Message ordering, dedup, status computation | Vitest |
| Store actions | State mutations, selectors | Vitest |
| `retry.ts` / `debounce.ts` | Utility behavior | Vitest |
| Error mapping | ACS errors → ChatError | Vitest |

### 33.2 Integration Tests

| Target | What to Test | Tool |
|---|---|---|
| `ChatProvider` | Initialization, cleanup, token refresh | Vitest + React Testing Library |
| `acsClientAdapter` | ACS SDK integration (with mocked SDK) | Vitest |
| `conversationService` | Create, open, close conversation flows | Vitest |
| `messageService` | Send, edit, delete, pagination flows | Vitest |
| Event handling | ACS event → state update flow | Vitest |
| Reconnection | Disconnect → reconnect → resync | Vitest |

### 33.3 Component Tests

| Component | What to Test | Tool |
|---|---|---|
| `ConversationList` | Renders conversations, handles click, load more | Vitest + React Testing Library |
| `MessageList` | Renders messages, scroll behavior, load more | Vitest + React Testing Library |
| `MessageInput` | Text input, send on Enter, typing indicator | Vitest + React Testing Library |
| `MessageItem` | Renders content, edit/delete actions, status indicators | Vitest + React Testing Library |
| `TypingIndicator` | Shows typing users, text formatting | Vitest + React Testing Library |

### 33.4 E2E Tests

```
Flow:
1. Login → Initialize ChatProvider
2. Load conversation list
3. Create direct conversation with User B
4. Open conversation
5. Load messages (empty)
6. Send message
7. Verify message appears with 'sent' status
8. [User B sends message] → Verify realtime message appears
9. Verify read receipt
10. Open/create group conversation
11. Add member to group
12. Send group message
13. Simulate disconnect → verify reconnect
14. Verify message resync after reconnect
```

Tool: Playwright or Cypress.

**Note**: E2E requires actual ACS resources or comprehensive mocks. Recommended to use ACS Test Resources for E2E.

---

## 34. Implementation Phases

### Phase 1 — Project Setup

#### Task 1.1 — Initialize Package

**Goal**: Set up React + TypeScript library project with build tooling.

**Changes**:
- `package.json` — dependencies, peer dependencies, scripts.
- `tsconfig.json` — strict TypeScript config.
- `vite.config.ts` — library build config (Vite Library Mode).
- `.eslintrc.js` — lint rules.
- `.prettierrc` — formatting.
- `vitest.config.ts` — test runner config.
- `src/index.ts` — barrel export.

**Dependencies**:
```json
{
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0",
    "@azure/communication-chat": "^1.6.0",
    "@azure/communication-common": "^2.0.0"
  },
  "dependencies": {
    "zustand": "^4.5.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "react-virtuoso": "^4.0.0",
    "dompurify": "^3.0.0"
  }
}
```

**Definition of Done**:
- [x] Project initialized with `package.json`.
- [x] TypeScript compiles without errors.
- [x] `npm run build` produces dist output.
- [x] `npm run test` runs (even with 0 tests).
- [x] `npm run lint` passes.
- [x] src/index.ts exports placeholder.

---

#### Task 1.2 — Directory Structure

**Goal**: Create all directories and placeholder files.

**Changes**: Create entire `src/` structure as defined in Section 4.

**Definition of Done**:
- [x] All directories created.
- [x] Each directory has at least one placeholder/index file.
- [x] No import errors.

---

### Phase 2 — TypeScript Types & Models

#### Task 2.1 — Define Public Types

**Goal**: Define all public TypeScript types.

**Changes**:
- `src/types/chat.types.ts` — ChatConfig, ChatUser, ConnectionState.
- `src/types/conversation.types.ts` — Conversation, DirectConversation, GroupConversation, ConversationType.
- `src/types/message.types.ts` — ChatMessage, MessageStatus, MessageType, SendMessageOptions.
- `src/types/participant.types.ts` — ChatParticipant, ConversationParticipant.
- `src/types/events.types.ts` — ChatEventType, ChatDomainEvent.
- `src/types/errors.types.ts` — ChatError, ChatErrorCode.
- `src/types/config.types.ts` — ChatConfig, ReconnectPolicy.

**Definition of Done**:
- [x] All types defined and exported.
- [x] TypeScript compiles.
- [x] Types documented with JSDoc.

---

#### Task 2.2 — Define Internal Models

**Goal**: Define internal domain models.

**Changes**:
- `src/models/Conversation.ts`
- `src/models/Message.ts`
- `src/models/Participant.ts`
- `src/models/User.ts`
- `src/models/ReadReceipt.ts`

**Definition of Done**:
- [x] Models defined.
- [x] Models align with public types.

---

### Phase 3 — ACS Adapter

#### Task 3.1 — ACS Client Adapter

**Goal**: Wrap ACS ChatClient initialization and lifecycle.

**Changes**:
- `src/adapters/acs/acsClientAdapter.ts`

**ACS API**:
- Package: `@azure/communication-chat`
- Class: `ChatClient`
- Methods: constructor, `createChatThread()`, `deleteChatThread()`, `getChatThreadClient()`, `listChatThreads()`, `startRealtimeNotifications()`, `stopRealtimeNotifications()`
- Package: `@azure/communication-common`
- Class: `AzureCommunicationTokenCredential`
- Constructor: `{ tokenRefresher, refreshProactively, token }`

**Library API**:
```ts
class AcsClientAdapter {
  constructor(endpoint: string, credential: AzureCommunicationTokenCredential);
  getChatClient(): ChatClient;
  createThreadClient(threadId: string): ChatThreadClient;
  startRealtimeNotifications(): Promise<void>;
  stopRealtimeNotifications(): Promise<void>;
  dispose(): void;
}
```

**Error cases**:
- Invalid endpoint → throw INVALID_INPUT.
- Invalid credential → throw AUTH_TOKEN_INVALID.
- Start notifications fails → throw CONNECTION_FAILED.

**Definition of Done**:
- [x] AcsClientAdapter wraps ChatClient.
- [x] ChatThreadClient creation works.
- [x] Realtime notifications start/stop.
- [x] Cleanup (dispose) implemented.
- [x] Unit tests with mocked ACS SDK.

---

#### Task 3.2 — ACS Model Mappers

**Goal**: Map all ACS types to Library types.

**Changes**:
- `src/adapters/acs/acsMappers.ts`

**Functions**:
- `mapAcsIdentifierToUser(identifier, displayName?) → ChatUser`
- `mapAcsMessageToMessage(acsMsg, convId, currentUserId) → ChatMessage`
- `mapAcsThreadItemToConversation(threadItem) → Partial<Conversation>`
- `mapAcsThreadPropertiesToConversation(props) → Partial<Conversation>`
- `mapAcsParticipantToParticipant(acsParticipant) → ConversationParticipant`
- `mapAcsReadReceiptToReadReceipt(receipt) → ReadReceipt`
- `mapAcsErrorToChatError(error) → ChatError`

**Definition of Done**:
- [x] All mappers implemented.
- [x] Edge cases handled (null sender, system messages, etc.).
- [x] Unit tests for each mapper.

---

#### Task 3.3 — ACS Thread Adapter

**Goal**: Wrap ACS ChatThreadClient operations.

**Changes**:
- `src/adapters/acs/acsThreadAdapter.ts`

**ACS API**:
- Class: `ChatThreadClient`
- Methods: `sendMessage()`, `getMessage()`, `listMessages()`, `updateMessage()`, `deleteMessage()`, `addParticipants()`, `removeParticipant()`, `listParticipants()`, `sendReadReceipt()`, `listReadReceipts()`, `sendTypingNotification()`, `updateTopic()`, `getProperties()`

**Library API**:
```ts
class AcsThreadAdapter {
  constructor(chatThreadClient: ChatThreadClient, currentUserId: string);
  
  // Messages
  sendMessage(content: string, options?: SendMessageOptions): Promise<string>;
  listMessages(options?: ListMessagesOptions): AsyncIterableIterator<ChatMessage[]>;
  updateMessage(messageId: string, content: string): Promise<void>;
  deleteMessage(messageId: string): Promise<void>;
  
  // Participants
  addParticipants(participants: AddParticipantOptions[]): Promise<void>;
  removeParticipant(userId: string): Promise<void>;
  listParticipants(): AsyncIterableIterator<ConversationParticipant[]>;
  
  // Read receipts
  sendReadReceipt(messageId: string): Promise<void>;
  listReadReceipts(): AsyncIterableIterator<ReadReceipt[]>;
  
  // Typing
  sendTypingNotification(): Promise<void>;
  
  // Thread
  updateTopic(topic: string): Promise<void>;
  getProperties(): Promise<Partial<Conversation>>;
}
```

**Definition of Done**:
- [x] All ChatThreadClient methods wrapped.
- [x] ACS types mapped to Library types on return.
- [x] Error handling and mapping.
- [x] Unit tests with mocked ChatThreadClient.

---

#### Task 3.4 — ACS Event Adapter

**Goal**: Subscribe to all ACS realtime events and normalize.

**Changes**:
- `src/adapters/acs/acsEventAdapter.ts`

**ACS API**:
- Events: `chatMessageReceived`, `chatMessageEdited`, `chatMessageDeleted`, `typingIndicatorReceived`, `readReceiptReceived`, `chatThreadCreated`, `chatThreadDeleted`, `chatThreadPropertiesUpdated`, `participantsAdded`, `participantsRemoved`, `realTimeNotificationConnected`, `realTimeNotificationDisconnected`

**Library API**:
```ts
class AcsEventAdapter {
  constructor(chatClient: ChatClient, eventHandler: ChatEventHandler);
  subscribeAll(): void;
  unsubscribeAll(): void;
}

interface ChatEventHandler {
  onEvent(event: ChatDomainEvent): void;
}
```

**Flow**:
1. Subscribe to each ACS event.
2. On event: normalize payload → ChatDomainEvent.
3. Call `eventHandler.onEvent(normalizedEvent)`.

**Definition of Done**:
- [x] All 12 ACS events subscribed.
- [x] Each event normalized to ChatDomainEvent.
- [x] Unsubscribe cleans up all listeners.
- [x] Unit tests for event normalization.

---

### Phase 4 — State Management

#### Task 4.1 — Chat Store

**Goal**: Zustand store for global chat state.

**Changes**:
- `src/store/chatStore.ts`

**State**: `currentUser`, `connectionState`, `initializing`, `initError`.

**Definition of Done**:
- [x] Store created with Zustand.
- [x] Actions for all state mutations.
- [x] Unit tests.

---

#### Task 4.2 — Conversation Store

**Goal**: Zustand store for conversations.

**Changes**:
- `src/store/conversationStore.ts`

**State**: `conversations`, `conversationIds`, `activeConversationId`, `loading`, `hasMore`, etc.

**Actions**: `setConversations`, `addConversation`, `updateConversation`, `removeConversation`, `setActiveConversation`, `incrementUnreadCount`, `resetUnreadCount`, `updateLastMessage`.

**Definition of Done**:
- [x] Store created.
- [x] Normalized state (Record + ordered IDs).
- [x] All actions implemented.
- [x] Selectors for derived data.
- [x] Unit tests.

---

#### Task 4.3 — Message Store

**Goal**: Zustand store for messages (per conversation).

**Changes**:
- `src/store/messageStore.ts`

**State**: `messagesByConversation` (Record<string, ConversationMessages>).

**Actions**: `addMessage`, `prependMessages`, `updateMessage`, `removeMessage`, `setMessages`, `setLoading`, `setHasMore`.

**Definition of Done**:
- [x] Store with per-conversation message arrays.
- [x] Dedup logic in addMessage.
- [x] Sort by sequenceId/createdAt.
- [x] Unit tests.

---

#### Task 4.4 — Participant & Typing & ReadReceipt Store

**Goal**: Zustand store for participants, typing users, read receipts.

**Changes**:
- `src/store/participantStore.ts`

**Definition of Done**:
- [x] Participant state per conversation.
- [x] Typing users map with auto-expiry.
- [x] Read receipt state per conversation.
- [x] Unit tests.

---

### Phase 5 — Services

#### Task 5.1 — Chat Service (Orchestration)

**Goal**: Main service that initializes ACS, manages lifecycle.

**Changes**:
- `src/services/chatService.ts`

**Flow**:
1. Initialize ACS adapter.
2. Start realtime notifications.
3. Subscribe events.
4. Set up event handler → route events to stores.

**Definition of Done**:
- [x] Initialization flow complete.
- [x] Cleanup flow complete.
- [x] Event routing implemented.

---

#### Task 5.2 — Conversation Service

**Goal**: CRUD operations for conversations.

**Changes**:
- `src/services/conversationService.ts`

**Methods**: `loadConversations()`, `createDirectConversation()`, `createGroupConversation()`, `openConversation()`, `closeConversation()`, `deleteConversation()`, `leaveConversation()`.

**Definition of Done**:
- [x] Backend API integration for conversation list.
- [x] Direct conversation creation via backend.
- [x] Group conversation creation.
- [x] Open/close flow with state updates.

---

#### Task 5.3 — Message Service

**Goal**: Message CRUD + pagination.

**Changes**:
- `src/services/messageService.ts`

**Methods**: `loadMessages()`, `loadMore()`, `sendMessage()`, `editMessage()`, `deleteMessage()`, `retryMessage()`.

**Definition of Done**:
- [x] Initial load with pagination.
- [x] Load more (older messages).
- [x] Optimistic send.
- [x] Edit/delete with optimistic update + rollback.
- [x] Retry failed messages.

---

#### Task 5.4 — Typing Service

**Changes**: `src/services/typingService.ts`

**Flow**: Throttled `sendTypingNotification()` + typing user timeout management.

---

#### Task 5.5 — Read Receipt Service

**Changes**: `src/services/readReceiptService.ts`

**Flow**: Debounced `sendReadReceipt()` + participant count check.

---

#### Task 5.6 — Connection Service

**Changes**: `src/services/connectionService.ts`

**Flow**: Network listeners, reconnect logic, resync.

---

### Phase 6 — React Hooks

#### Task 6.1 — useChat

**Goal**: Top-level hook for chat state.

```ts
const { connectionState, currentUser, initialize, disconnect } = useChat();
```

---

#### Task 6.2 — useConversations

**Goal**: Conversation list management hook.

```ts
const {
  conversations, activeConversation, loading, hasMore,
  loadConversations, loadMore, openConversation, closeConversation,
  createDirectConversation, createGroupConversation,
  deleteConversation, leaveConversation,
} = useConversations();
```

---

#### Task 6.3 — useMessages

**Goal**: Message management hook for specific conversation.

```ts
const {
  messages, loading, loadingMore, hasMore, error,
  sendMessage, editMessage, deleteMessage, retryMessage, loadMore,
} = useMessages(conversationId);
```

---

#### Task 6.4 — useParticipants

```ts
const {
  participants, loading, error,
  addParticipant, removeParticipant, loadParticipants,
} = useParticipants(conversationId);
```

---

#### [x] Task 6.5 — useTypingIndicator

```ts
const { typingUsers, typingDisplayText, typingSupported, sendTyping } = useTypingIndicator(conversationId);
```

---

#### Task 6.6 — useReadReceipt [x]

```ts
const { getMessageReadStatus, readReceiptsSupported, sendReadReceipt } = useReadReceipt(conversationId);
```

---

#### Task 6.7 — useConnection

```ts
const { connectionState, reconnect } = useConnection();
```

**Definition of Done (all hooks)**:
- [x] Each hook connects to appropriate store/service.
- [x] Returns typed interface.
- [x] Memoized where needed.
- [x] Unit tests.

---

### Phase 7 — Providers

#### Task 7.1 — ChatProvider

**Goal**: React context provider that initializes everything.

**Changes**:
- `src/components/ChatProvider.tsx`
- `src/providers/ChatContext.tsx`

**Flow**:
1. Receive `ChatConfig` props.
2. Initialize `chatService` on mount.
3. Provide service/store references via context.
4. Cleanup on unmount.

**Definition of Done**:
- [x] Provider initializes ACS client.
- [x] Provider starts realtime notifications.
- [x] Provider sets up event handlers.
- [x] Cleanup on unmount.
- [x] Error handling for init failures.
- [x] Integration test.

---

### Phase 8 — Integration Layer (2 Approaches)

> Thư viện hỗ trợ **hai cách tích hợp** để đáp ứng nhiều nhu cầu khác nhau:
>
> | Approach | Mô tả | Khi nào dùng |
> |---|---|---|
> | **A — Built-in UI** | Sử dụng các component UI có sẵn của thư viện, tuỳ biến qua CSS Variables / Render Props / Component Overrides | Muốn nhanh, ít effort, chấp nhận layout mặc định |
> | **B — Headless (Custom UI)** | Chỉ sử dụng public APIs (hooks, types, services) để tự xây dựng UI hoàn toàn | Muốn kiểm soát 100% giao diện, tích hợp vào design system riêng |

---

#### Approach A — Built-in UI Components

##### Task 8.A.1 — ChatContainer

**Goal**: Main layout component — orchestrates sidebar + conversation area.

**Changes**: `src/components/ChatContainer.tsx`

**Props**:
```tsx
interface ChatContainerProps {
  className?: string;
  style?: CSSProperties;
  renderConversationList?: (props: ConversationListRenderProps) => ReactNode;
  renderConversation?: (props: ConversationRenderProps) => ReactNode;
  renderEmpty?: () => ReactNode;
}
```

**Features**:
- Responsive layout (sidebar + main area).
- Auto-selects first conversation if none active.
- Supports render prop overrides for both panels.

##### Task 8.A.2 — ConversationList + ConversationItem

**Goal**: Sidebar with conversation list, search, unread badges.

**Changes**: `src/components/ConversationList/`, `src/components/Conversation/`

**Props**:
```tsx
interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (id: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  renderItem?: (conversation: Conversation, isActive: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderSearch?: () => ReactNode;
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}
```

**Features**:
- Infinite scroll / load more.
- Search filtering.
- Unread count badge.
- Last message preview.
- Timestamp formatting.

##### Task 8.A.3 — MessageList

**Goal**: Scrollable message area with virtualization, load more.

**Changes**: `src/components/MessageList/`

**Props**:
```tsx
interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  renderMessage?: (message: ChatMessage) => ReactNode;
  renderSystemMessage?: (message: ChatMessage) => ReactNode;
  renderDateSeparator?: (date: Date) => ReactNode;
  renderLoadingMore?: () => ReactNode;
}
```

**Features**:
- Auto-scroll to bottom on new messages.
- Date separators between message groups.
- Scroll-to-top triggers load more.
- Virtualization for large message lists.

##### Task 8.A.4 — MessageItem

**Goal**: Individual message bubble with status, actions.

**Changes**: `src/components/MessageItem/`

**Props**:
```tsx
interface MessageItemProps {
  message: ChatMessage;
  isOwn: boolean;
  showSender?: boolean;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (clientMessageId: string) => void;
  renderContent?: (message: ChatMessage) => ReactNode;
  renderActions?: (message: ChatMessage) => ReactNode;
  renderStatus?: (status: MessageStatus) => ReactNode;
}
```

**Features**:
- Own vs. other user bubble styling.
- Message status indicator (sending, sent, delivered, read, failed).
- Edit/Delete actions (context menu or hover).
- Retry button for failed messages.
- Edited indicator.
- System message rendering.

##### Task 8.A.5 — MessageInput

**Goal**: Text input with send button, typing indicator trigger.

**Changes**: `src/components/MessageInput/`

**Props**:
```tsx
interface MessageInputProps {
  onSend: (content: string) => void;
  onTyping: () => void;
  placeholder?: string;
  disabled?: boolean;
  maxLength?: number;
  renderSendButton?: (props: { onClick: () => void; disabled: boolean }) => ReactNode;
  renderToolbar?: () => ReactNode;
}
```

**Features**:
- Enter to send, Shift+Enter for newline.
- Auto-resize textarea.
- Typing indicator integration (debounced).
- Character count (optional).

##### Task 8.A.6 — TypingIndicator

**Goal**: "User is typing..." display.

**Changes**: `src/components/TypingIndicator/`

**Props**:
```tsx
interface TypingIndicatorProps {
  typingUsers: Array<{ user: ChatUser; startedAt: Date }>;
  renderText?: (typingUsers: ChatUser[]) => ReactNode;
}
```

##### Task 8.A.7 — ParticipantList

**Goal**: List of participants with roles, actions.

**Changes**: `src/components/ParticipantList/`

**Props**:
```tsx
interface ParticipantListProps {
  participants: ConversationParticipant[];
  currentUserId: string;
  onAddParticipant?: () => void;
  onRemoveParticipant?: (userId: string) => void;
  renderItem?: (participant: ConversationParticipant) => ReactNode;
}
```

##### Task 8.A.8 — ConnectionStatus

**Goal**: Banner showing connection state.

**Changes**: `src/components/ConnectionStatus/`

**Props**:
```tsx
interface ConnectionStatusProps {
  state: ConnectionState;
  onRetry?: () => void;
  renderBanner?: (state: ConnectionState, onRetry?: () => void) => ReactNode;
}
```

##### Task 8.A.9 — LoadingState, EmptyState, ErrorState

**Goal**: Utility state components.

**Changes**: `src/components/LoadingState/`, `src/components/EmptyState/`, `src/components/ErrorState/`

```tsx
<LoadingState message?: string />
<EmptyState type: 'no-conversations' | 'no-messages' | 'no-participants' message?: string />
<ErrorState error: ChatError onRetry?: () => void />
```

##### Task 8.A.10 — Default Styles + CSS Variables

**Goal**: Ship default styles + CSS variable theming.

**Changes**: `src/styles/`, `dist/styles.css`

```css
:root {
  --chat-primary: #0078d4;
  --chat-primary-hover: #106ebe;
  --chat-bg: #ffffff;
  --chat-bg-secondary: #f5f5f5;
  --chat-text: #242424;
  --chat-text-secondary: #616161;
  --chat-border: #e0e0e0;
  --chat-message-own-bg: #e1f5fe;
  --chat-message-other-bg: #f5f5f5;
  --chat-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --chat-font-size: 14px;
  --chat-radius: 8px;
  --chat-radius-message: 12px;
  --chat-spacing-xs: 4px;
  --chat-spacing-sm: 8px;
  --chat-spacing-md: 16px;
}
```

**Definition of Done (Approach A)**:
- [x] Mỗi component render đúng với default styles.
- [x] Hỗ trợ CSS variable theming — override bất kỳ token nào.
- [x] Hỗ trợ render prop customization cho từng component.
- [x] Accessible (ARIA attributes, keyboard navigation).
- [x] Responsive layout.
- [x] Component tests (unit + snapshot).
- [x] Storybook hoặc demo page cho mỗi component.

**Ví dụ sử dụng Approach A**:

```tsx
import { ChatProvider, ChatContainer } from 'np-acs-library';
import 'np-acs-library/dist/styles.css'; // Import default styles

function App() {
  return (
    <ChatProvider config={chatConfig}>
      {/* Cách 1: Dùng nguyên giao diện mặc định */}
      <ChatContainer />

      {/* Cách 2: Tuỳ biến một phần qua render props */}
      <ChatContainer
        renderMessage={(message, defaultRender) => {
          if (message.metadata?.type === 'file') {
            return <CustomFileMessage message={message} />;
          }
          return defaultRender(message);
        }}
        renderConversationItem={(conversation, defaultRender) => (
          <div className="custom-item">
            {defaultRender(conversation)}
            <CustomBadge count={conversation.unreadCount} />
          </div>
        )}
      />
    </ChatProvider>
  );
}
```

---

#### Approach B — Headless Mode (Custom UI via Public APIs)

> Dành cho ứng dụng muốn **tự xây dựng hoàn toàn giao diện** nhưng vẫn tận dụng toàn bộ logic chat (realtime, state, services) từ thư viện.

##### Task 8.B.1 — Document Public Hooks API

**Goal**: Đảm bảo tất cả hooks được export và có tài liệu đầy đủ để consumer tự build UI.

**Public Hooks đã implement (Phase 6)**:

| Hook | Mô tả | Key Returns |
|---|---|---|
| `useChat()` | Top-level chat state | `connectionState`, `currentUser`, `initialize`, `disconnect` |
| `useConversations()` | Quản lý danh sách conversation | `conversations`, `activeConversation`, `loading`, `hasMore`, `loadMore`, `createDirectConversation`, `createGroupConversation`, `deleteConversation`, `leaveConversation` |
| `useMessages(conversationId)` | Quản lý messages cho 1 conversation | `messages`, `loading`, `hasMore`, `sendMessage`, `editMessage`, `deleteMessage`, `retryMessage`, `loadMore` |
| `useParticipants(conversationId)` | Quản lý participants | `participants`, `loading`, `addParticipant`, `removeParticipant`, `loadParticipants` |
| `useTypingIndicator(conversationId)` | Typing indicator | `typingUsers`, `typingDisplayText`, `typingSupported`, `sendTyping` |
| `useReadReceipt(conversationId)` | Read receipt | `getMessageReadStatus`, `readReceiptsSupported`, `sendReadReceipt` |
| `useConnection()` | Connection state | `connectionState`, `reconnect` |

##### [x] Task 8.B.2 — Document Public Types API
**Goal**: Export đầy đủ các types để consumer có thể type-safe khi build custom UI.

**Public Types**:

```ts
// Types đã export từ src/types/
export type {
  // Config
  ChatConfig,

  // User & Participant
  ChatUser,
  ChatParticipant,
  ConversationParticipant,

  // Conversation
  Conversation,
  DirectConversation,
  GroupConversation,
  ConversationType,
  CreateDirectConversationOptions,
  CreateGroupConversationOptions,

  // Message
  ChatMessage,
  MessageStatus,
  MessageType,
  SendMessageOptions,

  // Connection
  ConnectionState,

  // Error
  ChatError,
  ChatErrorCode,

  // Events
  ChatDomainEvent,
  ChatEventType,

  // Reconnect
  ReconnectPolicy,
};
```

##### Task 8.B.3 — Headless Integration Guide + Examples

**Goal**: Tạo documentation và ví dụ hoàn chỉnh cho cách dùng headless.

**Ví dụ sử dụng Approach B**:

```tsx
import {
  // Provider (bắt buộc — khởi tạo ACS client + realtime)
  ChatProvider,
  // Hooks (headless API)
  useChat,
  useConversations,
  useMessages,
  useTypingIndicator,
  useReadReceipt,
  useParticipants,
  useConnection,
  // Types
  type ChatConfig,
  type Conversation,
  type ChatMessage,
  type ConnectionState,
} from 'np-acs-library';
// KHÔNG import styles — tự build UI hoàn toàn

// ---- App Entry ----
function App() {
  const chatConfig: ChatConfig = {
    endpoint: 'https://xxx.communication.azure.com',
    token: 'eyJ...',
    userId: '8:acs:xxx',
    displayName: 'John Doe',
  };

  return (
    <ChatProvider config={chatConfig}>
      <MyChatApp />
    </ChatProvider>
  );
}

// ---- Custom Chat UI ----
function MyChatApp() {
  const { connectionState } = useChat();
  const {
    conversations, activeConversation,
    loadMore, openConversation,
    createDirectConversation,
  } = useConversations();

  return (
    <div className="my-chat-layout">
      {/* Connection status — custom UI */}
      {connectionState !== 'connected' && (
        <MyConnectionBanner state={connectionState} />
      )}

      {/* Sidebar — custom UI */}
      <aside className="my-sidebar">
        {conversations.map((conv) => (
          <MyConversationCard
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversation?.id}
            onClick={() => openConversation(conv.id)}
          />
        ))}
        <button onClick={loadMore}>Load more</button>
      </aside>

      {/* Chat area — custom UI */}
      {activeConversation && (
        <MyMessageArea conversationId={activeConversation.id} />
      )}
    </div>
  );
}

// ---- Custom Message Area ----
function MyMessageArea({ conversationId }: { conversationId: string }) {
  const {
    messages, loading, hasMore,
    sendMessage, editMessage, deleteMessage, loadMore,
  } = useMessages(conversationId);

  const { typingUsers, sendTyping } = useTypingIndicator(conversationId);
  const { sendReadReceipt } = useReadReceipt(conversationId);
  const { participants } = useParticipants(conversationId);

  return (
    <main className="my-message-area">
      {/* Custom message list */}
      <div className="my-messages">
        {hasMore && <button onClick={loadMore}>Load older</button>}
        {messages.map((msg) => (
          <MyMessageBubble
            key={msg.id}
            message={msg}
            onEdit={editMessage}
            onDelete={deleteMessage}
          />
        ))}
      </div>

      {/* Custom typing indicator */}
      {typingUsers.length > 0 && (
        <MyTypingDisplay users={typingUsers} />
      )}

      {/* Custom message input */}
      <MyInput
        onSend={(text) => sendMessage({ content: text })}
        onTyping={sendTyping}
      />
    </main>
  );
}
```

##### Task 8.B.4 — Validate Headless API Completeness

**Goal**: Đảm bảo mọi chức năng cần thiết đều accessible qua public API, không bị lock behind internal modules.

**Checklist**:
- [x] Tất cả hooks export qua `src/index.ts`.
- [x] Tất cả public types export qua `src/types/index.ts`.
- [x] `ChatProvider` là entry point duy nhất cần wrap — không cần import internal service/store.
- [x] Consumer có thể thực hiện mọi thao tác chat (CRUD conversation, CRUD message, participants, typing, read receipt, connection) chỉ qua hooks.
- [x] Event callbacks (`onMessageReceived`, `onTypingIndicatorReceived`, etc.) accessible qua `ChatConfig` hoặc hooks.
- [x] Error handling accessible qua hook return values (không cần catch internal errors).

**Definition of Done (Approach B)**:
- [x] Tất cả hooks + types export đầy đủ và documented.
- [x] Ví dụ headless integration chạy được end-to-end.
- [x] README.md có section hướng dẫn cả 2 cách tích hợp.
- [x] No breaking changes cho Approach A khi thêm Approach B.
- [x] Integration test cho headless usage.

---

#### Summary: Approach A vs B

| Tiêu chí | A — Built-in UI | B — Headless (Custom UI) |
|---|---|---|
| **Import** | Components + Hooks + Styles | Hooks + Types only |
| **Styles** | `import 'np-acs-library/dist/styles.css'` | Tự viết hoàn toàn |
| **Layout** | `<ChatContainer />` cung cấp layout mặc định | Tự build layout |
| **Tuỳ biến UI** | CSS Variables, Render Props, Component Overrides | 100% tự kiểm soát |
| **Tuỳ biến logic** | Qua hooks + callbacks | Qua hooks + callbacks |
| **Effort** | Thấp → Trung bình | Trung bình → Cao |
| **Khi nào dùng** | MVP nhanh, UI mặc định chấp nhận được | Design system riêng, UI phức tạp, yêu cầu cao về UX |
| **Wrap bắt buộc** | `<ChatProvider>` | `<ChatProvider>` |

---

### Phase 9 — Reliability

#### Task 9.1 — Error Handling

**Goal**: Implement unified error model across all layers.

#### Task 9.2 — Retry Logic

**Goal**: Automatic retry with exponential backoff.

#### Task 9.3 — Reconnection

**Goal**: Auto-reconnect on disconnect.

#### Task 9.4 — State Resync

**Goal**: Resync conversations and messages after reconnect.

#### Task 9.5 — Token Refresh

**Goal**: Seamless token refresh without disruption.

---

### Phase 10 — Performance

#### Task 10.1 — Virtualized Message List

**Goal**: Implement react-virtuoso for message rendering.

#### Task 10.2 — Memoization

**Goal**: React.memo, useMemo, useCallback for all components/hooks.

#### [x] Task 10.3 — Event Batching

**Goal**: Batch rapid state updates.

#### [x] Task 10.4 — Memory Optimization

**Goal**: Trim cached messages for inactive conversations.

---

### Phase 11 — Testing

#### [x] Task 11.1 — Unit Tests

Target: 80%+ coverage for domain, mappers, store, utils.

#### [x] Task 11.2 — Integration Tests

Target: All service flows tested.

#### Task 11.3 — Component Tests

Target: All components have render + interaction tests.

#### Task 11.4 — E2E Tests

Target: Critical flows (create conversation, send/receive message, reconnect).

---

### Phase 12 — Documentation

#### [x] Task 12.1 — README

- Installation, quick start, configuration.

#### [x] Task 12.2 — API Reference

- All hooks, components, types documented.

#### [x] Task 12.3 — Guides

- Authentication setup, 1-1 chat, group chat, custom UI, error handling.

---

### Phase 13 — Release

#### [x] Task 13.1 — Build Configuration

- Vite library mode, CJS + ESM output.

#### Task 13.2 — Package Publishing

- npm publish, versioning, changelog.

#### [x] Task 13.3 — CI/CD

- GitHub Actions: lint, test, build, publish.

---

## 35. Definition of Done

### Authentication
- [x] ACS client initialization.
- [x] Token handling.
- [x] Token refresh (proactive).
- [x] Logout/cleanup.

### Conversation
- [x] 1-1 conversation (via backend).
- [x] Prevent duplicate direct conversation (backend enforced).
- [x] Group conversation.
- [x] Conversation list (from backend API).
- [x] Conversation pagination.
- [x] Participant management.
- [x] Group management (topic, participants).

### Messages
- [x] Load messages (initial).
- [x] Pagination (load older).
- [x] Send (optimistic).
- [x] Edit (own messages).
- [x] Delete (own messages).
- [x] Correct ordering.
- [x] Duplicate prevention.

### Realtime
- [x] New message event.
- [x] Message edit event.
- [x] Message delete event.
- [x] Participant add/remove events.
- [x] Typing indicator.
- [x] Read receipt.
- [x] Thread create/delete/update events.

### Reliability
- [x] Connection state tracking.
- [x] Auto-reconnect.
- [x] State resync after reconnect.
- [x] Error handling (unified model).
- [x] Retry with backoff.

### React
- [x] ChatProvider.
- [x] All hooks (useChat, useConversations, useMessages, etc.).
- [x] All components (ChatContainer, MessageList, etc.).
- [x] CSS variable theming.
- [x] Render prop customization.
- [x] Headless mode (hooks only).

### Quality
- [x] TypeScript types exported and documented.
- [ ] Unit tests (80%+ coverage).
- [x] Integration tests.
- [x] Component tests.
- [ ] E2E tests (critical flows).
- [x] Documentation (README, API reference, guides).

---

## 36. Open Questions / Decisions Required

### Must Decide Before Implementation

1. **Ai tạo conversation: Backend hay React Library trực tiếp?**
   - **Recommendation**: Backend tạo, Library gọi backend API. Đặc biệt bắt buộc cho direct conversation (duplicate prevention).
   - **Decision needed**: Backend API contract.

2. **Ai quản lý mapping User ↔ ACS Identity?**
   - **Recommendation**: Backend. Application user ID → ACS Communication User ID mapping stored in backend DB.
   - **Decision needed**: Backend data model.

3. **Conversation list lấy từ ACS hay Backend?**
   - **Recommendation**: Backend (enriched data). ACS `listChatThreads` thiếu lastMessage, unreadCount, type, metadata.
   - **Decision needed**: Backend API response format.

4. **Unread count lấy từ đâu?**
   - **Option A**: Library tính locally từ read receipts + events (mất khi refresh page).
   - **Option B**: Backend persist unread count (đồng bộ cross-device).
   - **Recommendation**: Kết hợp — Backend persist baseline, Library updates realtime.

5. **Group metadata (description, avatar) lưu ở đâu?**
   - ACS thread metadata giới hạn 1KB.
   - **Recommendation**: Backend DB cho extended metadata; ACS metadata cho type flag.

6. **Group roles/permissions do ai quản lý?**
   - ACS KHÔNG hỗ trợ.
   - **Recommendation**: Backend 100%. Library reads roles for UI display.

7. **Attachment/file architecture:**
   - **Recommendation**: Backend + Azure Blob Storage. Library provides callback interface `onFileUpload`.
   - **Decision needed**: File storage details, SAS token strategy.

8. **Search messages/conversations:**
   - ACS KHÔNG hỗ trợ search.
   - **Decision needed**: Backend search implementation (Azure Cognitive Search?).

9. **Pin/archive/mute:**
   - ACS KHÔNG hỗ trợ.
   - **Decision needed**: Backend per-user settings.
   - **Recommendation**: Implement in Phase 2 (after MVP).

10. **Message retention:**
    - ACS hỗ trợ 30-90 day retention policy per thread.
    - **Decision needed**: Default retention policy.

11. **Offline support:**
    - ACS KHÔNG hỗ trợ offline queue.
    - **Decision needed**: Library local queue depth, retry strategy.
    - **Recommendation**: Queue up to 10 messages locally, retry on reconnect. No IndexedDB persistence for MVP.

12. **Multi-device synchronization:**
    - Same user on multiple devices → each device has own ChatClient.
    - Unread count needs backend persistence to sync across devices.
    - **Decision needed**: Backend sync strategy.

13. **Zustand vs alternative state management:**
    - ✅ **DECIDED**: Sử dụng **Zustand** (see Section 22 analysis).

14. **Vitest vs Jest:**
    - ✅ **DECIDED**: Sử dụng **Vitest** (faster, native ESM, pairs with Vite build).

15. **Backend API contract:**
    - ✅ **DOCUMENTED**: Xem chi tiết tại [api-docs.md](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/api-docs.md).
    - Bao gồm tất cả endpoints cần thiết cho React Chat Library.

---

## 37. Recommended Architecture

### Final Architecture Diagram

```
React Application
       │
       │  <ChatProvider config={...}>
       │    <ChatContainer />
       │  </ChatProvider>
       │
       ▼
┌──────────────────────────────────────────────┐
│            React Chat Library                │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │  UI Components (ChatContainer,       │    │
│  │  ConversationList, MessageList, etc.) │    │
│  └──────────────┬───────────────────────┘    │
│                 │                             │
│  ┌──────────────▼───────────────────────┐    │
│  │  React Hooks (useConversations,      │    │
│  │  useMessages, useTypingIndicator)    │    │
│  └──────────────┬───────────────────────┘    │
│                 │                             │
│  ┌──────────────▼───────────────────────┐    │
│  │  State (Zustand)                     │    │
│  │  chatStore, conversationStore,       │    │
│  │  messageStore, participantStore      │    │
│  └──────────────┬───────────────────────┘    │
│                 │                             │
│  ┌──────────────▼───────────────────────┐    │
│  │  Services (chatService,              │    │
│  │  conversationService, messageService)│    │
│  └──────────┬──────────────┬────────────┘    │
│             │              │                  │
│  ┌──────────▼─────┐  ┌────▼────────────┐    │
│  │  Domain         │  │  ACS Adapter    │    │
│  │  (pure logic,   │  │  (acsClient,    │    │
│  │   mappers)      │  │   acsThread,    │    │
│  │                 │  │   acsEvent,     │    │
│  │                 │  │   acsMappers)   │    │
│  └─────────────────┘  └───┬─────────┬──┘    │
│                            │         │        │
└────────────────────────────┼─────────┼────────┘
                             │         │
                    ┌────────▼──┐  ┌───▼──────────────┐
                    │ Application│  │ Azure             │
                    │ Backend    │  │ Communication     │
                    │            │  │ Services          │
                    │ - Token    │  │                   │
                    │ - Identity │  │ - ChatClient      │
                    │ - Conv     │  │ - ChatThreadClient│
                    │   mapping  │  │ - WebSocket       │
                    │ - Roles    │  │ - REST API        │
                    │ - Files    │  │                   │
                    └────────────┘  └───────────────────┘
```

### Summary of Key Recommendations

| # | Decision | Recommendation |
|---|---|---|
| 1 | **Conversation architecture** | Discriminated union: `DirectConversation \| GroupConversation` |
| 2 | **1-1 conversation strategy** | Backend creates/finds thread; prevents duplicates via DB unique constraint |
| 3 | **Group conversation strategy** | Backend creates thread with role assignment; ACS for messaging |
| 4 | **State management** | Zustand — minimal re-renders, external store, tiny bundle |
| 5 | **Realtime architecture** | ACS WebSocket → Event Adapter → Normalize → Store → React |
| 6 | **Message pagination** | Cursor-based reverse pagination via ACS `listMessages({ maxPageSize })` |
| 7 | **Read receipt** | Debounced (300ms), skip if already sent, disable for >20 participants |
| 8 | **Typing indicator** | Throttled (8s matches ACS expiry), auto-cleanup after timeout |
| 9 | **Authentication** | `AzureCommunicationTokenCredential` with `refreshProactively: true` |
| 10 | **Token refresh** | Application provides `tokenRefresher` callback → Backend endpoint |
| 11 | **Reconnect** | Exponential backoff (1s → 30s, max 10 retries), resync on reconnect |
| 12 | **Error handling** | Unified `ChatError` model, retry for retryable errors, backoff for 429 |
| 13 | **UI customization** | CSS variables (theming) + render props (component override) + headless hooks |
| 14 | **Attachment** | Backend + Azure Blob Storage; message metadata carries file URL |
| 15 | **Backend responsibility** | Token, identity, conversation mapping, roles, permissions, files, search, unread persistence |
| 16 | **ACS responsibility** | Thread CRUD, message CRUD, participants, read receipts, typing, realtime WebSocket |
| 17 | **React Library responsibility** | UI, hooks, state, domain logic, event handling, ACS abstraction, error handling, reconnect |
