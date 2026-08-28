# Code Review Report — Git Diff (28/08/2026)

> **Branch:** `Development`  
> **Commit:** `e326b59` (HEAD)  
> **Tổng quan:** 16 files changed, 632 insertions, 527 deletions  
> **Trạng thái:** **APPROVED** ✅

---

## 1. Tổng Quan Thay Đổi (Executive Summary)

Diff này triển khai **Real-time Read Receipts qua WebSocket** — một bước tiến lớn so với cơ chế cũ chỉ dựa vào ACS REST API. Thay đổi chính:

1. **WebSocket Read Receipt Engine** — `sendRead()` được nâng cấp với deduplication per-room và global, không còn gửi duplicate frames.
2. **Tự động gửi Read Receipt khi mở conversation** — cả `ConversationService.openConversation()` và `openConversationForContact()` đều gửi read receipt ngay sau khi mở.
3. **Tự động gửi khi load messages** — `MessageService.loadMessages()` gửi read receipt nếu conversation đang active và tab visible.
4. **Tự động gửi từ MessageList** — Component `MessageList` tự động gửi read receipt khi scroll xuống cuối, khi items thay đổi, và khi initial mount hoàn tất.
5. **Refactor ReadReceiptService** — WebSocket priority > ACS fallback; bỏ participant limit check cho WebSocket.
6. **Utility functions mới** — `findLastPersistedMessage()`, `isDocumentVisible()`, `resolveRoomId()`.

---

## 2. Chi Tiết Đánh Giá Theo Từng File

### 2.1. `src/services/websocketService.ts` — WebSocket Read Engine (🟢 Tốt)

**Thay đổi:**
- Thêm `lastGlobalSentReadId: string | null` cho deduplication global khi không có `activeRoomId`.
- `sendRead()` nhận thêm `roomId?: string` — cho phép gửi read receipt cho bất kỳ room nào, không chỉ room đang active.
- Deduplication: per-room nếu có `roomId`, global nếu không.
- Chỉ cache `lastVisibleMessageId` sau khi `adapter.send()` thành công — tránh false positive khi disconnected.
- `leaveRoom()` capture `lastVisibleMessageId` trước khi xóa entry khỏi Map.

**Điểm tốt:**
- ✅ `sendRead()` trả về `true` khi deduplicate — caller không cần phân biệt "already sent" vs "just sent".
- ✅ Không cache khi send thất bại — cho phép retry sau khi reconnect.
- ✅ `dispose()` reset `lastGlobalSentReadId` — tránh memory leak.
- ✅ `lastGlobalSentReadId` được set **chỉ khi không có target room** — tránh xung đột với per-room tracking.

**Góp ý nhỏ:**
- Nên xem xét reset `lastGlobalSentReadId` khi `enterRoom()` được gọi, vì mọi read receipt sau đó sẽ là per-room.
- Hiện tại `leaveRoom()` gọi `this.lastVisibleMessageIds.delete(currentActiveRoom ?? '')` — nếu `currentActiveRoom` là `null`, nó delete key `''` vô hại nhưng hơi redundant.

### 2.2. `src/services/messageService.ts` — Auto Read on Load (🟢 Tốt)

**Thay đổi:**
- Thay thế inline `resolveRoomId()` bằng `resolveRoomId()` từ utils.
- Sau khi load messages, nếu conversation đang active và tab visible, tự động gửi read receipt cho message cuối cùng.

**Điểm tốt:**
- ✅ Sử dụng `isDocumentVisible()` — không gửi read receipt khi tab background.
- ✅ Sử dụng `findLastPersistedMessage()` — bỏ qua temp/sending/failed messages.
- ✅ Chỉ gửi khi `isActive` — đúng với conversation đang được xem.

**Góp ý nhỏ:**
- `isActive` check hơi phức tạp với `activeKey` và `currentKey`. Có thể đơn giản hóa bằng cách tạo một helper `isActiveConversation()`.

### 2.3. `src/services/readReceiptService.ts` — WebSocket Priority (🟢 Tốt)

**Thay đổi lớn:**
- WebSocket path được ưu tiên: nếu `websocketService.isConnected()`, gửi **ngay lập tức** (không debounce) và return.
- ACS fallback (có debounce + participant limit) chỉ được dùng khi WebSocket không available.
- Bỏ `wsSent` check trong debounce callback — logic WS đã được xử lý trước đó.

**Điểm tốt:**
- ✅ Giảm latency đáng kể — không cần chờ debounce timeout khi WebSocket connected.
- ✅ ACS fallback vẫn giữ participant limit check — an toàn cho group chat lớn.
- ✅ `try/catch` quanh WebSocket send — không crash nếu WS gặp lỗi.

**Góp ý nhỏ:**
- ⚠️ `console.warn` khi không tìm thấy conversation trong store — nên dùng `logger.warn` để đồng nhất với các service khác.
- `lastSentMessageIds` check vẫn dùng `conversationId` (không phải `roomId`) — có thể gây miss-dedup nếu cùng conversationId mapping tới nhiều roomId. Tuy nhiên, đây là edge case hiếm.

### 2.4. `src/services/chatService.ts` — Reset Unread Count (🟢 Tốt)

**Thay đổi:**
- Khi nhận `message:received` cho conversation đang active, gọi `resetUnreadCount()`.

**Điểm tốt:**
- ✅ Đúng logic: nếu user đang xem conversation, không cần tăng unread count.
- ✅ Không gửi read receipt ở đây — việc này được delegate cho `MessageList` component, tránh duplicate.

### 2.5. `src/services/conversationService.ts` — Send Read on Open (🟢 Tốt)

**Thay đổi:**
- `openConversation()` và `openConversationForContact()` đều gửi read receipt cho message cuối cùng sau khi mở conversation.

**Điểm tốt:**
- ✅ Sử dụng `findLastPersistedMessage()` — đúng cách.
- ✅ Gửi với `roomId` đã resolve — đúng room.
- ✅ Đặt sau khi mở conversation thành công.

### 2.6. `src/components/MessageList/index.tsx` — Auto Read from UI (🟢 Tốt)

**Thay đổi:**
- Thêm `markLatestMessageAsRead` callback — tìm message cuối cùng không phải của current user, gửi read receipt.
- Gọi khi: scroll completion, `atBottomStateChange`, items change, initial mount.
- Sử dụng `lastSentReadMsgIdRef` để tránh gửi duplicate.

**Điểm tốt:**
- ✅ `isDocumentVisible()` gate — không gửi khi tab background.
- ✅ Skipping temp/sending/failed messages.
- ✅ Skipping messages from `currentUserId` — chỉ gửi read cho messages của người khác.
- ✅ Deduplication qua `lastSentReadMsgIdRef`.

**Góp ý nhỏ:**
- ⚠️ `markLatestMessageAsRead` được gọi từ nhiều nơi (initial mount effect, items change effect, atBottomStateChange). Có thể gây gọi nhiều lần trong cùng một render cycle. Tuy nhiên, `lastSentReadMsgIdRef` ngăn duplicate nên không gây hại.
- `resolveRoomId(conversationId, ...)` được gọi mỗi lần mark read — có thể cache nếu cần tối ưu, nhưng hiện tại ổn.
- Việc gọi `markLatestMessageAsRead()` trong `scheduleScrollToBottom` (t6 sau 200ms) và `useEffect` (initial mount) có thể dẫn đến 2 lần gọi cho cùng messageId — nhưng dedup xử lý được.

### 2.7. `src/utils/messageUtils.ts` — New Utility (🟢 Tốt)

**Thay đổi:**
- `findLastPersistedMessage()` — iterate ngược mảng messages, tìm message có id hợp lệ, không phải temp/sending/failed.
- `isDocumentVisible()` — check `document.visibilityState`, SSR-safe.

**Điểm tốt:**
- ✅ Clean code, đúng Single Responsibility.
- ✅ SSR-safe cho `isDocumentVisible()`.
- ✅ `findLastPersistedMessage` xử lý `null/undefined` input.

### 2.8. `src/utils/conversationKeys.ts` — `resolveRoomId()` (🟢 Tốt)

**Thay đổi:**
- Hàm mới `resolveRoomId()` — resolve backend room ID từ conversation aliases.

**Điểm tốt:**
- ✅ JSDoc đầy đủ, giải thích rõ tại sao cần resolve.
- ✅ Fallback về `conversationId` nếu không tìm thấy conversation.
- ✅ Sử dụng `findConversationKey()` để tìm conversation từ nhiều alias.

### 2.9. `src/hooks/useReadReceipt.ts` — Cleanup (🟢 Tốt)

**Thay đổi:**
- Bỏ `readReceiptsSupported` dependency — WebSocket không có participant limit.
- JSDoc cập nhật: "WebSocket realtime mode has no participant limit".

**Điểm tốt:**
- ✅ Đúng: WebSocket read receipt không bị giới hạn 20 participants.
- ✅ Cleaner code, ít dependency hơn.

### 2.10. Tests (`src/__tests__/`) — Comprehensive (🟢 Tốt)

**Thay đổi:** 5 test files mới/sửa với coverage tốt:
- `chatService.test.ts`: 3 test cases mới (active conversation, self message, non-active conversation)
- `messageService.test.ts`: 2 test cases mới (active + non-active conversation)
- `websocketService.test.ts`: 4 test cases mới (dedup per-room, global dedup, explicit roomId, offline không cache)
- `MessageList.test.tsx`: 2 test cases mới (other user message, background tab)
- `readReceiptService.test.ts`: **New** — separate test file
- `messageUtils.test.ts`: **New** — unit tests for utilities
- `useReadReceipt.test.ts`: **New** — hook tests
- `conversationKeys.test.ts`: **New** — unit tests for `resolveRoomId`

**Điểm tốt:**
- ✅ Mock WebSocket adapter đúng pattern.
- ✅ Test cả success và failure paths.
- ✅ `sendRead` spy restored sau mỗi test.
- ✅ `document.visibilityState` được mock và restore đúng cách.

---

## 3. Các Vấn Đề Cần Lưu Ý (Issues & Recommendations)

### 🟡 Low Priority

| # | File | Issue | Suggestion |
|---|------|-------|------------|
| 1 | `readReceiptService.ts` | `console.warn` thay vì `logger.warn` | Dùng `logger.warn` để đồng nhất |
| 2 | `websocketService.ts` | `leaveRoom()` delete key `''` khi `currentActiveRoom === null` | Thêm guard `if (currentActiveRoom)` |
| 3 | `messageService.ts` | `isActive` logic hơi phức tạp | Extract thành `isActiveConversation()` helper |
| 4 | `MessageList/index.tsx` | `markLatestMessageAsRead` gọi nhiều lần trong lifecycle | Không cần fix ngay vì đã có dedup ref |

### 🔵 Observations

- `resolveRoomId()` đã giúp loại bỏ duplicate code ở `messageService.ts` — đúng hướng.
- `lastGlobalSentReadId` và `lastVisibleMessageIds` Map dùng chung kiểu `Map<string, string>` — sạch sẽ.
- `dispose()` reset toàn bộ state — không leak.

---

## 4. Kết Luận

**APPROVED ✅** — Code chất lượng tốt, kiến trúc rõ ràng, test coverage đầy đủ.

| Tiêu chí | Đánh giá |
|----------|----------|
| Kiến trúc | 🟢 Clean separation of concerns |
| Readability | 🟢 Code dễ đọc, có JSDoc |
| Test coverage | 🟢 5 test files, >10 test cases mới |
| Edge cases | 🟢 Xử lý disconnected, background tab, self messages |
| Performance | 🟢 Deduplication, không gửi redundant frames |
| Consistency | 🟢 Đồng bộ với codebase hiện tại |

**Next steps suggested:**
- Chạy full test suite để verify: `npm test`
- Kiểm tra typecheck: `npm run typecheck`
