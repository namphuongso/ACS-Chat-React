# Hướng dẫn Phát triển, Test và Publish Thư viện ACS Chat React

Tài liệu này cung cấp các hướng dẫn cơ bản để làm việc với thư viện `@namphuongtechnologi/acs-chat-react`.

## 1. Cài đặt và Phát triển (Development)

### Yêu cầu môi trường

- Node.js (phiên bản 18+ khuyến nghị)
- npm (hoặc yarn, pnpm)

### Cài đặt dependencies

Di chuyển vào thư mục `np-acs-library` (nếu chưa ở trong đó) và cài đặt các gói cần thiết:

```bash
npm install
```

### Các lệnh phát triển cơ bản

- **Khởi chạy môi trường phát triển (nếu có môi trường dev được cấu hình):**
  ```bash
  npm run dev
  ```
- **Kiểm tra kiểu dữ liệu (Type check):**
  Kiểm tra xem mã nguồn TypeScript có hợp lệ hay không trước khi build.
  ```bash
  npm run typecheck
  ```
- **Kiểm tra lỗi cú pháp (Linting):**
  Sử dụng ESLint để quét lỗi code.
  ```bash
  npm run lint
  ```
  Để tự động sửa các lỗi lint cơ bản, bạn có thể chạy:
  ```bash
  npx eslint . --ext .ts,.tsx --fix
  ```

---

## 2. Kiểm thử (Testing)

Dự án sử dụng **Vitest** kết hợp với **React Testing Library** để viết và chạy các unit test.

- **Chạy toàn bộ test một lần:**
  (Thường dùng để kiểm tra trước khi commit hoặc trong môi trường CI/CD)
  ```bash
  npm run test
  ```
- **Chạy test ở chế độ theo dõi (Watch mode):**
  (Tiện lợi khi đang trong quá trình code, tự động chạy lại test khi file thay đổi)
  ```bash
  npm run test:watch
  ```

---

## 3. Kiểm thử thư viện trong dự án khác (Local Integration Testing)

Để kiểm tra xem thư viện hoạt động như thế nào khi được import vào một dự án thực tế trước khi publish, bạn có thể sử dụng một trong hai cách sau:

### Cách 1: Sử dụng `npm pack` (Khuyến nghị)

Cách này đóng gói thư viện giống hệt như khi publish lên npm, giúp tránh các lỗi liên quan đến symlink (ví dụ: lỗi "Invalid hook call" thường gặp của React).

1. Tại thư mục thư viện (`np-acs-library`), chạy build và pack:
   ```bash
   npm run build
   npm pack
   ```
   Lệnh `npm pack` sẽ tạo ra một file nén `.tgz` (ví dụ: `namphuong-acs-chat-react-1.0.0.tgz`).
2. Mở terminal tại thư mục **dự án cần test**, chạy lệnh install trỏ tới file `.tgz` vừa tạo:
   ```bash
   npm install /đường/dẫn/tới/np-acs-library/namphuong-acs-chat-react-1.0.0.tgz
   ```
   _(Đường dẫn có thể là đường dẫn tuyệt đối hoặc tương đối từ dự án cần test)_.

### Cách 2: Sử dụng `npm link`

Cách này tạo một symlink (liên kết mềm). Nó hữu ích nếu bạn muốn sửa code thư viện, chạy build lại và thấy thay đổi ngay lập tức bên dự án test mà không phải cài lại.

1. Tại thư mục thư viện (`np-acs-library`):
   ```bash
   npm run build
   npm link
   ```
2. Tại thư mục **dự án cần test**:
   ```bash
   npm link @namphuongtechnologi/acs-chat-react
   ```

_(Lưu ý quan trọng: Vì tính chất của symlink, npm link thường gây lỗi trùng lặp React (`Invalid hook call`) nếu cả thư viện và dự án test đều có `node_modules/react`. Nếu gặp lỗi này, tốt nhất hãy chuyển sang cách dùng `npm pack` ở trên)._

---

## 4. Build & Publish (Phát hành)

Để phát hành phiên bản mới của thư viện lên npm, hãy thực hiện cẩn thận theo các bước sau:

### Bước 1: Build mã nguồn

Đảm bảo rằng toàn bộ mã nguồn không có lỗi bằng cách chạy các lệnh test, lint, và typecheck. Sau đó chạy lệnh build để tạo thư mục `dist`:

```bash
npm run build
```

_(Lưu ý: Lệnh này sẽ chạy `tsc --noEmit && vite build`, đảm bảo xuất ra đúng định dạng CommonJS (.cjs), ESModules (.js), và type definitions (.d.ts) như đã cấu hình trong `package.json`)._

### Bước 2: Cập nhật phiên bản (Versioning)

Trước khi publish, bạn bắt buộc phải tăng phiên bản trong file `package.json`. Tránh sửa thủ công, hãy sử dụng lệnh `npm version` (lệnh này tự động cập nhật package.json và tạo tag Git nếu dự án quản lý bằng Git):

```bash
# Chọn 1 trong 3 mức độ thay đổi
npm version patch # Cập nhật fix lỗi nhỏ (ví dụ: 1.0.0 -> 1.0.1)
npm version minor # Thêm tính năng mới, vẫn tương thích cũ (ví dụ: 1.0.0 -> 1.1.0)
npm version major # Thay đổi kiến trúc lớn, phá vỡ tương thích (ví dụ: 1.0.0 -> 2.0.0)
```

> **Quan trọng:** Hãy nhớ ghi chú lại các thay đổi vào file `CHANGELOG.md` tương ứng với phiên bản vừa tạo.

### Bước 3: Đăng nhập vào npm

Nếu bạn chưa đăng nhập tài khoản npm trên máy (hoặc tài khoản có quyền publish vào scope `@namphuong`), hãy đăng nhập:

```bash
npm login
```

### Bước 4: Publish thư viện

Chạy lệnh publish để đẩy thư viện lên npm registry:

```bash
npm publish
```

- Lệnh này sẽ chạy tự động script `prepublishOnly` (là `npm run build` theo `package.json`) trước khi thực sự đẩy code lên, nhằm đảm bảo file `dist` của bạn luôn là bản build mới nhất.
- Trong `package.json` đã có cấu hình `"publishConfig": { "access": "public" }` nên gói thư viện này sẽ được public một cách công khai.
