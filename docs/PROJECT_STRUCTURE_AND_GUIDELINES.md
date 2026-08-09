# Project Structure and Development Guidelines

> Tài liệu này dùng cho developer mới onboard, AI agent khi chỉnh sửa/thêm module, người review code, và người bảo trì dự án lâu dài.

---

## 1. Tổng Quan Dự Án

### Mô tả

`@namphuong/acs-chat-react` là một **React library** cung cấp bộ components, hooks và services để tích hợp **Azure Communication Services (ACS) Chat** vào ứng dụng React. Library được build dưới dạng package (ES module + CJS) để consumer import và sử dụng.

### Công nghệ chính

| Công nghệ | Phiên bản | Mục đích |
|---|---|---|
| **React** | ≥18.0.0 | UI framework (peer dependency) |
| **TypeScript** | ^5.3 | Type safety, strict mode |
| **Zustand** | ^4.5 | State management (global store) |
| **Vite** | ^5.1 | Build tool (library mode) |
| **Vitest** | ^1.3 | Unit testing (jsdom environment) |
| **SCSS Modules** | sass ^1.102 | Scoped component styling |
| **Azure ACS SDK** | chat ^1.6, common ^2.0 | ACS Chat backend (peer dependency) |
| **i18next / react-i18next** | ^23.0 / ^15.0 | Internationalization (i18n) |
| **ESLint** | ^8.56 | Linting |
| **Prettier** | ^3.2 | Code formatting |

### Kiến trúc tổng thể

Dự án áp dụng **Layered Architecture** (kiến trúc phân tầng) kết hợp **Adapter Pattern**:

```
┌─────────────────────────────────────────────────────────┐
│                    Consumer App                          │
├─────────────────────────────────────────────────────────┤
│  Components (UI Layer)          │  Hooks (React API)    │
│  ChatProvider, ChatContainer,   │  useChat, useMessages │
│  ConversationList, MessageList  │  useConversations...  │
├─────────────────────────────────────────────────────────┤
│  Services (Business Logic Layer)                        │
│  chatService, conversationService, messageService,      │
│  typingService, readReceiptService, connectionService   │
├─────────────────────────────────────────────────────────┤
│  Store (State Layer) - Zustand                          │
│  chatStore, conversationStore, messageStore,             │
│  participantStore + selectors                           │
├─────────────────────────────────────────────────────────┤
│  Adapters (Infrastructure Layer)                        │
│  AcsClientAdapter, AcsEventAdapter, AcsThreadAdapter,   │
│  acsMappers (data transformation)                       │
├─────────────────────────────────────────────────────────┤
│  Types / Models / Constants / Utils                     │
│  (Shared across all layers)                             │
└─────────────────────────────────────────────────────────┘
```

**Luồng dữ liệu:**
1. **Hooks** gọi **Services** để thực hiện business logic
2. **Services** gọi **Adapters** để tương tác với ACS SDK
3. **Adapters** gọi ACS SDK, chuyển đổi dữ liệu qua **Mappers**
4. Kết quả được cập nhật vào **Zustand Stores**
5. **Hooks** subscribe vào stores, re-render **Components**
6. Real-time events đi qua **AcsEventAdapter → ChatService.handleDomainEvent → Stores**

### Nguyên tắc phát triển chính

- **Singleton Services**: Mỗi service có một singleton instance export sẵn (`chatService`, `conversationService`...)
- **Optimistic Updates**: Cập nhật UI ngay lập tức, rollback nếu server request fail
- **Normalized State**: Conversations được lưu dạng `Record<id, entity>` + ordered `ids[]`
- **Dedup & Sort**: Messages tự động deduplicate và sort khi thêm vào store
- **Adapter Pattern**: Tách biệt ACS SDK khỏi business logic, dễ thay thế provider

---

## 2. Cấu Trúc Thư Mục

```txt
src/
├── __tests__/              # Integration tests
│   ├── adapters/           # Adapter tests
│   ├── services/           # Service tests
│   └── store/              # Store tests
├── adapters/               # Infrastructure adapters (ACS SDK wrappers)
│   └── acs/
│       ├── acsClientAdapter.ts   # ChatClient lifecycle adapter
│       ├── acsEventAdapter.ts    # Real-time event subscription + normalization
│       ├── acsThreadAdapter.ts   # ChatThreadClient operations adapter
│       ├── acsMappers.ts         # Data transformation: ACS ↔ Internal types
│       └── index.ts
├── components/             # React UI components
│   ├── Avatar/             # User avatar component
│   ├── ChatContainer.tsx   # Main chat layout (sidebar + main)
│   ├── ChatProvider.tsx    # Root provider (init + context)
│   ├── ConnectionStatus/   # Connection state indicator
│   ├── Conversation/       # Active conversation view
│   ├── ConversationList/   # Sidebar conversation list + search
│   ├── EmptyState/         # Empty data placeholder
│   ├── ErrorState/         # Error display placeholder
│   ├── Icons/              # SVG icon components
│   ├── LoadingState/       # Loading indicator placeholder
│   ├── MessageInput/       # Message composition input
│   ├── MessageItem/        # Single message display
│   ├── MessageList/        # Messages container with pagination
│   ├── ParticipantList/    # Thread participants display
│   ├── ReadReceipt/        # Read receipt indicators
│   ├── SearchInput/        # Search input component
│   ├── TypingIndicator/    # Typing status display
│   ├── __tests__/          # Component unit tests
│   └── index.ts            # Component barrel exports
├── constants/              # Application constants
│   ├── defaults.ts         # Default configuration values
│   ├── errors.ts           # Error constants
│   ├── events.ts           # Event constants
│   └── index.ts
├── domain/                 # Domain logic (placeholder/extensible)
│   ├── conversationDomain.ts
│   ├── eventDomain.ts
│   ├── messageDomain.ts
│   ├── participantDomain.ts
│   └── index.ts
├── hooks/                  # React hooks (public API cho consumers)
│   ├── useChat.ts          # Init/disconnect, connection state
│   ├── useConnection.ts    # Connection state + manual reconnect
│   ├── useConversation.ts  # Single conversation (placeholder)
│   ├── useConversations.ts # CRUD conversations, active conversation
│   ├── useMessages.ts      # CRUD messages, pagination
│   ├── useParticipants.ts  # Participant management
│   ├── useReadReceipt.ts   # Read receipt tracking + sending
│   ├── useTypingIndicator.ts # Typing notification management
│   ├── __tests__/
│   └── index.ts
├── i18n/                   # Internationalization (i18next)
│   ├── locales/            # Translation dictionaries (en.ts, vi.ts)
│   └── index.ts            # Scoped chatI18n instance
├── models/                 # Internal domain models (type aliases)
│   ├── Conversation.ts
│   ├── Message.ts
│   ├── Participant.ts
│   ├── ReadReceipt.ts
│   ├── User.ts
│   └── index.ts
├── providers/              # React context providers
│   ├── ChatContext.tsx      # ChatServices context + useChatServices hook
│   └── index.ts
├── services/               # Business logic services (singleton)
│   ├── chatService.ts      # Core orchestration, init, event routing
│   ├── connectionService.ts # Network monitoring, reconnection
│   ├── conversationService.ts # Conversation CRUD operations
│   ├── messageService.ts   # Message CRUD + optimistic updates
│   ├── participantService.ts # Participant management
│   ├── readReceiptService.ts # Read receipt with debouncing
│   ├── typingService.ts    # Typing notification with throttling
│   └── index.ts
├── store/                  # Zustand state stores
│   ├── chatStore.ts        # Global: currentUser, connectionState, init status
│   ├── connectionStore.ts  # (placeholder)
│   ├── conversationStore.ts # Normalized conversation entities + metadata
│   ├── messageStore.ts     # Per-conversation messages + dedup/sort logic
│   ├── participantStore.ts # Per-conversation participants, typing, read receipts
│   ├── selectors.ts        # Reusable selectors for all stores
│   └── index.ts
├── types/                  # TypeScript type definitions
│   ├── chat.types.ts       # ChatUser, ConnectionState
│   ├── config.types.ts     # ChatConfig, ReconnectPolicy, ChatLogger
│   ├── conversation.types.ts # Conversation types (Direct, Group, Base)
│   ├── errors.types.ts     # ChatErrorCode, ChatError, AcsChatError class
│   ├── events.types.ts     # ChatEventType, ChatDomainEvent
│   ├── message.types.ts    # ChatMessage, MessageStatus, FileAttachment
│   ├── participant.types.ts # ChatParticipant, ConversationParticipant
│   └── index.ts
├── utils/                  # Utility functions
│   ├── date.ts             # formatDate, formatTime (relative time)
│   ├── debounce.ts         # Debounce helper (placeholder)
│   ├── id.ts               # generateId (random string)
│   ├── logger.ts           # Simple console logger wrapper
│   ├── retry.ts            # Retry helper (placeholder)
│   ├── throttle.ts         # Throttle helper (placeholder)
│   └── index.ts
├── index.ts                # Library entry point (exports components, hooks, types)
└── vite-env.d.ts           # Vite type declarations
```

### Chi tiết từng thư mục

| Thư mục | Dùng để làm gì | Khi nào thêm file | Không nên đặt |
|---|---|---|---|
| `adapters/` | Wrap external SDK (ACS), chuyển đổi dữ liệu | Khi tích hợp SDK mới hoặc thêm phương thức ACS | Business logic, UI code |
| `components/` | React UI components | Khi tạo component hiển thị mới | API calls trực tiếp, complex business logic |
| `constants/` | Giá trị cố định, config mặc định | Khi có magic number/string cần tái sử dụng | Logic code, types |
| `domain/` | Domain logic thuần (hiện đang placeholder) | Khi cần validation/transformation phức tạp | UI code, API calls |
| `hooks/` | React hooks - public API cho consumer | Khi tạo hook mới expose cho consumer | Direct store manipulation phức tạp |
| `i18n/` | Cấu hình và từ điển đa ngôn ngữ | Khi thêm key/ngôn ngữ mới | Business logic |
| `models/` | Internal domain model type aliases | Khi cần model nội bộ khác với API types | Implementation logic |
| `providers/` | React Context providers | Khi cần context mới cho dependency injection | Business logic |
| `services/` | Business logic, orchestration | Khi thêm feature mới cần xử lý nghiệp vụ | UI code, store definition |
| `store/` | Zustand stores + selectors | Khi cần state slice mới | API calls, UI rendering |
| `types/` | TypeScript interfaces/types | Khi cần type mới cho API, component, event | Implementation logic |
| `utils/` | Pure utility functions | Khi cần helper function tái sử dụng | Stateful logic, React hooks |

---

## 3. Quy Tắc Khi Thêm Module/Feature Mới

### Quy trình chuẩn

Khi thêm một feature mới (ví dụ: "Reactions"), thực hiện theo thứ tự:

1. **Định nghĩa Types** → `src/types/reaction.types.ts`
   ```ts
   export interface Reaction {
     type: string;
     userId: string;
     messageId: string;
     createdAt: Date;
   }
   ```

2. **Tạo Model** (nếu cần alias) → `src/models/Reaction.ts`

3. **Tạo Store** → `src/store/reactionStore.ts`
   - Dùng Zustand `create<ReactionState>()`
   - Export `initialState` riêng để dùng trong reset
   - Thêm selectors vào `src/store/selectors.ts`

4. **Tạo Adapter** (nếu cần tương tác ACS) → `src/adapters/acs/acsReactionAdapter.ts`
   - Thêm mapper functions vào `acsMappers.ts`

5. **Tạo Service** → `src/services/reactionService.ts`
   - Tạo class với singleton pattern
   - Inject ChatService reference qua `setChatService()`
   - Export singleton: `export const reactionService = new ReactionService()`

6. **Tạo Hook** → `src/hooks/useReactions.ts`
   - Wrap service methods trong `useCallback`
   - Subscribe store state với selectors

7. **Tạo Component** → `src/components/Reaction/index.tsx`
   - Mỗi component một thư mục riêng
   - File chính là `index.tsx`
   - SCSS module nếu cần: `Reaction.module.scss`

8. **Cập nhật barrel exports**:
   - `src/types/index.ts`
   - `src/store/index.ts`
   - `src/services/index.ts`
   - `src/hooks/index.ts`
   - `src/components/index.ts`
   - `src/index.ts` (nếu cần expose cho consumer)

### Quy tắc đặt tên

| Loại | Convention | Ví dụ |
|---|---|---|
| **File type/interface** | `{feature}.types.ts` (camelCase) | `reaction.types.ts` |
| **File model** | `{Feature}.ts` (PascalCase) | `Reaction.ts` |
| **File store** | `{feature}Store.ts` (camelCase) | `reactionStore.ts` |
| **File service** | `{feature}Service.ts` (camelCase) | `reactionService.ts` |
| **File hook** | `use{Feature}.ts` (camelCase) | `useReactions.ts` |
| **File component** | `index.tsx` trong thư mục PascalCase | `Reaction/index.tsx` |
| **File SCSS** | `{Component}.module.scss` | `Reaction.module.scss` |
| **Interface/Type** | PascalCase | `ReactionState`, `ChatMessage` |
| **Function** | camelCase | `sendReaction`, `mapAcsReaction` |
| **Constant** | UPPER_SNAKE_CASE | `MAX_REACTIONS`, `CHAT_DEFAULTS` |
| **React Component** | PascalCase | `ReactionList`, `ConversationItem` |
| **Zustand Hook** | `use{Feature}Store` | `useReactionStore` |
| **Custom Hook** | `use{Feature}` | `useReactions` |

---

## 4. Nguyên Tắc Code Đơn Giản

### 4.1. Function chỉ nên làm một việc

```ts
// ✅ Tốt: Mỗi function có một nhiệm vụ rõ ràng
export function extractCommunicationUserId(identifier?: CommunicationIdentifier): string {
  if (!identifier) return '';
  // ... logic trích xuất ID
}

export function mapAcsIdentifierToUser(identifier?: CommunicationIdentifier, displayName?: string): ChatUser {
  const id = extractCommunicationUserId(identifier);
  return { id: id || 'system', displayName: displayName || (id ? undefined : 'System') };
}

// ❌ Xấu: Gộp cả extract + map + validate trong một function
```

### 4.2. Component không chứa quá nhiều business logic

Pattern hiện tại trong dự án:

```tsx
// ✅ Tốt: Component chỉ lo hiển thị, logic nằm trong hook
export const ConversationList: React.FC = () => {
  const { conversations, loading, openConversation } = useConversations();
  // UI rendering only
};

// ❌ Xấu: Gọi API, xử lý data, quản lý state phức tạp trong component
```

### 4.3. Tránh nested condition quá sâu

```ts
// ✅ Tốt: Early return
public openConversation(conversationId: string): void {
  if (!conversationId || conversationId.trim() === '') {
    throw new AcsChatError('INVALID_INPUT', 'conversationId is required.');
  }
  if (!store.conversations[conversationId]) {
    throw new AcsChatError('CONVERSATION_NOT_FOUND', `Conversation ${conversationId} not found.`);
  }
  store.setActiveConversation(conversationId);
  store.resetUnreadCount(conversationId);
}

// ❌ Xấu: Nested if-else sâu nhiều tầng
```

### 4.4. Không tạo abstraction khi chưa cần thiết

Ví dụ thực tế: `utils/debounce.ts`, `utils/retry.ts`, `utils/throttle.ts` hiện đang là placeholder đơn giản. Chỉ implement đầy đủ khi thực sự cần.

### 4.5. Ưu tiên code dễ đọc

```ts
// ✅ Tốt: Rõ ràng, dễ hiểu
const isDirect = participants.length === 2;
const otherParticipant = participants.find((p) => p.id !== currentUserId);

// ❌ Xấu: "Thông minh" nhưng khó đọc
const [isDirect, otherParticipant] = [participants.length === 2, participants.find(p => p.id !== currentUserId)];
```

---

## 5. Clean Code Guidelines

### 5.1. Naming Convention

- **Biến/hàm**: camelCase — `sendMessage`, `loadConversations`
- **Type/Interface/Class**: PascalCase — `ChatMessage`, `ConversationService`
- **Constants**: UPPER_SNAKE_CASE — `TYPING_THROTTLE_MS`, `READ_RECEIPT_DEBOUNCE_MS`
- **Boolean**: Prefix `is`/`has`/`should` — `isInitialized`, `hasMore`, `isSubscribed`
- **Event handlers**: Prefix `handle`/`on` — `handleDomainEvent`, `handleOnline`
- **Map/Transform functions**: Prefix `map`/`normalize` — `mapAcsMessageToMessage`, `normalizeChatMessageReceived`
- **Selectors**: Prefix `select` — `selectAllConversations`, `selectActiveConversation`

### 5.2. Cách tổ chức import

Thứ tự import theo convention hiện tại:

```ts
// 1. External packages
import { create } from 'zustand';
import type { ChatClient } from '@azure/communication-chat';

// 2. Internal adapters/services (theo layer hierarchy)
import { AcsClientAdapter } from '../adapters/acs/acsClientAdapter';

// 3. Internal stores
import { useChatStore } from '../store/chatStore';

// 4. Internal types (dùng `import type` khi chỉ import type)
import type { ChatConfig } from '../types/config.types';
import type { ChatMessage } from '../types/message.types';

// 5. Internal utils
import { logger } from '../utils/logger';
```

> **Quan trọng**: Luôn dùng `import type` khi chỉ import types/interfaces để TypeScript compiler tối ưu bundle.

### 5.3. Cách chia component

Mỗi component có thư mục riêng:

```
ComponentName/
├── index.tsx               # Component chính + export
├── ComponentName.module.scss  # Scoped styles (nếu cần)
├── SubComponent.tsx        # Component con (nếu cần)
└── types.ts               # Component-specific types (nếu phức tạp)
```

**Ví dụ thực tế**: `ConversationList/` chứa:
- `index.tsx` — `ConversationList` component
- `ConversationItem.tsx` — Component con hiển thị từng conversation
- `ConversationList.module.scss` — Scoped styles

### 5.4. Cách viết props/type/interface

```tsx
// ✅ Pattern hiện tại: Props interface đặt cùng file component
export interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onClick,
}) => { /* ... */ };
```

### 5.5. Cách xử lý loading/error/empty state

Pattern hiện tại trong dự án:

```tsx
// Trong component
{loading && <LoadingState />}
{!loading && conversations.length === 0 && <EmptyState message="No conversations found" />}
{error && <ErrorState />}
```

**Trong hooks**, loading/error state được quản lý rõ ràng:

```ts
// ✅ Pattern hook: return loading, error, data
export const useMessages = (conversationId: string) => {
  const [error, setError] = useState<AcsChatError | null>(null);
  const { messages, loading, loadingMore, hasMore } = convData;

  return { messages, loading, loadingMore, hasMore, error, sendMessage, /* ... */ };
};
```

### 5.6. Giữ file nhỏ và dễ review

- **Service**: Mỗi service tập trung một domain (conversation, message, typing...)
- **Store**: Mỗi store tập trung một entity type
- **Selectors**: Tất cả selectors gom trong `selectors.ts` để dễ tìm
- **Types**: Tách theo domain (`chat.types.ts`, `message.types.ts`...)

---

## 6. Quy Tắc Làm Việc Với API

### 6.1. Nguyên tắc cốt lõi

> **KHÔNG BAO GIỜ tin tưởng dữ liệu từ API tuyệt đối.** Luôn validate trước khi sử dụng.

### 6.2. Pattern hiện có trong dự án

**Pattern 1: Kiểm tra null/undefined trước khi sử dụng**

```ts
// Từ acsMappers.ts — luôn có fallback
const content = isSystem
  ? acsMsg.content?.topic || acsMsg.content?.message || ''  // Fallback chuỗi rỗng
  : acsMsg.content?.message || '';

const createdAt = acsMsg.createdOn ? new Date(acsMsg.createdOn) : new Date();  // Fallback Date hiện tại
```

**Pattern 2: Kiểm tra Array trước khi iterate**

```ts
// Từ acsEventAdapter.ts
const participants = Array.isArray(e?.participants)
  ? e.participants.map(mapAcsParticipantToParticipant)
  : [];  // Fallback mảng rỗng

// Từ chatService.ts — kiểm tra length trước khi xử lý
if (payload.participants?.length > 0) {
  partStore.setParticipants(payload.id, payload.participants);
}
```

**Pattern 3: Defensive ID extraction**

```ts
// Từ acsMappers.ts — trích xuất ID an toàn từ nhiều format
export function extractCommunicationUserId(identifier?: CommunicationIdentifier): string {
  if (!identifier) return '';
  const idObj = identifier as Record<string, unknown>;
  if (typeof idObj.communicationUserId === 'string') return idObj.communicationUserId;
  if (typeof idObj.rawId === 'string') return idObj.rawId;
  // ... thêm nhiều fallback
  return '';
}
```

**Pattern 4: Type-safe error mapping**

```ts
// Từ acsMappers.ts — map error với đầy đủ context
export function mapAcsErrorToChatError(
  error: unknown,
  operation?: string,
  options?: { messageId?: string; conversationId?: string }
): AcsChatError {
  if (error instanceof AcsChatError) return error;  // Đã là custom error

  const err = error as { statusCode?: number; status?: number; message?: string };
  const statusCode = err?.statusCode || err?.status;
  // Map HTTP status → error code...
}
```

### 6.3. Quy tắc bắt buộc khi xử lý API response

```ts
// ✅ Luôn kiểm tra response shape
const items = Array.isArray(response?.data) ? response.data : [];

// ✅ Kiểm tra type trước khi dùng
const title = typeof item?.title === 'string' ? item.title : '';
const count = typeof item?.count === 'number' ? item.count : 0;
const date = item?.createdAt ? new Date(item.createdAt) : new Date();

// ✅ Optional chaining cho nested properties
const threadId = result.chatThread?.id;
if (!threadId) {
  throw new AcsChatError('UNKNOWN_ERROR', 'Failed to get thread ID from created thread.');
}

// ❌ KHÔNG BAO GIỜ
const data = response.data;  // Có thể undefined
const name = response.user.name;  // Có thể crash nếu user undefined
```

### 6.4. Mapping dữ liệu API sang model nội bộ

Dự án đã có pattern rõ ràng qua **mapper functions** trong `acsMappers.ts`:

```ts
// Luôn map ACS type → Internal type qua dedicated mapper
const mapped = mapAcsMessageToMessage(acsMsg, conversationId, currentUserId);
const participant = mapAcsParticipantToParticipant(acsParticipant);
```

**Quy tắc**: Không truyền raw ACS objects vào components/hooks. Luôn map qua mapper trước.

---

## 7. Error Handling

### 7.1. Hệ thống Error hiện tại

Dự án sử dụng custom error class `AcsChatError` với hệ thống error code phân loại rõ ràng:

```ts
// Error codes được phân nhóm:
// Auth: AUTH_TOKEN_EXPIRED, AUTH_TOKEN_INVALID, AUTH_REFRESH_FAILED, AUTH_UNAUTHORIZED
// Network: NETWORK_ERROR, NETWORK_TIMEOUT
// ACS: ACS_SERVICE_ERROR, ACS_RATE_LIMITED, ACS_NOT_FOUND
// Permission: PERMISSION_DENIED
// Conversation: CONVERSATION_NOT_FOUND, CONVERSATION_DELETED
// Message: MESSAGE_NOT_FOUND, MESSAGE_TOO_LARGE, MESSAGE_SEND_FAILED
// Connection: CONNECTION_LOST, CONNECTION_FAILED, RECONNECT_FAILED
// General: UNKNOWN_ERROR, INVALID_INPUT
```

### 7.2. Pattern xử lý lỗi theo layer

**Adapter Layer** — Catch & Transform:
```ts
// Catch lỗi ACS SDK, transform thành AcsChatError
try {
  await this.chatClient.startRealtimeNotifications();
} catch (error) {
  throw new AcsChatError('CONNECTION_FAILED', 'Failed to start realtime notifications.', {
    cause: error,
    operation: 'startRealtimeNotifications',
  });
}
```

**Service Layer** — Catch, Map & Update Store:
```ts
// Catch lỗi, map qua mapAcsErrorToChatError, cập nhật store error state
try {
  const chatClient = this.getChatClient();
  // ... operations
} catch (error) {
  const chatError = mapAcsErrorToChatError(error, 'loadConversations');
  store.setError(chatError);
  store.setLoading(false);
  throw chatError;
}
```

**Hook Layer** — Catch & Expose Error State:
```ts
// Catch lỗi từ service, set vào local state cho component
const sendMessage = useCallback(async (content: string) => {
  setError(null);
  const result = await messageService.sendMessage(conversationId, content);
  if (result.error) {
    setError(result.error);
  }
  return result;
}, [conversationId]);
```

**Component Layer** — Render error UI:
```tsx
{error && <ErrorState />}
```

### 7.3. Lỗi không nghiêm trọng (Non-critical)

Một số lỗi được log nhưng không throw:

```ts
// Read receipt fail — log warning, không crash
console.warn('[ReadReceiptService] Failed to send read receipt:', mappedError);

// Typing notification fail — ephemeral, chỉ warn
console.warn('Failed to send typing notification:', err);

// Event listener exception — protect loop
for (const listener of this.listeners) {
  try {
    listener(event);
  } catch (err) {
    console.error('Error in ChatService event listener:', err);
  }
}
```

### 7.4. Cleanup errors

Trong `dispose()` / cleanup flows, lỗi được silent catch:

```ts
try {
  this.eventAdapter.unsubscribeAll();
} catch {
  // Ignore error during cleanup
}
```

### 7.5. Quy tắc Error Handling

1. **Không nuốt lỗi âm thầm** — Luôn log hoặc throw
2. **Không show raw error cho user** — Dùng `AcsChatError.message` đã được format
3. **Luôn kèm context** — `operation`, `conversationId`, `messageId`
4. **Phân biệt retryable** — Set `retryable: true` cho network/server errors
5. **Cleanup an toàn** — Silent catch trong dispose/cleanup flows

---

## 8. State Management

### 8.1. Kiến trúc State

Dự án sử dụng **Zustand** với 4 stores tách biệt:

| Store | Scope | Dữ liệu chính |
|---|---|---|
| `chatStore` | Global app state | `currentUser`, `connectionState`, `initializing`, `initError` |
| `conversationStore` | Conversation entities | `conversations` (normalized), `conversationIds`, `activeConversationId`, loading/error |
| `messageStore` | Per-conversation messages | `messagesByConversation` (map conversationId → messages[]), loading/pagination |
| `participantStore` | Per-conversation data | `participantsByConversation`, `typingUsers`, `readReceipts` |

### 8.2. Pattern chuẩn khi tạo Store

```ts
// 1. Interface cho state + actions
export interface ChatState {
  currentUser: ChatUser | null;
  setCurrentUser: (user: ChatUser | null) => void;
  reset: () => void;
}

// 2. Initial state tách riêng (để reset dùng lại)
export const initialChatState = {
  currentUser: null,
  connectionState: 'disconnected' as ConnectionState,
};

// 3. Create store
export const useChatStore = create<ChatState>((set) => ({
  ...initialChatState,
  setCurrentUser: (currentUser) => set({ currentUser }),
  reset: () => set(initialChatState),
}));
```

### 8.3. Normalized State Pattern

Conversations được lưu dạng normalized:

```ts
{
  conversations: {
    'conv-1': { id: 'conv-1', name: 'Group A', ... },
    'conv-2': { id: 'conv-2', name: 'Group B', ... },
  },
  conversationIds: ['conv-1', 'conv-2'],  // Ordered
}
```

**Ưu điểm**: Lookup O(1) bằng ID, tránh duplicate, dễ update partial.

### 8.4. Selectors

Tất cả selectors được gom trong `store/selectors.ts`:

```ts
// Dùng selector khi subscribe store trong hook/component
const conversations = useConversationStore(selectAllConversations);
const activeConversation = useConversationStore(selectActiveConversation);
const participants = useParticipantStore((state) =>
  selectParticipantsByConversation(state, conversationId)
);
```

### 8.5. Quy tắc State

| Loại state | Đặt ở đâu | Ví dụ |
|---|---|---|
| **UI-local** | `useState` trong component/hook | `searchTerm`, `error` trong hook |
| **Feature-shared** | Zustand store | Conversations, messages, participants |
| **App-global** | `chatStore` | CurrentUser, connectionState |
| **Server cache** | Zustand store (load from API) | Conversation list, message list |
| **Computed** | Selectors hoặc `useMemo` | Filtered conversations, typing display text |

**Quy tắc**:
- Không duplicate state giữa các stores
- Không mutate state trực tiếp — luôn dùng `set()` trong Zustand
- Mỗi store có method `reset()` để cleanup khi dispose
- Dùng immutable updates: `{ ...state, [key]: newValue }`

---

## 9. UI Component Guidelines

### 9.1. Cấu trúc component

- Mỗi component có **thư mục riêng** trong `src/components/`
- File chính là `index.tsx`
- Mỗi component export cả component lẫn props interface
- Sử dụng `React.FC<Props>` pattern

### 9.2. Render props pattern

Components hỗ trợ customization qua render props:

```tsx
// ChatContainer hỗ trợ custom rendering
export interface ChatContainerProps {
  renderConversationList?: (props: ConversationListRenderProps) => ReactNode;
  renderConversation?: (props: ConversationRenderProps) => ReactNode;
  renderEmpty?: () => ReactNode;
}

// ConversationList hỗ trợ custom item rendering
export interface ConversationListProps {
  renderItem?: (conversation: Conversation, isActive: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
  renderSearch?: () => ReactNode;
}
```

### 9.3. Reusable vs Feature-specific

| Loại | Đặt ở đâu | Ví dụ |
|---|---|---|
| **Reusable** | `components/Avatar/`, `components/Icons/`, `components/EmptyState/` | Avatar, Icons, LoadingState, ErrorState, EmptyState, SearchInput |
| **Feature-specific** | `components/ConversationList/`, `components/MessageList/` | ConversationList, ConversationItem, MessageItem |
| **Layout** | `components/ChatContainer.tsx` | ChatContainer (main layout) |
| **Provider** | `components/ChatProvider.tsx` | ChatProvider (init + context) |

### 9.4. Styling

- Sử dụng **SCSS Modules** (`*.module.scss`)
- Import: `import styles from './Component.module.scss'`
- ClassName: `className={styles.conversationItem}`
- Active/state classes: `` className={`${styles.item} ${isActive ? styles.active : ''}`} ``
- Inline styles chỉ dùng cho layout containers (`CSSProperties`)

### 9.5. Quy tắc UI

1. **Luôn handle 3 trạng thái**: Loading / Empty / Error
2. **Không hard-code** text, màu, spacing — dùng SCSS variables hoặc constants
3. **Component nhỏ, rõ trách nhiệm** — tách sub-component khi component quá lớn
4. **Support customization** — dùng render props cho phần có thể custom
5. **Unread badge** giới hạn hiển thị: `{count > 99 ? '99+' : count}`

### 9.6. Đa ngôn ngữ (i18n)

Dự án sử dụng `react-i18next` với một instance độc lập (`chatI18n`) để không xung đột với ứng dụng sử dụng library:
- Tất cả text trong UI **phải** được lấy qua hook `useTranslation()`
- Không hard-code strings trực tiếp trong components
- Consumer app có thể truyền `locale` ("en", "vi",...) qua `<ChatProvider locale="vi">`

```tsx
import { useTranslation } from 'react-i18next';

export const MyComponent = () => {
  const { t } = useTranslation();
  return <div>{t('chat.loading')}</div>;
}
```

---

## 10. Type Safety / Model Guidelines

### 10.1. Phân loại Types

| Loại | File | Mục đích |
|---|---|---|
| **API types** | `types/*.types.ts` | Contract với ACS SDK và consumers |
| **Domain models** | `models/*.ts` | Type aliases cho internal domain logic |
| **Store types** | `store/*Store.ts` | State shape + action types |
| **Component props** | Trong file component | Component public API |
| **Event types** | `types/events.types.ts` | Domain event payloads |
| **Error types** | `types/errors.types.ts` | Custom error class + error codes |

### 10.2. Discriminated Union Pattern

Conversation types sử dụng discriminated union:

```ts
export type Conversation = DirectConversation | GroupConversation;

// Type narrowing qua `type` field:
if (conversation.type === 'group') {
  console.log(conversation.name);  // TypeScript biết đây là GroupConversation
}
```

### 10.3. Quy tắc Type

1. **Không dùng `any`** — ESLint đã warn `@typescript-eslint/no-explicit-any: 'warn'`
2. **Nếu bắt buộc dùng `any`**: Giới hạn scope tối đa, kèm comment giải thích
   ```ts
   // Chỉ chấp nhận khi cần cast ACS SDK types không có typings chính xác
   const idObj = identifier as Record<string, unknown>;
   ```
3. **Luôn dùng `import type`** khi chỉ import type/interface
4. **Strict mode bật**: `"strict": true`, `"noUnusedLocals": true`, `"noUnusedParameters": true`
5. **Unused params**: Prefix `_` để skip — `_currentUserId` (theo ESLint rule `argsIgnorePattern: '^_'`)

### 10.4. Generic Types

```ts
// ChatDomainEvent với generic payload
export interface ChatDomainEvent<T = unknown> {
  type: ChatEventType;
  conversationId: string;
  timestamp: Date;
  payload: T;
}

// Sử dụng:
function normalizeChatMessageReceived(e: ChatMessageReceivedEvent): ChatDomainEvent<ChatMessage> { }
```

---

## 11. Quy Tắc Review Code

### Checklist cho Reviewer

#### Kiến trúc & Cấu trúc
- [ ] File được đặt đúng thư mục theo layer (adapter/service/store/hook/component)?
- [ ] Có tuân theo naming convention hiện tại?
- [ ] Có phá vỡ kiến trúc phân tầng (ví dụ: component gọi trực tiếp adapter)?
- [ ] Barrel exports (`index.ts`) đã được cập nhật?

#### Code Quality
- [ ] Code có đơn giản và dễ đọc không?
- [ ] Có duplicate logic với code hiện có không?
- [ ] Function/method có quá dài hoặc làm quá nhiều việc không?
- [ ] Component có quá nhiều trách nhiệm không?
- [ ] Có hard-code magic number/string không cần thiết không?

#### Data Safety
- [ ] Có validate dữ liệu từ API trước khi sử dụng không?
- [ ] Có handle null/undefined/empty array không?
- [ ] Có risk crash vì thiếu null check không?
- [ ] Response data có được map qua mapper function không?

#### State & Side Effects
- [ ] State mới có đặt đúng scope (local vs global)?
- [ ] Store có method `reset()` không?
- [ ] `useEffect` cleanup có đúng không?
- [ ] Có memory leak potential (event listener, timer chưa cleanup)?

#### UI Completeness
- [ ] Có handle loading state không?
- [ ] Có handle empty state không?
- [ ] Có handle error state không?
- [ ] Optimistic update có rollback khi fail không?

#### Type Safety
- [ ] Có dùng `any` không? Nếu có, lý do hợp lệ không?
- [ ] `import type` có được dùng khi chỉ import type?
- [ ] Types có rõ ràng, dễ hiểu không?

#### Impact Assessment
- [ ] Có ảnh hưởng module/feature khác không?
- [ ] Có breaking change cho consumer API không?
- [ ] Có cần thêm test không?
- [ ] Performance có bị ảnh hưởng không?

---

## 12. Quy Tắc Cho AI Agent Khi Sửa Code

### Trước khi sửa code

1. **Đọc file liên quan trước khi sửa** — Hiểu context đầy đủ
2. **Đọc barrel exports** (`index.ts`) của thư mục liên quan
3. **Đọc types** liên quan trong `src/types/`
4. **Kiểm tra existing patterns** — Tìm code tương tự đã có

### Khi sửa code

5. **Tuân theo structure hiện tại** — Đặt file đúng layer, đúng thư mục
6. **Không refactor lan rộng** nếu không được yêu cầu — Chỉ sửa phần được yêu cầu
7. **Không đổi convention đang có** — Giữ naming, import order, code style nhất quán
8. **Không xóa code không liên quan** — Comment, docstring, whitespace
9. **Không dùng `any` bừa bãi** — Tìm type chính xác hoặc dùng `unknown` + type guard
10. **Luôn kiểm tra dữ liệu API** trước khi render/sử dụng:
    ```ts
    const items = Array.isArray(response?.data) ? response.data : [];
    const name = typeof item?.name === 'string' ? item.name : '';
    ```
11. **Giữ code đơn giản, dễ review** — Ưu tiên explicit hơn implicit

### Sau khi sửa code

12. **Cập nhật barrel exports** nếu thêm/xóa file
13. **Nếu thêm module mới**, cập nhật tài liệu này nếu cấu trúc thay đổi
14. **Chạy typecheck**: `npm run typecheck`
15. **Chạy lint**: `npm run lint`
16. **Chạy test**: `npm run test`

### Pattern references cho AI Agent

| Cần làm gì | Tham khảo file |
|---|---|
| Tạo service mới | `services/messageService.ts` |
| Tạo store mới | `store/conversationStore.ts` |
| Tạo hook mới | `hooks/useMessages.ts` |
| Tạo component mới | `components/ConversationList/` |
| Map dữ liệu ACS | `adapters/acs/acsMappers.ts` |
| Xử lý error | `types/errors.types.ts` + `acsMappers.ts#mapAcsErrorToChatError` |
| Tạo adapter mới | `adapters/acs/acsThreadAdapter.ts` |
| Tạo selector | `store/selectors.ts` |
| Normalize event | `adapters/acs/acsEventAdapter.ts` |
| Optimistic update | `services/messageService.ts#sendMessage` |

---

## 13. Checklist Khi Thêm Feature Mới

- [ ] Đã đặt file đúng thư mục theo layer
- [ ] Đã định nghĩa types trong `src/types/`
- [ ] Đã tạo model trong `src/models/` (nếu cần)
- [ ] Đã tách API/adapter logic khỏi service
- [ ] Đã tạo service với singleton pattern
- [ ] Đã tạo store với initial state + reset method
- [ ] Đã tạo selectors trong `store/selectors.ts`
- [ ] Đã tạo hook wrap service + store subscription
- [ ] Đã kiểm tra response API (null, undefined, empty, wrong type)
- [ ] Đã handle loading state
- [ ] Đã handle empty state
- [ ] Đã handle error state
- [ ] Đã implement optimistic update + rollback (nếu cần)
- [ ] Đã tránh duplicate code
- [ ] Đã giữ component đơn giản
- [ ] Đã cập nhật barrel exports (`index.ts`)
- [ ] Đã kiểm tra lint/typecheck/test: `npm run lint && npm run typecheck && npm run test`

---

## 14. Những Điều Không Nên Làm

### Anti-patterns

| ❌ Không nên | ✅ Nên làm thay thế |
|---|---|
| Viết toàn bộ logic trong một component lớn | Tách hook + service + component |
| Gọi ACS SDK trực tiếp trong component | Gọi qua service → adapter → ACS SDK |
| Gọi ACS SDK trực tiếp trong hook | Gọi qua service singleton |
| Tin tưởng API response tuyệt đối | Validate + fallback cho mọi field |
| Dùng `any` để né type error | Dùng `unknown` + type guard hoặc tìm type chính xác |
| Hard-code magic number/string | Tạo constant trong `constants/` |
| Copy-paste logic giữa các service | Tách helper function vào `utils/` |
| Refactor nhiều file không liên quan | Chỉ sửa phần liên quan đến task |
| Bỏ qua error/empty/loading state | Luôn handle cả 3 trạng thái |
| Thêm dependency mới khi chưa cần | Kiểm tra utils/helpers hiện có trước |
| Mutate state trực tiếp | Dùng immutable updates trong store |
| Lưu state duplicate giữa stores | Dùng selectors để derive data |
| Import raw ACS types vào component | Map qua mapper → internal types |
| Tạo store action quá phức tạp | Tách logic vào service, store chỉ set/get |
| Quên cleanup timer/listener | Luôn cleanup trong dispose/unmount |

---

## 15. Kết Luận

### Tinh thần phát triển dự án

1. **Code đơn giản** — Ưu tiên code dễ đọc, dễ hiểu. Mỗi function/component chỉ làm một việc.

2. **Clean code** — Tuân theo naming convention, tổ chức import rõ ràng, tách trách nhiệm rõ ràng giữa các layer.

3. **Dễ bảo trì** — File nhỏ, responsibilities rõ ràng, patterns nhất quán. Developer mới đọc một file là hiểu pattern áp dụng cho cả dự án.

4. **Dễ mở rộng** — Kiến trúc phân tầng + adapter pattern cho phép thêm feature mới mà không ảnh hưởng code hiện tại. Thay ACS bằng provider khác chỉ cần viết adapter mới.

5. **Tôn trọng kiến trúc hiện tại** — Không refactor rộng khi chỉ cần sửa nhỏ. Tuân theo patterns đã thiết lập.

6. **Luôn kiểm tra kỹ dữ liệu từ API** — Defensive programming. Không để app crash vì thiếu field hoặc wrong type từ backend/SDK.

7. **Type safety trước tiên** — Strict TypeScript mode, avoid `any`, leverage discriminated unions và generics.

---

> **Lưu ý**: Tài liệu này được tạo dựa trên phân tích source code thực tế. Một số module đang ở dạng placeholder (domain/, utils/debounce, utils/throttle, utils/retry, constants/defaults, ErrorState, LoadingState, MessageItem...) — cần kiểm chứng thêm khi implement đầy đủ.

> **Cập nhật cuối**: Tài liệu cần được cập nhật khi có thay đổi lớn về kiến trúc hoặc convention.
