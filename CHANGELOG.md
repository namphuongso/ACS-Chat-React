# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `useChatLanguage` hook to manage and synchronize chat locale state.
- Internationalization (i18n) support across chat components using `react-i18next`.
- Character counter added to `MessageInput`.
- Message editing and deletion functionality with corresponding UI dialogs.
- Room membership service.
- Automated room joining mechanism.
- Unification of conversation naming and avatar handling across UI components.
- `ConversationHeader` and `ConversationFooter` components.
- Contact search functionality with debounced search, virtualized list, and integration with chat providers.

### Changed

- Refactored message lifecycle operations to use custom backend API endpoints.
- Updated conversation view state handling.
- Improved message list layout styling.
- Updated conversation service API integration.

## [1.0.0] - 2026-08-05

### Added

- Initial release of `@namphuongtechnologi/acs-chat-react` library.
- Core hooks (`useChatClient`, `useMessages`, `useConversations`, etc.).
- UI Components for chat (`ChatProvider`, `MessageList`, `ConversationList`, etc.).
- Theming and customizable UI through CSS variables.
- API documentation and usage guides.
