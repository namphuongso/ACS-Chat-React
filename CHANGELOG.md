# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
