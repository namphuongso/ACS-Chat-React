# Code Review — Document Preview & FileCard UI Enhancement

- **Repository:** `np-acs-library` (`@namphuongtechnologi/acs-chat-react`)
- **Branch:** `Development`
- **Ngày review:** 24/08/2026
- **Phạm vi kiểm tra:** Toàn bộ thay đổi trong `git diff` (Working Tree & Staged Changes)
  - `src/components/MessageItem/DocumentIcon.tsx` (New file)
  - `src/components/MessageItem/LargeImageCard.tsx`
  - `src/components/MessageItem/MessageItem.module.scss`
  - `src/components/MessageItem/index.tsx`
  - `src/components/Icons/index.tsx`
  - `src/components/MessageItem/__tests__/LargeImageCard.test.tsx`
  - Companion changes in `NP-Pro` (`src/modules/chat/index.tsx`, `vite.config.ts`)
- **Kết quả kiểm tra tự động:**
  - `npm run lint` — ✅ 0 errors, 0 warnings
  - `npm run build` (`tsc --noEmit && vite build`) — ✅ Thành công (DTS, CJS & ESM)
  - `npm test` — ✅ **54 test suites passed**, **440 tests passed** (100%)

---

## 1. Tóm tắt thay đổi (Summary of Changes)

1. **Component `DocumentIcon` chuyên dụng:**
   - Phân loại định dạng tài liệu tự động theo đuôi tệp (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.zip`, `.txt`, `.jpg`…) hoặc MIME type (`application/pdf`, `msword`, `spreadsheetml`…).
   - Vẽ icon tài liệu bằng SVG vector tùy chỉnh với góc gấp (fold flap) và huy hiệu văn bản nhận diện (PDF, W, X, P, ZIP, TXT, IMG, DOC) cùng màu sắc nhận diện trực quan.
2. **Nâng cấp `LargeImageCard` / `FileCard` UI:**
   - Thay thế icon hình ảnh chung chung cũ (`FileImageIcon`) bằng `DocumentIcon` mới.
   - Bổ sung nút **Mở thư mục / Xem tài liệu** (`FolderIcon`) bên cạnh nút **Tải xuống** (`DownloadIcon`).
   - Bổ sung dòng trạng thái tệp: icon tích xanh (`CheckCircleIcon`) + nhãn thông tin (`chat.availableOnDevice` / `statusText`).
   - Định nghĩa alias `FileCard` và `FileCardProps` tương thích ngược hoàn toàn với `LargeImageCard`.
3. **Cập nhật SCSS & Design System:**
   - Tinh chỉnh giao diện thẻ tệp: `border-radius: 8px`, `padding: 10px 14px`, viền `var(--chat-large-img-own-border, #93c5fd)`, nền `var(--chat-large-img-own-bg, #ebf5ff)`.
   - Nâng cấp typography: Tên tệp (14px, font-weight 700, text-overflow ellipsis), thông tin dung lượng và trạng thái (13px, font-weight 500, màu `#16a34a`).
   - Nút hành động (32x32px) với hiệu ứng hover, active và trạng thái loading spinner khi đang tải tệp.
4. **Tích hợp `MessageItem` & Prop Propagation:**
   - Thêm callback `onOpenAttachment` vào `MessageItemProps`.
   - Truyền `onOpen` và `mimeType` cho tất cả các nhánh hiển thị tệp: tin nhắn tệp đơn (`isFileMessage`), ảnh kích thước lớn (`isSingleLargeImage`), và danh sách tệp đính kèm (`message.attachments`).
5. **Mở rộng Unit Test Coverage:**
   - Bổ sung test case kiểm tra hiển thị đúng icon cho Word, Excel, PowerPoint, PDF trong `LargeImageCard.test.tsx`.
   - Bổ sung test case kiểm tra tương tác khi nhấn nút Open (`onOpen` callback và fallback `window.open`).

---

## 2. Đánh giá chi tiết (Detailed Findings & Code Quality)

### ✅ Điểm sáng & Thực hành tốt (Strengths & Best Practices)

1. **Thiết kế SVG gọn nhẹ, không phụ thuộc asset tĩnh:**
   - [DocumentIcon.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/DocumentIcon.tsx) được vẽ hoàn toàn bằng SVG nguyên bản, không dùng file PNG/SVG bên ngoài giúp tối ưu bundle size, không bị lỗi vỡ hình khi load chậm và hiển thị sắc nét trên màn hình Retina/High-DPI.
2. **Tương thích ngược (Backward Compatibility):**
   - Giữ nguyên component `LargeImageCard` và export thêm alias `FileCard = LargeImageCard`. Mã nguồn hiện tại đang dùng `LargeImageCard` không bị break, trong khi code mới có thể dùng tên chuẩn ngữ nghĩa `FileCard`.
3. **Bảo mật khi mở tệp ngoại tuyến (Security on External Links):**
   - Hàm `handleOpen` trong [LargeImageCard.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/LargeImageCard.tsx#L38-L47) sử dụng `window.open(url, '_blank', 'noopener,noreferrer')`, ngăn chặn tấn công `window.opener` reverse tabnabbing.
4. **Quản lý i18n chuẩn hóa:**
   - Tất cả nhãn văn bản (`chat.download`, `chat.openFolder`, `chat.availableOnDevice`) đều đi qua hook `useTranslation()` và có fallback tiếng Anh mặc định.
5. **Cải tiến Icon hệ thống:**
   - [CheckCircleIcon](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/Icons/index.tsx#L352-L362) được chuẩn hóa theo format hình tròn khép kín (`<circle>` + `<path>`), đồng bộ phong cách thiết kế với bộ Lucide/Feather icon.

---

## 3. Các điểm lưu ý & Đề xuất cải tiến (Recommendations & Edge Cases)

### 💡 Đề xuất 1: Xử lý an toàn khi `fileName` chứa URL Query Params hoặc Hash

- **Vị trí:** [DocumentIcon.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/DocumentIcon.tsx#L13-L71)
- **Hiện tượng:** Hàm `getDocumentFileType` kiểm tra `name.endsWith('.pdf')`. Trong trường hợp `fileName` được truyền là một URL đầy đủ có query parameter (ví dụ Azure SAS token: `https://storage.../file.pdf?sp=r&st=...`), điều kiện `name.endsWith('.pdf')` sẽ trả về `false` và rơi vào icon `generic` (DOC).
- **Giải pháp đề xuất:** Tách bỏ query params / hash trước khi kiểm tra extension:
  ```typescript
  export const getDocumentFileType = (
    fileName?: string,
    mimeType?: string
  ): DocumentFileType => {
    const rawName = (fileName || '').split('?')[0].split('#')[0].toLowerCase();
    const mime = (mimeType || '').toLowerCase();
    
    if (rawName.endsWith('.pdf') || mime === 'application/pdf') {
      return 'pdf';
    }
    // ...
  };
  ```

### 💡 Đề xuất 2: Chuyển tiếp prop `onOpenAttachment` qua `MessageList` & `ConversationView` (✅ Đã hiện thực)

- **Vị trí:** [MessageItem/index.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/index.tsx#L60), [MessageList/index.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageList/index.tsx), [Conversation/index.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/Conversation/index.tsx) và [ChatContainer.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/ChatContainer.tsx)
- **Hiện tượng:** `MessageItemProps` đã có `onOpenAttachment`, tuy nhiên `MessageListProps` và `ConversationViewProps` chưa khai báo prop này. Khi ứng dụng cha (host app) dùng `<ConversationView />` mặc định, họ không thể truyền callback tùy biến cho việc mở tài liệu (ví dụ: mở modal xem trước PDF/ảnh nội bộ thay vì tab mới) trừ khi dùng `renderMessage`.
- **Giải pháp:** Đã khai báo thêm `onOpenAttachment` và `onDownloadAttachment` vào `MessageListProps`, `ConversationViewProps` và `ChatContainerProps`, đồng thời forward thông suốt từ container xuống item và bổ sung unit test tương ứng.

### 💡 Đề xuất 3: Cân nhắc ngữ cảnh cho nhãn mặc định `chat.availableOnDevice`

- **Vị trí:** [LargeImageCard.tsx](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/LargeImageCard.tsx#L96-L101)
- **Hiện tượng:** `showStatus` đang mặc định là `true`, hiển thị dòng `"Đã lưu trên thiết bị"`. Trên nền tảng Web thuần túy (không có local storage cache / offline sync), tệp tin vẫn nằm trên cloud blob storage cho đến khi người dùng click tải về.
- **Gợi ý:** Nếu đây là UI mô phỏng theo mẫu Zalo/Teams thì hoàn toàn phù hợp. Trường hợp muốn thể hiện trạng thái chính xác hơn giữa các tệp đã tải và chưa tải, có thể hỗ trợ truyền prop `statusText` hoặc toggle `showStatus={false}` theo nhu cầu nghiệp vụ.

---

## 4. Bảng tổng hợp thay đổi theo tệp (File-by-File Review Matrix)

| Tệp | Loại thay đổi | Trạng thái | Đánh giá |
| :--- | :---: | :---: | :--- |
| [`DocumentIcon.tsx`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/DocumentIcon.tsx) | New file | ✅ Rất tốt | SVG vector sắc nét, phân loại định dạng đầy đủ (PDF, Word, Excel, PPT, Zip, Text, Img, Doc). |
| [`LargeImageCard.tsx`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/LargeImageCard.tsx) | Modified | ✅ Rất tốt | Bổ sung nút Open Folder, DocumentIcon, status info, giữ tương thích qua alias `FileCard`. |
| [`MessageItem.module.scss`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/MessageItem.module.scss) | Modified | ✅ Đẹp | Padding, kích thước icon box (40x46px), màu sắc theme và typography rõ ràng, chuẩn UI mockup. |
| [`MessageItem/index.tsx`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/index.tsx) | Modified | ✅ Hoàn thiện | Truyền `onOpen` và `mimeType` đầy đủ cho các trường hợp render file; export các type & component mới. |
| [`Icons/index.tsx`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/Icons/index.tsx) | Modified | ✅ Chuẩn hóa | Sửa `CheckCircleIcon` dạng circle khép kín, re-export `DocumentIcon` và helper functions. |
| [`LargeImageCard.test.tsx`](file:///Users/thaoanhhaa1/Documents/IT/NP/WEB/acs-chat/np-acs-library/src/components/MessageItem/__tests__/LargeImageCard.test.tsx) | Modified | ✅ Đầy đủ | Test suite đạt 100% pass với coverage mở rộng cho icon type rendering và `onOpen` click event. |

---

## 5. Kết luận (Conclusion)

Bộ code change trong git diff đạt chất lượng cao:
- **Tính thẩm mỹ & Trải nghiệm người dùng:** Giao diện thẻ tài liệu hiện đại, phân biệt màu sắc và nhãn rõ ràng cho từng định dạng tài liệu quen thuộc (Word, Excel, PowerPoint, PDF...).
- **Chất lượng mã nguồn:** Tuân thủ TypeScript nghiêm ngặt, clean code, không có lint error, build thành công cả bundle ESM/CJS và hoàn thành 100% các bài test tự động (440/440 passed).
- **Sẵn sàng triển khai:** Các thay đổi an toàn, tương thích ngược tốt và sẵn sàng để đóng gói/commit vào nhánh phát triển.
