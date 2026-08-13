# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
