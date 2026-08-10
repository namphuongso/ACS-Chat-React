# Hướng dẫn Cấu hình Build (Vite Library Mode) - Task 13.1

Tài liệu này hướng dẫn chi tiết từng bước cách thiết lập cấu hình Vite để đóng gói (build) thư viện hỗ trợ cả hai định dạng **CommonJS (CJS)** và **ES Modules (ESM)**.

> [!NOTE]
> Dự án sử dụng Vite làm công cụ build chính. Việc hỗ trợ cả CJS và ESM giúp thư viện tương thích với nhiều hệ sinh thái (Node.js cũ dùng `require`, các framework hiện đại dùng `import`).

---

## Bước 1: Cấu hình `vite.config.ts`

Trong file cấu hình của Vite (`np-acs-library/vite.config.ts`), chúng ta cần kích hoạt chế độ **Library Mode** và chỉ định các định dạng đầu ra.

```typescript
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    // Plugin này giúp tự động tạo ra các file định nghĩa kiểu dữ liệu (.d.ts) cho TypeScript
    dts({
      insertTypesEntry: true,
      include: ['src'],
    }),
  ],
  build: {
    lib: {
      // Điểm vào (entry point) của thư viện
      entry: resolve(__dirname, 'src/index.ts'),
      // Tên toàn cục của thư viện khi được sử dụng qua thẻ <script>
      name: 'NpAcsChatReact',
      // Định dạng xuất ra: 'es' (ESM) và 'cjs' (CommonJS)
      formats: ['es', 'cjs'],
      // Cách đặt tên file đầu ra dựa trên định dạng
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      // Đánh dấu các dependencies không nên được đóng gói chung vào thư viện
      // (Bắt buộc người dùng thư viện phải tự cài đặt các package này)
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@azure/communication-chat',
        '@azure/communication-common',
      ],
      output: {
        // Khai báo các biến toàn cục cho các external dependencies khi dùng bản UMD/IIFE
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@azure/communication-chat': 'AzureCommunicationChat',
          '@azure/communication-common': 'AzureCommunicationCommon',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
  },
});
```

> [!TIP]
> Việc cấu hình `fileName: (format) => \`index.${format === 'es' ? 'js' : 'cjs'}\``giúp phân biệt rõ ràng: file`.js`dành cho ESM và`.cjs` dành cho CommonJS.

---

## Bước 2: Cấu hình `package.json`

Sau khi Vite đã cấu hình để xuất ra 2 định dạng, chúng ta cần khai báo cho Node.js và các bundler khác biết cách lấy file tương ứng thông qua file `package.json`.

Cập nhật các trường sau trong `package.json`:

```json
{
  "name": "@namphuongtechnologi/acs-chat-react",
  "version": "1.0.0",
  "type": "module",

  // Trỏ tới file đầu ra cho các công cụ cũ hỗ trợ CJS
  "main": "./dist/index.cjs",

  // Trỏ tới file đầu ra cho các bundler hỗ trợ ESM
  "module": "./dist/index.js",

  // Trỏ tới file định nghĩa kiểu TypeScript
  "types": "./dist/index.d.ts",

  // (Được khuyến nghị) Khai báo "exports" để kiểm soát chính xác
  // cách thư viện được import trong các môi trường khác nhau.
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },

  // Chỉ định thư mục nào sẽ được đưa vào khi publish package lên npm
  "files": ["dist"],
  "scripts": {
    "build": "tsc --noEmit && vite build"
  }
}
```

> [!IMPORTANT]
> Trường `exports` là chuẩn mới và mạnh mẽ nhất để giải quyết các module trong Node.js hiện đại. Nó chỉ định rõ ràng nếu người dùng dùng `import` thì lấy file `index.js`, nếu dùng `require` thì lấy `index.cjs`.

---

## Bước 3: Chạy lệnh Build và Kiểm tra

1. Mở terminal và di chuyển vào thư mục thư viện (`np-acs-library`).
2. Chạy lệnh build:
   ```bash
   npm run build
   ```
3. Kiểm tra kết quả trong thư mục `dist`:
   - Bạn sẽ thấy file `index.js` (Bản ESM).
   - Bạn sẽ thấy file `index.cjs` (Bản CommonJS).
   - Có thể có các file `.d.ts` nếu `vite-plugin-dts` hoạt động đúng.

### Dấu hiệu nhận biết sự khác biệt:

- **`dist/index.js` (ESM)**: Mở file ra sẽ thấy các cú pháp dạng `import ...` và `export { ... }`.
- **`dist/index.cjs` (CommonJS)**: Mở file ra sẽ thấy các cú pháp dạng `require(...)` và `module.exports = ...` hoặc `exports...`.

Nếu thư mục `dist` sinh ra đầy đủ như vậy, quá trình cấu hình build **CJS + ESM** đã hoàn tất thành công!
