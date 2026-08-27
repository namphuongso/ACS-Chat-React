# Báo Cáo Đánh Giá Mã Nguồn (Code Review Report)

> **Tài liệu tham chiếu:** [PROJECT_STRUCTURE_AND_GUIDELINES.md](docs/PROJECT_STRUCTURE_AND_GUIDELINES.md)  
> **Thời điểm review:** 27/08/2026  
> **Branch / Target:** `Development` (`HEAD` diff)  
> **Trạng thái tổng thể:** **APPROVED (ĐẠT CHUẨN)** 🚀

---

## 1. Tổng Quan Thay Đổi (Executive Summary)

Git diff hiện tại triển khai và tối ưu các tính năng quan trọng trong thư viện `@namphuongtechnologi/acs-chat-react`:

1. **Quản lý Ghim Tin Nhắn (Pinned Messages Limit & Replace Dialog):**
   - Giới hạn tối đa `MAX_PINNED_MESSAGES = 3`.
   - Hộp thoại `PinReplaceDialog` cho phép người dùng tự động thay thế tin ghim cũ nhất hoặc chọn tin cần bỏ ghim khi vượt quá giới hạn.
   - Component hiển thị rich pinned item `PinnedItemView` hỗ trợ preview thumbnail ảnh/album, video, tài liệu Office/PDF, link và text.
   - Tối ưu tra cứu tin nhắn ghim với index `Map` độ phức tạp $O(1)$.
2. **Cấu hình & Dịch Vụ Thu Thập Link Preview Tùy Biến (Custom Crawler / SEO Link Preview):**
   - Thêm `LinkPreviewConfig` trong `ChatConfig` cho phép cấu hình endpoint crawler bên ngoài, tùy chỉnh method, headers, request body và response mapper.
   - Cơ chế fallback 3 lớp an toàn: Custom Crawler $\rightarrow$ Backend `/api/link-preview` $\rightarrow$ Client-side Open Graph parsing $\rightarrow$ Minimal fallback.
   - Cải tiến giao diện `LinkPreviewCard` (hiển thị favicon, site name, keywords badge, icon external link).
3. **Tái Cấu Trúc & Tối Ưu Hóa Components (Refactoring & Modularization):**
   - Tách `useConversationActions` từ `ConversationView` để đóng gói logic xử lý dialogs (Edit, Delete, Pin Replace, File Preview).
   - Tách `MessageItem` (>880 dòng) thành các sub-components độc lập: `SystemMessage`, `ImageGrid`, `MessageActions`.
   - Sử dụng React Portal cho `MessageActions` dropdown menu nhằm giải quyết triệt để lỗi bị cắt (clipping/overflow) trong container chat.
4. **Tập Trung Hóa Xử Lý Metadata Tệp (File Utilities Unification):**
   - Xây dựng `parseMessageFilesMetadata` và `resolveMessageFileMetadata` trong `src/utils/fileUtils.ts` để gom toàn bộ logic phân tích file/media/album/video/large-image vào một nơi duy nhất.
5. **Cải Thiện Build & Test Environment:**
   - Cập nhật SCSS preprocessor `api: 'modern-compiler'` trong `vite.config.ts` và `vitest.config.ts` để loại bỏ các cảnh báo deprecation từ Dart Sass.
   - Bổ sung bộ test suites toàn diện cho các utils, services và components mới.

---

## 2. Kết Quả Kiểm Tra Tự Động (Automated Checks)

| Công cụ kiểm tra | Lệnh thực thi | Kết quả | Ghi chú |
| :--- | :--- | :---: | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | ✅ **PASS** | Strict mode, 0 errors |
| **ESLint** | `npm run lint` | ✅ **PASS** | 0 warnings, 0 errors |
| **Vitest Unit Tests** | `npm run test` | ✅ **PASS** | **60 test suites, 541 tests pass (100%)** |
| **SCSS / Build Tooling** | `vite.config.ts` / `vitest.config.ts` | ✅ **PASS** | `api: 'modern-compiler'` sạch warning |

---

## 3. Chi Tiết Đánh Giá Theo Quy Định Của Project Guidelines

### 3.1. Kiến Trúc Phân Tầng & Tổ Chức File (Layered Architecture & Directory Structure)
*Đối chiếu Mục 2 & Mục 3 của Guidelines*

| Layer | Files thay đổi / thêm mới | Đánh giá tuân thủ |
| :--- | :--- | :--- |
| **UI Components** (`src/components/`) | `PinReplaceDialog`, `PinnedItemView`, `PinnedMessageBanner`, `MessageItem`, `ImageGrid`, `MessageActions`, `SystemMessage`, `DocumentIcon`, `LargeImageCard`, `LinkPreviewCard`, `Icons` | ✅ **Tuân thủ đúng:** Mỗi component có thư mục/module riêng, CSS Modules đi kèm (`*.module.scss`), không gọi trực tiếp ACS SDK hay thao tác trực tiếp backend. |
| **Custom Hooks** (`src/hooks/` & component hooks) | `src/components/Conversation/useConversationActions.ts` | ✅ **Tuân thủ đúng:** Tách rời logic điều khiển hội thoại và dialogs khỏi JSX của `ConversationView`. |
| **Business Services** (`src/services/`) | `src/services/linkPreviewService.ts`, `src/services/chatService.ts` | ✅ **Tuân thủ đúng:** Singleton pattern (`linkPreviewService`), điều phối business logic tải link preview, xử lý sự kiện realtime qua domain event adapter. |
| **Utilities** (`src/utils/`) | `src/utils/fileUtils.ts`, `src/utils/pinnedUtils.ts`, `src/utils/date.ts` | ✅ **Tuân thủ đúng:** Pure utility functions, không chứa React state hay hooks, có unit tests độc lập. |
| **Constants** (`src/constants/`) | `src/constants/pins.ts` (`MAX_PINNED_MESSAGES`) | ✅ **Tuân thủ đúng:** Đặt tên UPPER_SNAKE_CASE, export đầy đủ qua barrel `constants/index.ts`. |
| **Types** (`src/types/`) | `config.types.ts`, `file.types.ts`, `message.types.ts` | ✅ **Tuân thủ đúng:** Tách biệt type contracts rõ ràng, sử dụng `import type` cho tất cả type dependencies. |
| **Barrel Exports** (`src/index.ts`) | `src/index.ts`, `src/components/index.ts`, `src/utils/index.ts`, `src/constants/index.ts` | ✅ **Tuân thủ đúng:** Đã cập nhật đầy đủ các exports mới (`LinkPreviewConfig`, `PinnedMessage`, `MessageFileMetadata`, các icons, utils...). |

---

### 3.2. Nguyên Tắc Code Đơn Giản & Trách Nhiệm Đơn Lẻ (KISS & Single Responsibility)
*Đối chiếu Mục 4 của Guidelines*

- ✅ **Giải quyết Component phình to (Decomposition):**
  - `MessageItem/index.tsx` trước đây có độ dài trên 880 dòng đã được phân rã thành các sub-components tinh gọn:
    - `SystemMessage.tsx`: Chuyên trách render thông báo hệ thống (thêm/bớt thành viên, đổi tên nhóm) với `<Trans />`.
    - `ImageGrid.tsx`: Chuyên trách hiển thị lưới ảnh động linh hoạt (2, 3, 4, 5, 6+ ảnh).
    - `MessageActions.tsx`: Chuyên trách action buttons (Reply, Forward, Pin, Star, Edit, Delete...) cùng Dropdown Portal.
  - `ConversationView` chuyển giao toàn bộ state quản lý dialogs sang `useConversationActions`.
- ✅ **Tránh trùng lặp mã nguồn (DRY):**
  - Trích xuất logic nhận diện tệp `getDocumentFileType` và cấu trúc `resolveMessageFileMetadata` dùng chung cho cả `ChatService` (khi nhận event socket), `ConversationView`, `PinnedMessageBanner`, `PinnedItemView`, và `MessageItem`.

---

### 3.3. Quy Tắc Làm Việc Với Dữ Liệu & Tính Phòng Thủ (Defensive Programming)
*Đối chiếu Mục 6 của Guidelines*

- ✅ **Xử lý an toàn dữ liệu từ API / Socket (`parseMessageFilesMetadata`):**
  ```ts
  // Kiểm tra kiểu và parse JSON an toàn tuyệt đối
  export function parseMessageFilesMetadata(filesMeta: unknown): MessageFileMetadata[] {
    if (!filesMeta) return [];
    let parsed = filesMeta;
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    // sanitize & normalize...
  }
  ```
- ✅ **Fallback an toàn trong `resolveMessageFileMetadata`:**
  - Không bao giờ crash khi thiếu thuộc tính (`meta`, `attachments`, `content`, `type`).
  - Hỗ trợ đầy đủ các định dạng URL, thumbnail, MIME type và kích thước tệp.
- ✅ **Cơ chế fallback đa tầng trong `LinkPreviewService`:**
  - Khi crawler tùy biến gặp lỗi (mạng, timeout, cấu hình sai), tự động chuyển sang `/api/link-preview`.
  - Khi backend `/api/link-preview` không khả dụng, tự động thử fetch client-side HTML Open Graph.
  - Khi tất cả đều thất bại, trả về fallback metadata tối thiểu chứ không ném unhandled rejection làm gián đoạn UI.
- ✅ **Giới hạn thời gian chờ (Timeout Protection):**
  - Đặt `CLIENT_FETCH_TIMEOUT_MS = 5000` kèm `AbortController` ngăn ngừa treo request kéo dài.

---

### 3.4. Xử Lý Lỗi & Trạng Thái Ứng Dụng (Error Handling & State Flow)
*Đối chiếu Mục 7 của Guidelines*

- ✅ **Non-critical Error Handling:** Các tác vụ phụ như tải preview ảnh thất bại (`onError`), parse link preview lỗi đều được ghi log qua `logger.warn` / `logger.debug` và cập nhật state fallback nhẹ nhàng trên UI thay vì làm hỏng luồng chat chính.
- ✅ **Cleanup Resource:** Quản lý vòng đời click outside listener, timer debounce/throttle và AbortSignal đúng chuẩn trong React `useEffect`.

---

### 3.5. An Toàn Kiểu Dữ Liệu (Type Safety & TypeScript Conventions)
*Đối chiếu Mục 10 của Guidelines*

- ✅ **Không lạm dụng `any`:** Sử dụng `unknown` kết hợp type guard helper (`isRecord`) và các discriminated unions (`category: PinnedCategory`, `DocumentFileType`, `ResolvedMessageType`).
- ✅ **Tối ưu Bundle với Type-Only Imports:**
  ```ts
  import type { LinkPreview, FileAttachment } from './message.types';
  import type { ChatConfig, LinkPreviewConfig } from '../types/config.types';
  ```
- ✅ **Extensible Configurations:** `LinkPreviewConfig.requestBody` chấp nhận cả static object lẫn dynamic builder function `(url: string) => Record<string, unknown>`.

---

### 3.6. Đa Ngôn Ngữ & Chuẩn Hóa Giao Diện (i18n & UI/UX Guidelines)
*Đối chiếu Mục 9.6 của Guidelines*

- ✅ **Không Hard-code Text:** Toàn bộ text mới xuất hiện trên giao diện đều được tích hợp qua hook `useTranslation()` với fallback tiếng Anh rõ ràng:
  - `chat.updatePinList`
  - `chat.pinLimitExceededDesc`
  - `chat.pinLimitSelectDesc`
  - `chat.selectMessageToReplace`
  - `chat.unpinMessage`
  - `chat.album`, `chat.photo`, `chat.link`, `chat.file`...
- ✅ **Đồng bộ từ điển:** Cập nhật song song cả 2 file ngôn ngữ `src/i18n/locales/en.ts` và `src/i18n/locales/vi.ts`.
- ✅ **Khả năng tiếp cận (Accessibility - a11y):**
  - `PinReplaceDialog` sử dụng đúng `role="dialog"`, `aria-modal="true"`, `role="radiogroup"` và `role="radio"`.
  - Hỗ trợ điều hướng và chọn bằng bàn phím (`Enter`, `Space`).

---

### 3.7. Hiệu Năng & Tối Ưu Bộ Nhớ (Performance & Optimization)
*Đối chiếu Mục 8 & Mục 14 của Guidelines*

- ✅ **Indexed Lookup $O(1)$ (`indexMessagesByConversation`):**
  Khi render banner ghim hoặc danh sách ghim, hàm `indexMessagesByConversation` tạo một bản đồ `Map<string, ChatMessage>` trong `useMemo`, biến việc tìm kiếm metadata cho từng tin ghim từ $O(N \times M)$ thành $O(1)$.
- ✅ **Chống layout clipping với React Portal:**
  `MessageActions` popup dropdown được teleport trực tiếp vào `document.body` thông qua `createPortal`, tính toán vị trí tọa độ bounding box thông minh (up/down) dựa trên viewport, loại bỏ hiện tượng menu bị che khuất bởi các container có `overflow: hidden` hoặc `overflow: auto`.

---

## 4. Các Phát Hiện & Kiến Nghị (Findings & Recommendations)

### 4.1. Cần Lưu Ý Khi Commit (Actionable Item)
- ⚠️ **File Artifact Binary (`namphuongtechnologi-acs-chat-react-1.2.1.tgz`):**  
  File `.tgz` được build ra đang nằm trong git stage. `.gitignore` đã được cập nhật rule `*.tgz`. Cần unstage/xóa file tgz này trước khi commit để không làm tăng dung lượng repository:
  ```bash
  git reset namphuongtechnologi-acs-chat-react-1.2.1.tgz
  rm namphuongtechnologi-acs-chat-react-1.2.1.tgz
  ```

### 4.2. Khuyến Nghị Nhỏ Về Code & Testing (Nice to have)
1. **Dropdown Viewport Boundaries trong `MessageActions.tsx`:**  
   Logic định vị portal hiện tại đã xử lý `top`/`bottom`/`left`/`right`. Khi màn hình resize hoặc cuộn nhanh danh sách tin nhắn, có thể bổ sung listener `scroll`/`resize` đóng dropdown để trải nghiệm mượt mà hơn.
2. **React `act(...)` Warning trong Test Suite:**  
   Trong `PinnedMessageBanner.test.tsx`, khi kích hoạt click jump message cập nhật store, việc wrap trigger bằng `await act(async () => ...)` sẽ loại bỏ hoàn toàn thông báo cảnh báo `act(...)` của React Testing Library.

---

## 5. Bảng Đối Chiếu Checklist Thêm Feature (Section 13)

| Mục kiểm tra trong Checklist | Trạng thái |
| :--- | :---: |
| Đã đặt file đúng thư mục theo layer | ✅ |
| Đã định nghĩa types trong `src/types/` | ✅ |
| Đã tách API/adapter/utils logic khỏi UI components | ✅ |
| Đã tạo/cập nhật service với singleton pattern | ✅ |
| Đã tạo hook wrap service / actions | ✅ |
| Đã kiểm tra phòng thủ response API (null, undefined, empty, wrong type) | ✅ |
| Đã handle loading / empty / error / fallback state | ✅ |
| Đã tránh duplicate code qua `fileUtils` | ✅ |
| Đã giữ component đơn giản & chia nhỏ sub-components | ✅ |
| Đã cập nhật barrel exports (`index.ts`) | ✅ |
| Đã kiểm tra lint, typecheck và unit test 100% pass | ✅ |

---

## 6. Kết Luận (Verdict)

Toàn bộ code change trong git diff tuân thủ rất tốt các nguyên tắc kiến trúc và phong cách lập trình được quy định tại [PROJECT_STRUCTURE_AND_GUIDELINES.md](docs/PROJECT_STRUCTURE_AND_GUIDELINES.md):
- **Kiến trúc rõ ràng, đúng phân tầng (Clean Layered Architecture)**.
- **Tính phòng thủ dữ liệu cao (Defensive & Robust)**.
- **Chất lượng kiểm thử tự động xuất sắc (100% test pass, type-safe, 0 lint error)**.
- **Trải nghiệm người dùng và tính quốc tế hóa hoàn chỉnh (i18n & a11y compliant)**.

**Khuyến nghị:** Sẵn sàng merge sau khi loại bỏ file binary `.tgz` khỏi staging.
