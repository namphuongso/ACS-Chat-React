# Code Review — np-acs-library 1.1.0 → 1.2.0

- **Branch:** `Production`
- **Ngày review:** 2026-08-21
- **Phạm vi:** Toàn bộ `git diff HEAD` (staged + unstaged working tree) — 76 files, +7228/−1840
- **Xác minh bằng công cụ:**
  - `npm run typecheck` — ✅ sạch
  - `npm test` — ✅ 47 files / 335 tests passed

## Tóm tắt thay đổi

1. **Realtime layer mới:** bỏ ACS signaling SDK (`AcsEventAdapter` bị xóa, `AcsClientAdapter` không còn realtime notifications), thay bằng WebSocket protocol tự định nghĩa: `websocketAdapter`, `websocketMappers`, `websocketService`, hook `useWebSocket`, `websocket.types`.
2. **Store refactor:** conversation key dạng alias-aware (`registry.ts`, `conversationKeys.ts` — _chưa track_), viết lại `messageStore` (dedup, jump target, highlight, pinned, continuation token), `conversationStore`, `participantStore`.
3. **Services chuyển sang backend API:** `messageService` (`/api/chat/get-messages`, `send-message`, `update-message`…), `fileService` (upload chunked qua `@namphuongtechnologi/azure-blob-transfer`), `readReceiptService` (WS trước, ACS fallback).
4. **UI:** rich-text formatting, pinned messages + banner, jump-to-message + highlight, IME guard, empty-state validation, placeholder mới.
5. **Packaging:** bump 1.2.0, staged `.tgz` mới, thêm dependency `dompurify` (runtime) + `@namphuongtechnologi/azure-blob-transfer` (`file:` tarball).

---

## Critical

### C1. XSS qua tin nhắn rich-text — staged không sanitize, worktree sanitize sai thứ tự

- **Staged** (`src/components/MessageItem/index.tsx:221`): `dangerouslySetInnerHTML={{ __html: normalizeFormattingHtml(message.content) }}` — **không có sanitize nào**. Content từ server/WS render thẳng → attacker gửi `<img src=x onerror=...>` là chạy JS trong phiên người khác.
- **Worktree** (`src/components/MessageItem/index.tsx:221`): `sanitizeHtml(normalizeFormattingHtml(content))` — vẫn **sai thứ tự**: `normalizeFormattingHtml` parse HTML lạ bằng `div.innerHTML` (`src/utils/htmlUtils.ts:134-137`) **trước** khi DOMPurify chạy; `onerror` của `<img>` vẫn fire trong bước parse đó. Fast-path regex của normalize cũng dễ thỏa mãn (chỉ cần thêm `<u><font size=3>…`).
- `sanitizeHtml` (`src/utils/htmlUtils.ts:152-154`) **fail-open**: `catch { return html; }` — DOMPurify lỗi là render HTML thô.
- **Fix:** `sanitizeHtml(content)` trước → rồi mới normalize; catch phải fail-closed (escape text hoặc trả chuỗi rỗng). Nếu tarball 1.2.0 được build từ cây staged thì gói publish đang dính XSS — cần rebuild sau khi sửa.

### C2. Cây staged và worktree lệch nhau về bản vá quan trọng — rủi ro release

Nhiều bản sửa chỉ tồn tại ở **unstaged worktree** (chưa `git add`):

| Vấn đề                                                         | Staged                     | Worktree                                                        |
| -------------------------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| Sanitize HTML (C1)                                             | ❌ không có                | ⚠️ có nhưng sai thứ tự                                          |
| `firstItemIndex` offset cho `scrollToIndex`/jump               | ❌ thiếu → jump sai vị trí | ✅ đã sửa                                                       |
| `initialTopMostItemIndex`                                      | ✅ đúng (local index)      | ❌ over-correct (cộng thêm `firstItemIndex`) — xem H7           |
| Adapter: xử lý socket CLOSED stale, promise connect/disconnect | bản cũ                     | bản mới                                                         |
| Refactor alias keys                                            | inline                     | tách sang `registry.ts` + `conversationKeys.ts` (**untracked**) |

Ngoài ra `src/store/registry.ts` và `src/utils/conversationKeys.ts` **chưa được track**: commit worktree mà chỉ `git add -u` sẽ thiếu 2 file này → **build gãy**. Cần `git add` tường minh trước khi commit.

---

## High

### H1. Reconnect chết vĩnh viễn nếu socket kẹt ở `CONNECTING`

`WebSocketAdapter.connect()` (`src/adapters/websocket/websocketAdapter.ts:104-121`) gặp socket `CONNECTING` thì `resolve()` ngay; `WebsocketService.scheduleReconnect` (`src/services/websocketService.ts:349-378`) bọc `connect()` bằng `Promise.race` timeout 15s nhưng khi timeout, socket treo **không bị hủy/bỏ**. Các lần retry sau đều short-circuit qua guard CONNECTING, `isConnected()` luôn false → đốt hết `maxRetries` → "Max reconnection retries reached" và không bao giờ thử lại nữa (không có recovery nào khác — xem H3/M2).
**Fix:** sau race timeout phải `disconnect()`/discard socket treo rồi tạo socket mới.

### H2. `heartbeatTimeoutSeconds` được parse nhưng không bao giờ enforce

`websocketService.ts:144-155, 194-197`: timeout heartbeat là config chết; `heartbeat_ack` là no-op, không có watchdog/pong tracking. Kết nối TCP chết (NAT drop, máy sleep) không phát `onclose` → app "connected" mãi mãi, không nhận được tin nhắn, không tự sửa.
**Fix:** theo dõi ack, quá hạn thì `adapter.disconnect()` để触发 reconnect.

### H3. Trạng thái kết nối & event legacy: UI nói "connected" nhưng realtime có thể không có

- `chatService.ts:111`: `setConnectionState('connected')` **vô điều kiện** ngay sau init — kể cả khi `enableWebSocket: false`, WS không có URL, hoặc connect thất bại (WS init là fire-and-forget, lỗi chỉ log).
- WS phát `ws:connected`/`ws:disconnected` nhưng `chatService.handleDomainEvent` không map chúng vào `chatStore.connectionState`; các case `connection:connected`/`connection:disconnected` (`chatService.ts:465-471`) là dead code vì không còn ai emit.
- Hệ quả kép: `connectionService.handleOnline` (`connectionService.ts:24-30`) chỉ reconnect khi `connectionState !== 'connected'` — mà state luôn là 'connected' từ init → **mất mạng rồi có lại cũng không resync**; subscription `connection:disconnected` của `connectionService` cũng chết.
- `typing:started`, `readReceipt:received` không còn được emit từ bất kỳ đâu → typing indicator của người khác không hiện; read receipt người khác gửi không cập nhật realtime (chỉ WS `read` chiều gửi đi hoạt động).
  **Fix:** map `ws:*` → `connectionState`; quyết định rõ story cho typing/readReceipt (map từ WS hoặc ghi breaking change rõ trong CHANGELOG).

### H4. Dedup tin nhắn: lỗ hổng cửa sổ 0–30s và lệch giờ >30s

`dedupAndSortMessages` (`src/store/messageStore.ts:157-353`):

1. **0–30s re-send:** `isConfirmationOf` chấp nhận `confirmedTime >= optimisticTime − 30s`. Nếu user gửi 2 tin **giống hệt nhau** liên tiếp trong 30s và tin 1 đã confirmed (mà WS push/loadMessages không mang `clientMessageId` — đúng thực tế vì `sendMessage` không gửi `clientMessageId` lên backend, `messageService.ts:381-388`), tin 2 (optimistic temp) bị coi là duplicate của tin 1 → **bị drop** khỏi UI cho tới khi confirm thật về. Test hiện tại (`messageStore.test.ts:197-222`) né đúng khe này bằng `now − 55s`.
2. **Lệch giờ:** nếu đồng hồ client **nhanh hơn server >30s**, message confirmed từ server fail check `isConfirmationOf` → không replace được optimistic temp, final cleanup cũng bỏ qua → **duplicate vĩnh viễn** (temp + confirmed). Code cũ không có gate timestamp này.
   **Fix:** gửi `clientMessageId` trong payload `send-message` (để mapper WS khôi phục được), tie-break theo `clientMessageId`, và tolerance hai chiều.

### H5. `loadMessages` merge thay vì replace — message bị xóa/recall phía server không bao giờ biến mất client-side

`messageService.ts:79-153`: trang mới merge với store cũ (`dedupAndSortMessages(currentMessages, messages)` rồi `setMessages`). Tin đã bị xóa trên server vẫn nằm lại client mãi. Thêm: không có guard thứ tự request — 2 `loadMessages`/`loadMore` song song last-write-wins trên cursor.

### H6. Giả định thứ tự `items[0]` = mới nhất, không truyền sort param

`messageService.ts` (`loadLatestMessage`:187-201, `loadMessages`, `loadMore`): gọi `get-messages?pageSize=N` không có `sort/order`; code giả định backend trả **mới nhất trước**. Nếu backend phân trang cũ→mới, mọi resync sẽ lấy tin **cũ nhất** làm "latest". `options.startTime` trong public signature cũng bị bỏ qua âm thầm. Cần xác nhận contract backend.

### H7. Jump-to-message: staged thiếu offset, worktree sửa nhưng lại over-correct `initialTopMostItemIndex`

- **Staged** (`MessageList/index.tsx` executeScroll/scrollToIndex/scrollToBottom): dùng `index: targetIndex` thô, không cộng `firstItemIndex` (bắt đầu ở 1.000.000) → mọi jump/scroll-to-bottom đáp sai chỗ khi đã prepend trang cũ.
- **Worktree** sửa đúng các điểm trên (`firstItemIndex + targetIndex`, kiểm chứng `scrollToIndex` của virtuoso cần virtual index) nhưng đổi `initialTopMostItemIndex={items.length - 1}` thành `firstItemIndex + items.length - 1`. Đọc nội bộ `react-virtuoso` (dist/index.mjs: hàm `qo`/`Cn`/`Xn`): virtuoso **tự cộng `firstItemIndex`** bên trong cho `initialTopMostItemIndex` và clamp theo `initialItemCount` local — tức **giá trị local mới đúng**, bản worktree là over-correction (anchor rơi ra ngoài danh sách).
- **Fix:** staged đúng cho `initialTopMostItemIndex`, worktree đúng cho `scrollToIndex/executeScroll` — cần hợp nhất cả hai, không phiên bản nào trọn vẹn.

### H8. `jumpTarget.conversationId` không được validate ở `MessageList`

`MessageList/index.tsx:318-329`: effect phản ứng với **mọi** `jumpTarget?.messageId` bất kể `conversationId`. Target lạ/stale (vd bấm banner pin của hội thoại khác) khiến list hiện tại loop `onLoadMore` tới 30 lần (`:351`) tìm message không bao giờ xuất hiện, rồi `clearJumpTarget()` xóa luôn target của hội thoại đúng. `useMessages.jumpToMessage` (`useMessages.ts:99-104`) đã stamp `conversationId` — consumer chỉ việc check.

---

## Medium

- **M1. Room targeting mơ hồ:** `roomId` vừa nằm trong query URL connect (`websocketAdapter.buildWebSocketUrl`) vừa được gửi lại `enter_room` khi handshake (`websocketService.ts:166-168`) — double join nếu server coi URL param là join. `leave_room`/`read` **không mang roomId** → target theo "phòng active" ngầm. `lastVisibleMessageIds` chỉ tăng, không prune.
- **M2. Không có recovery sau khi cạn retries** (liên quan H1/H3): hết `maxRetries` là thôi; `connectionService.handleOnline` bị chặn bởi state 'connected' ảo.
- **M3. Reconnect loop không có generation counter:** `dispose()` đặt `isExplicitlyClosed=true` nhưng `initialize()` reset nó ngay; loop reconnect cũ còn chạy sẽ tiếp tục với adapter/config mới → race với connection mới, và `isReconnecting` cũ có thể chặn `scheduleReconnect` hợp lệ.
- **M4. Plain vs HTML payload bất nhất:** `MessageInput.handleSend` luôn gửi `innerHTML` của contentEditable; `ConversationFooter.tsx:137-144` chỉ đính `type:'html'` khi bật format mode. Tin plain nhiều dòng (Shift+Enter → `<div>…</div>`) đi với type mặc định `'text'` → người nhận render escape, thấy markup thô.
- **M5. `sendMessage` khi server không trả `serverMessageId` hợp lệ:** optimistic temp trong store giữ `status:'sending'` vĩnh viễn (hàm return 'sent'), chỉ WS echo mới cứu được.
- **M6. Resolve `roomId` trong `sendMessage`/`editMessage`** (`conversations[id]?.conversationId || id`) không đi qua `getRoomId()`/alias index như các hàm khác → không nhất quán khi gọi bằng alias (`threadId`).
- **M7. Dependency `file:` tarball:** `"@namphuongtechnologi/azure-blob-transfer": "file:../../azure-storage-large-file/….tgz"` (`package.json:60`) — consumer cài từ npm không resolve được đường dẫn tương đối. Cần publish gói này hoặc bundle.
- **M8. `.tgz` artifact commit trong repo + xuất xứ tarball:** `namphuongtechnologi-acs-chat-react-1.2.0.tgz` được stage (bản 1.1.0 bị xóa). Binary không nên nằm trong git; quan trọng hơn, nếu tarball build từ cây staged thì nó mang theo C1 (không sanitize) + H7 (jump gãy).
- **M9. `fetchBackend` không có timeout/`AbortController`** (`src/utils/apiClient.ts`) — request treo là treo luôn cả operation.
- **M10. Token trong WS URL query** (`access_token`, `websocketAdapter.ts:75`) — token có thể rơi vào access log/proxy. Cân nhắc `Sec-WebSocket-Protocol` hoặc vé ngắn hạn.
- **M11. Close code 1000 từ server → không reconnect** (`websocketService.handleClose`); 4001 (duplicate session) cũng không reconnect, không có UX takeover. Cả hai im lặng.
- **M12. `useWebSocket.enterRoom`** set local `activeRoomId` kể cả khi send thất bại (UI state lệch thật).
- **M13. `adapter.disconnect()` tự sinh `CloseEvent` và luôn gọi onClose callbacks kể cả khi chưa từng connect** — `websocketService.handleClose` sẽ dispatch `ws:disconnected` trong dispose(); hiện vô hại nhưng dễ gây surprise về sau.
- **M14. CHANGELOG thiếu breaking changes:** chưa ghi rõ việc mất `typing:*`, `readReceipt:received`, `connection:*` events; `uploadFile` đổi error behavior; `sendMessage/edit/delete` chuyển sang backend API.

---

## Low / Nits

- `VERSION` trong `src/index.ts` vẫn `'1.0.0'` trong khi `package.json` là 1.2.0 (có từ trước, nên sửa luôn).
- `.gitignore` thêm `*.docx` toàn cục — hơi rộng, có thể ignore nhầm tài liệu khác.
- `dompurify` chuyển từ devDependencies → dependencies: đúng, cần thiết.
- Test suite không reset `useMessageStore` giữa các test (highlight timer 2500ms có thể leak giữa tests).
- `WS_ERROR_CODES` export ra nhưng chưa thấy consumer xử lý error code cụ thể nào.
- Comment thừa `// 1.` `// 2.` trong dedup thì ok, nhưng `messageMap.delete(msg.clientMessageId)` (xóa key trùng clientMessageId) khó hiểu — nên có comment lý do.

---

## inconsistenci staged ↔ worktree — khuyến nghị commit

1. `git add src/store/registry.ts src/utils/conversationKeys.ts` (2 file untracked đang được worktree import).
2. Stage toàn bộ worktree fixes (sanitize, MessageList offsets, adapter, services, stores) — cây staged hiện tại thiếu chúng.
3. Trước khi sửa xong C1/H7: **không** publish/rebuild tarball 1.2.0 từ cây staged.

---

## Security review

1. **XSS rich-text** — Critical (C1): staged = không sanitize; worktree = sanitize sau parse + fail-open. Sửa thứ tự + fail-closed.
2. **WS token trong URL query** (M10) — log/proxy leak.
3. **`img src` từ payload WS** — render không có `referrerpolicy`; thêm `referrerpolicy="no-referrer"` cho ảnh remote.
4. **Auth forwarding** — `backendHeaders`/`uploadHeaders` merge nhất quán ở `fetchBackend` và 3 endpoint upload: OK.
5. **DOMPurify defaults** cho phép `style`, `font[size]` — chỉ lạm dụng cosmetic, không phải script XSS.

## Test coverage gaps

- WS: socket kẹt `CONNECTING` (H1), heartbeat watchdog (H2), duplicate-session close, dispatch khi không có ChatService.
- Store: dedup khe 0–30s và lệch giờ >30s (H4 — cả 2 buggy path đều chưa test), jump target khác conversation (H8).
- Service: `loadLatestMessage` khi backend trả cũ→mới (H6), message bị xóa phía server sau merge (H5), send/edit/delete rollback khi `serverMessageId` rỗng (M5), resync khi `connectionState` đã 'connected' (H3).
- Component: `initialTopMostItemIndex` semantics sau prepend (H7), payload plain-mode nhiều dòng (M4), sanitize-before-parse (C1).

## Điểm tốt

- Bao phủ test tốt: 335 tests pass, typecheck sạch; test WS adapter (promise connect semantics, CLOSING guard, detach stale CLOSED) viết chắc tay.
- Adapter wrap mọi callback trong try/catch; `disconnect()` reject pending connect promise để caller không treo.
- Alias-aware keys + `registry.ts` phá circular import là refactor đúng hướng; `conversationKeys` pure, có cache index.
- `uploadFiles` dùng `Promise.allSettled` (partial failure có kết quả rõ), `uploadFile` có `cancelSession` + strip SAS token trước khi lưu URL.
- Pin flow end-to-end (optimistic + WS `message:pinned/unpinned` → store → banner), gate `hasFetchedPinned` cẩn thận; background refetch khi thiếu message.
- `conversation:updated` merge từng field thay vì spread undefined — fix đúng bug thật.
- Gate `hasFetched` trong `Conversation` chặn refetch loop cho hội thoại rỗng.
- IME composition guard (`isComposing` + keyCode 229) + `isSendingRef` chống double-send, có test.
- CHANGELOG đã ghi breaking change của `uploadFiles` và việc bỏ ACS realtime adapter.
- Mapper WS chịu cả camelCase lẫn PascalCase, phủ gần hết event types; event chưa dùng (reactions, roles) có comment TODO tường minh thay vì rơi vào default.

## Ưu tiên đề xuất

1. **Trước release:** sửa C1 (sanitize trước parse + fail-closed), commit đủ worktree fixes + 2 file untracked, rebuild tarball từ cây đã sửa.
2. **Reliability reconnect:** abort socket `CONNECTING` treo (H1), heartbeat watchdog (H2), generation counter cho reconnect loop (M3), recovery sau max-retries (M2).
3. **State/events:** map `ws:*` vào `connectionState`, sửa handleOnline resync (H3); quyết định typing/readReceipt legacy (map hoặc document).
4. **Dedup:** gửi `clientMessageId` lên backend + tie-break, tolerance hai chiều (H4); sắp xếp lại merge vs replace trong `loadMessages` (H5).
5. **MessageList:** check `jumpTarget.conversationId` (H8), hợp nhất staged/worktree cho đúng semantics virtuoso (H7).
6. **Payload:** plain-mode gửi text thuần hoặc luôn đính `type:'html'` (M4).
