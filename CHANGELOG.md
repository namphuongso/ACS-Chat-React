# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added configurable link preview / SEO crawler support to `ChatConfig` (`linkPreview`):
  - New `LinkPreviewConfig` type with custom `url`, `method`, `headers`, `requestBody` (static or a function receiving the URL), and `responseMapper`.
  - `LinkPreviewService` now resolves previews through the custom crawler first, then falls back to the built-in `/api/link-preview` backend and client-side Open Graph parsing.
  - Built-in response mapper handles the common crawler response shape (`title`, `description`, `ogTags.image`, `twitterTags.site`, etc.).
  - `LinkPreviewConfig` is exported from the package.

## [1.2.1] - 2026-08-26

### Added

- Added `FilePreviewModal` component for modal previewing of attachments (images, videos, audio, PDF documents, text/code files):
  - Image controls: zoom in/out, fit to width, 90° clockwise/counter-clockwise rotation, and pan/drag support.
  - Video and audio custom playback controls with progress bar, volume/mute toggles, time formatting, and fullscreen support.
  - PDF document viewer and plain-text file viewer with monospace styling.
  - Fallback view with direct download button for unsupported file types.
  - Keyboard shortcuts (ESC to close, navigation).
- Added `DocumentIcon` component for rendering branded, color-coded file icons based on extension and MIME type (PDF, Word, Excel, PowerPoint, ZIP/Archive, Code, Audio, Video, Image, Text).
- Added `VideoCard` component for inline video message rendering with playback thumbnail, duration badge, play button, and click-to-preview.
- Added `LargeImageCard` and `ChatImage` components for responsive image rendering with loading skeletons, error fallback placeholders, aspect-ratio handling, and preview modal integration.
- Added attachment opening handlers and custom preview control:
  - Added `onAttachmentOpen` callback prop to `ChatContainer`, `Conversation`, `MessageList`, `MessageItem`, and `LargeImageCard` allowing parent applications to handle file clicks or customize opening behavior.
  - Added `disableInternalFilePreview` prop to `ChatContainer` and `Conversation` to disable built-in modal preview in favor of custom host opening handlers.
- Added WebSocket-based real-time communication service and adapter:
  - New `WebSocketService` managing real-time bidirectional communication with automatic reconnection, heartbeat/ping-pong (`PING_INTERVAL_MS = 25000`, `PONG_TIMEOUT_MS = 10000`), event subscription, and outbox queue.
  - New `WebSocketAdapter` and `websocketMappers` for mapping real-time events (messages, edits, deletes, reactions, typing indicators, read receipts, membership changes).
  - New `useWebSocket` hook exposing connection status and controls.
  - New `enableWebSocket` and `websocketUrl` configuration options in `ChatClientConfig`.
- Added URL detection and link preview support:
  - Automatic URL detection and linkification in text messages: http(s)/www. links are rendered as clickable anchors (`target="_blank"`, `rel="noopener noreferrer"`).
  - New `LinkPreviewCard` component rendering title, description, image, site name, domain badge, and favicon with loading skeletons and retry mechanism.
  - New `linkPreviewService` (`POST /api/link-preview` backend extraction, with client-side Open Graph fallback and in-memory cache).
  - New `useLinkPreview` hook for lazy preview resolution in rendered messages.
  - Message compose area now shows the preview of the first detected URL before sending with a dismiss button; the preview is attached to the message as `metadata.linkPreview`.
  - New `MessageInput.enableLinkPreview` prop (default `true`).
  - Added `LinkPreview` type exported from the package.
- Added `useJumpToMessage` hook to navigate and scroll to specific messages with highlight animation and history fetching.
- Added custom logger configuration via `setLogger` and `ChatLogger` interface in `logger.ts`.
- Added new UI translations in English and Vietnamese for file preview modals, video cards, link previews, and retry actions.

### Changed

- **Breaking:** `uploadFiles` in `fileService` now returns `Promise<UploadFilesResult>` (`{ success: string[], failed: Array<{ file: File; error: unknown }> }`) instead of `Promise<string[]>`; `uploadFile` now throws when the server does not return a file URL (previously fell back to the `uploadId`).
- Replaced ACS signaling realtime layer with `WebSocketService` and `WebSocketAdapter` for all real-time events.
- `sanitizeHtml` now preserves the `target` attribute (DOMPurify >= 3.3 drops it by default) so message links can open in a new tab.
- Refactored `MessageItem` and `MessageList` layout and styling to support rich media attachments, responsive aspect ratios, and file cards.

### Removed

- Removed ACS signaling realtime adapter (`AcsEventAdapter`); realtime updates now require WebSocket (`websocketUrl` or `backendUrl` with `enableWebSocket` not `false`). Deployments without WebSocket will only update via manual refresh — a warning is logged at startup in that case.

### Fixed

- Fixed optimistic message deduplication mistakenly dropping a new message when the same sender recently sent identical content (e.g., sending the same text twice within 60s); messages with distinct `clientMessageId`/`sequenceId` are no longer treated as duplicates, and a server confirmation must not predate its optimistic counterpart.
- Fixed MIME type inference and fallback handling for file attachments without explicit content types.

## [1.2.0] - 2026-08-14

### Added

- Added rich text formatting support in the chat input (Bold, Italic, Underline, Strikethrough, Text color, Font size, Lists, Indent/Outdent).
- Added `PinnedMessageBanner` and `PinDropdownMenu` UI components to view and manage pinned messages.
- Added multiple file upload support via `uploadFiles` in `fileService`.
- Added support for sending metadata (like image, video, file types) along with messages in `messageService`.
- Added new toolbar components for formatting options (`ToolbarButton`, `ConversationFooterBottomToolbar`, `ConversationFooterToolbar`, `ConversationFooterSendButton`).

### Changed

- Refactored `ConversationFooter` and `MessageInput` components to support rich text (contentEditable) and improve maintainability.
- Updated `MessageItem` and `MessageList` to support rendering formatted HTML messages.
- Updated UI translations (English and Vietnamese) for new formatting features.
- Relaxed empty message validation in `acsThreadAdapter` and `messageService` to allow media-only messages.
- Updated CSS variables (`variables.scss`) for formatting menus and toolbars.

### Removed

- Removed `replace-vars.cjs` build script.

## [1.1.0] - 2026-08-12

### Added

- Added `openingConversation` state and actions to `conversationStore`.
- Added support for pinned messages in `messageStore` (`pinnedMessages`, `loadingPinned`, `hasFetchedPinned`).
- Added `createdBy` field to `BaseConversation` type.
- Added `recalledAt` field to `ChatMessage` type.
- Added `BackendConversationItem` and `PinnedMessage` interfaces.

### Changed

- Updated `fetchBackend` in `apiClient` to correctly handle `FormData` bodies without overriding the `Content-Type` header.

## [1.0.0] - 2026-08-10

### Added

- Initial release of `@namphuongtechnologi/acs-chat-react` library.
- Core hooks (`useChatClient`, `useMessages`, `useConversations`, `useChatLanguage`, etc.).
- UI Components for chat (`ChatProvider`, `MessageList`, `ConversationList`, `ConversationHeader`, `ConversationFooter`, `Dropdown`, etc.).
- Theming and customizable UI through CSS variables.
- Internationalization (i18n) support across chat components using `react-i18next`.
- Message editing and deletion functionality with corresponding UI dialogs.
- Character counter added to `MessageInput`.
- Conversation pinning functionality with UI support and sorting logic.
- Room membership service and automated room joining mechanism.
- Contact search functionality with debounced search, virtualized list, and integration with chat providers.
- Formatting for conversation preview messages.
- API documentation and usage guides.

### Changed

- Unification of conversation naming and avatar handling across UI components.
- Refactored message lifecycle operations to use custom backend API endpoints.
- Updated conversation view state handling and optimized conversation mapping logic.
- Improved message list layout styling.
- Updated conversation service API integration.
- Refactored conversation store variables for better maintainability.

### Fixed

- Fixed last message time not updating automatically in `ConversationList` when new messages are sent.
- Fixed conversation pin sorting so pinned conversations remain at the top regardless of recent activity.
- Fixed message formatting flickering issues.
