# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added URL detection and linkification in text messages: http(s)/www. links are rendered as clickable anchors (`target="_blank"`, `rel="noopener noreferrer"`).
- Added link preview support when sending messages (spec plan-p2 §19):
  - New `LinkPreviewCard` component rendering title, description, image, site name and favicon.
  - New `linkPreviewService` (`POST /api/link-preview` backend extraction, with client-side Open Graph fallback and in-memory cache).
  - New `useLinkPreview` hook for lazy preview resolution in rendered messages.
  - Message compose area now shows the preview of the first detected URL before sending; the preview is attached to the message as `metadata.linkPreview`.
  - New `MessageInput.enableLinkPreview` prop (default `true`).
- Added `LinkPreview` type exported from the package.

### Changed

- `sanitizeHtml` now preserves the `target` attribute (DOMPurify >= 3.3 drops it by default) so message links can open in a new tab.

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
- **Breaking:** `uploadFiles` in `fileService` now returns `Promise<UploadFilesResult>` (`{ success: string[], failed: Array<{ file: File; error: unknown }> }`) instead of `Promise<string[]>`; `uploadFile` now throws when the server does not return a file URL (previously fell back to the `uploadId`).

### Removed

- Removed `replace-vars.cjs` build script.
- Removed ACS signaling realtime adapter (`AcsEventAdapter`); realtime updates now require WebSocket (`websocketUrl` or `backendUrl` with `enableWebSocket` not `false`). Deployments without WebSocket will only update via manual refresh — a warning is logged at startup in that case.

### Fixed

- Fixed optimistic message deduplication mistakenly dropping a new message when the same sender recently sent identical content (e.g., sending the same text twice within 60s); messages with distinct `clientMessageId`/`sequenceId` are no longer treated as duplicates, and a server confirmation must not predate its optimistic counterpart.

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
