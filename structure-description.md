# Cấu trúc thư viện @namphuong/acs-chat-react

Thư viện `@namphuong/acs-chat-react` được thiết kế dựa trên **Layered Architecture** (kiến trúc phân tầng) kết hợp với **Adapter Pattern**. Cách thiết kế này giúp tách biệt rõ ràng giữa giao diện người dùng (UI), logic nghiệp vụ (Business Logic), quản lý trạng thái (State) và hạ tầng kết nối backend (ACS SDK).

## 1. Kiến trúc tổng thể

```text
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

**Luồng dữ liệu hoạt động:**
1. **Hooks**: Cung cấp API để Consumer App tương tác, gọi tới các Services.
2. **Services**: Chịu trách nhiệm thực thi các logic nghiệp vụ và yêu cầu các Adapters hành động.
3. **Adapters**: Là tầng giao tiếp trực tiếp với Azure Communication Services (ACS SDK). Dữ liệu thô từ ACS sẽ đi qua các **Mappers** để biến đổi thành dữ liệu chuẩn nội bộ.
4. **Store (Zustand)**: Nhận dữ liệu đã qua xử lý chuẩn hoá để lưu trữ.
5. **Components**: Các React Hooks theo dõi (subscribe) vào Store, tự động re-render UI Components khi State có sự thay đổi.
6. **Real-time Events**: Các sự kiện thời gian thực (tin nhắn mới, trạng thái typing, v.v...) được thu thập qua `AcsEventAdapter`, truyền ngược lên `ChatService` để xử lý và tự động cập nhật vào `Store`.

## 2. Cấu trúc thư mục (Directory Structure)

Thư mục chính `src/` được chia thành các folder theo nhóm tính năng và quy tắc phân tầng:

```text
src/
├── __tests__/              # Tích hợp Tests (Integration tests)
├── adapters/               # Tầng Infrastructure: Chứa các wrapper bao bọc ACS SDK, và các hàm convert dữ liệu (Mappers)
├── components/             # Tầng UI: Chứa các React components (ChatContainer, ConversationList, MessageList,...)
├── constants/              # Chứa các giá trị cấu hình tĩnh (default values, event name, error codes,...)
├── domain/                 # Chứa pure logic cho các domain (conversation, message,...)
├── hooks/                  # React Hooks (Public API) cung cấp cho ứng dụng ngoài (useChat, useMessages,...)
├── models/                 # Alias type nội bộ cho các entity chính
├── providers/              # React Context Providers (như ChatContext để DI)
├── services/               # Tầng Business Logic: Các service dạng Singleton quản lý logic cốt lõi
├── store/                  # Tầng State Management: Chứa Zustand stores lưu trạng thái (chat, messages, participants,...)
├── types/                  # Định nghĩa TypeScript interfaces & types toàn cục
├── utils/                  # Các hàm tiện ích (date formatter, id generator, logger,...)
├── index.ts                # Entry point: Export components, hooks và types cho người dùng import
└── vite-env.d.ts           # Type declarations cho Vite
```

### Chức năng chi tiết của các modules chính:

| Thư mục | Mục đích sử dụng |
|---|---|
| **`adapters/`** | Giao tiếp trực tiếp với external SDK (Azure ACS). Đóng gói logic gọi SDK giúp dễ dàng mock khi test hoặc thay thế nhà cung cấp khác nếu cần. |
| **`components/`** | Cung cấp UI Components sẵn sàng dùng. Các component này thuần hiển thị và đọc dữ liệu qua Hooks, không gọi API hay chứa logic nghiệp vụ phức tạp trực tiếp. |
| **`hooks/`** | Cầu nối giữa UI và logic. Cung cấp API trực quan (như `useMessages`, `useTypingIndicator`) để custom UI bên ngoài dễ dàng truy cập và sử dụng library. |
| **`services/`** | Nơi chứa logic cốt lõi. Làm nhiệm vụ điều phối (orchestration): kết nối Adapter, đồng bộ dữ liệu và ra lệnh cập nhật trạng thái vào Store. |
| **`store/`** | Quản lý trạng thái bộ nhớ cục bộ bằng Zustand. Tối ưu hoá lưu trữ dạng chuẩn hoá (normalized state) giúp dễ truy xuất, deduplicate dữ liệu. |
| **`types/`** & **`models/`** | Định nghĩa Data Contract rõ ràng. Đảm bảo Type Safety với TypeScript cho mọi layer tương tác với nhau trong thư viện. |

## 3. Integration Layer (2 Approaches)

Thư viện hỗ trợ **hai cách tích hợp** để đáp ứng nhiều nhu cầu khác nhau:

| Approach | Mô tả | Khi nào dùng |
|---|---|---|
| **A — Built-in UI** | Sử dụng các component UI có sẵn của thư viện, tuỳ biến qua CSS Variables / Render Props / Component Overrides | Muốn nhanh, ít effort, chấp nhận layout mặc định |
| **B — Headless (Custom UI)** | Chỉ sử dụng public APIs (hooks, types, services) để tự xây dựng UI hoàn toàn | Muốn kiểm soát 100% giao diện, tích hợp vào design system riêng |
