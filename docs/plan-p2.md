# React + TypeScript ACS Chat Library — Phase 2 Implementation Plan

> **Version**: 2.0  
> **Date**: 2026-08-06  
> **Status**: Draft — Awaiting Review  
> **Prerequisite**: Phase 1 (plan.md) hoàn thành

---

## Table of Contents

1. [Tổng quan Phase 2](#1-tổng-quan-phase-2)
2. [Feature Matrix — Zalo Comparison](#2-feature-matrix--zalo-comparison)
3. [Mentions (@mention)](#3-mentions-mention)
4. [Message Reactions / Emoji](#4-message-reactions--emoji)
5. [Reply Message (Trả lời tin nhắn)](#5-reply-message-trả-lời-tin-nhắn)
6. [Forward Message (Chuyển tiếp tin nhắn)](#6-forward-message-chuyển-tiếp-tin-nhắn)
7. [Pin Message (Ghim tin nhắn)](#7-pin-message-ghim-tin-nhắn)
8. [Audio / Video Calling](#8-audio--video-calling)
9. [Screen Sharing](#9-screen-sharing)
10. [Voice Message (Tin nhắn thoại)](#10-voice-message-tin-nhắn-thoại)
11. [Message Search](#11-message-search)
12. [Stickers & GIFs](#12-stickers--gifs)
13. [Online Presence / User Status](#13-online-presence--user-status)
14. [Cloud Media (Image/Video Preview)](#14-cloud-media-imagevideo-preview)
15. [Notification Management (Mute/Pin/Archive)](#15-notification-management-mutepin-archive)
16. [Multi-device Sync](#16-multi-device-sync)
17. [Message Quote & Rich Text Formatting](#17-message-quote--rich-text-formatting)
18. [Contact / User Search & Directory](#18-contact--user-search--directory)
19. [Link Preview](#19-link-preview)
20. [Updated Architecture — Phase 2](#20-updated-architecture--phase-2)
21. [ACS Package Dependencies — Phase 2](#21-acs-package-dependencies--phase-2)
22. [Updated Directory Structure — Phase 2](#22-updated-directory-structure--phase-2)
23. [Updated State Management — Phase 2](#23-updated-state-management--phase-2)
24. [Updated Public API — Phase 2](#24-updated-public-api--phase-2)
25. [Implementation Phases — Phase 2](#25-implementation-phases--phase-2)
26. [Testing Strategy — Phase 2](#26-testing-strategy--phase-2)
27. [Definition of Done — Phase 2](#27-definition-of-done--phase-2)
28. [Open Questions — Phase 2](#28-open-questions--phase-2)

---

## 1. Tổng quan Phase 2

Phase 2 mở rộng React Chat Library thêm các tính năng nâng cao, hướng tới trải nghiệm tương đương Zalo:

### Mục tiêu chính

- **Mentions** — @mention user trong group chat
- **Reactions** — React emoji cho từng tin nhắn
- **Reply/Forward** — Trả lời và chuyển tiếp tin nhắn
- **Pin Message** — Ghim tin nhắn quan trọng
- **Audio/Video Calling** — Gọi thoại và video call 1-1 & group
- **Screen Sharing** — Chia sẻ màn hình trong video call
- **Voice Message** — Ghi âm và gửi tin nhắn thoại
- **Message Search** — Tìm kiếm tin nhắn
- **Stickers & GIFs** — Nhãn dán và ảnh động
- **Online Presence** — Trạng thái online/offline
- **Cloud Media** — Preview ảnh/video inline
- **Notification Management** — Mute, pin, archive conversation
- **Multi-device Sync** — Đồng bộ trạng thái cross-device
- **Rich Text & Link Preview** — Format text và preview link

---

## 2. Feature Matrix — Zalo Comparison

| Feature | Zalo | ACS Native Support | Implementation Strategy |
|---|:---:|:---:|---|
| **@Mention** | ✓ | ❌ | Library + message metadata |
| **Reactions/Emoji** | ✓ | ❌ | Backend + message metadata |
| **Reply** | ✓ | ❌ | Message metadata (parentMessageId) |
| **Forward** | ✓ | ❌ | Library logic — send copy to target thread |
| **Pin Message** | ✓ | ❌ | Backend per-thread pinned messages |
| **Audio Call 1-1** | ✓ | ✓ (Calling SDK) | ACS Calling SDK |
| **Video Call 1-1** | ✓ | ✓ (Calling SDK) | ACS Calling SDK |
| **Group Audio Call** | ✓ | ✓ (Calling SDK) | ACS Calling SDK (group call) |
| **Group Video Call** | ✓ | ✓ (Calling SDK) | ACS Calling SDK (group call) |
| **Screen Sharing** | ✓ (PC only) | ✓ (Calling SDK) | ACS Calling SDK |
| **Voice Message** | ✓ | ❌ | MediaRecorder API + Backend storage |
| **Message Search** | ✓ | ❌ | Backend search API |
| **Stickers** | ✓ | ❌ | Backend sticker packs + message metadata |
| **GIFs** | ✓ | ❌ | GIPHY/Tenor API integration |
| **Online Presence** | ✓ | ❌ (Chat SDK) | Backend WebSocket / separate service |
| **Image/Video Preview** | ✓ | ❌ | Azure Blob Storage + thumbnails |
| **Mute Conversation** | ✓ | ❌ | Backend per-user settings |
| **Pin Conversation** | ✓ | ❌ | Backend per-user settings |
| **Archive Conversation** | ✓ | ❌ | Backend per-user settings |
| **Multi-device Sync** | ✓ | ✓ (partial) | Backend persistence + ACS realtime |
| **Rich Text** | ✓ | ✓ (html type) | ACS html message type |
| **Link Preview** | ✓ | ❌ | Backend URL metadata extraction |

---

## 3. Mentions (@mention)

### 3.1 Concept

Cho phép user tag/mention user khác trong tin nhắn group chat. Khi user được mention, họ nhận notification ưu tiên.

### 3.2 ACS Support

> **ACS KHÔNG hỗ trợ native @mention.**
> 
> ACS message chỉ có `content: string` và `metadata: Record<string, string>`.
> Phải tự implement mention system qua message metadata.

### 3.3 Data Model

```ts
interface MentionData {
  userId: string;           // ACS user ID
  displayName: string;      // Display name tại thời điểm mention
  offset: number;           // Vị trí bắt đầu trong content string
  length: number;           // Độ dài của mention text (bao gồm @)
}

// Stored in message metadata
interface MentionMetadata {
  mentions: string;         // JSON.stringify(MentionData[])
  // metadata max 28KB (message level)
}

// Extended ChatMessage
interface ChatMessage {
  // ... existing fields from Phase 1
  mentions?: MentionData[];  // Parsed from metadata.mentions
}
```

### 3.4 Send Message with Mentions

```
User types "@" in MessageInput
        ↓
Show participant suggestion dropdown
  - Filter by typed text after "@"
  - Show participant avatars + names
        ↓
User selects a participant
        ↓
Insert mention token into content:
  Content: "Hello @User B, please review this"
  Mentions: [{ userId: 'user-b-id', displayName: 'User B', offset: 6, length: 8 }]
        ↓
On send:
  chatThreadClient.sendMessage(
    { content: "Hello @User B, please review this" },
    {
      type: 'text',
      metadata: {
        mentions: JSON.stringify([
          { userId: 'user-b-id', displayName: 'User B', offset: 6, length: 8 }
        ])
      }
    }
  )
```

### 3.5 Render Message with Mentions

```
chatMessageReceived event
        ↓
Parse metadata.mentions → MentionData[]
        ↓
Split content by mention offsets
        ↓
Render:
  "Hello " + <MentionBadge user={userB}>@User B</MentionBadge> + ", please review this"
        ↓
MentionBadge:
  - Highlighted text (different color/background)
  - Clickable → show user profile/info
  - If mentions current user → special highlight (bold/blink)
```

### 3.6 Special Mentions

```ts
// @all / @everyone — mention tất cả participants
const MENTION_ALL: MentionData = {
  userId: '__ALL__',
  displayName: 'Tất cả',
  offset: 0,
  length: 0, // calculated at insert
};

// Logic: When mention.userId === '__ALL__', 
// treat as if all participants are mentioned
```

### 3.7 Notification Priority

```
New message received
        ↓
Check metadata.mentions
        ↓
Is current user mentioned?
  ├── YES → High priority notification
  │         - Show notification even if conversation muted
  │         - Special badge indicator
  └── NO  → Normal notification flow
```

### 3.8 UI Components

```tsx
// MentionInput — Autocomplete trigger trong MessageInput
interface MentionInputProps {
  participants: ConversationParticipant[];
  onMentionSelect: (participant: ConversationParticipant) => void;
  triggerChar?: string;       // Default: '@'
  renderSuggestion?: (participant: ConversationParticipant) => ReactNode;
}

// MentionBadge — Inline mention highlight
interface MentionBadgeProps {
  mention: MentionData;
  isCurrentUser: boolean;     // Highlight differently if mentioning self
  onClick?: (userId: string) => void;
}
```

### 3.9 API

```ts
interface UseMentionsReturn {
  // Parse mentions from message
  parseMentions: (message: ChatMessage) => MentionData[];
  
  // Check if current user is mentioned
  isMentioned: (message: ChatMessage) => boolean;
  
  // Format message content with mention tokens
  formatContentWithMentions: (
    content: string,
    mentions: MentionData[]
  ) => { content: string; metadata: Record<string, string> };
}
```

### 3.10 Responsibility Matrix

| Responsibility | Owner |
|---|---|
| Mention suggestion UI | Library (MentionInput component) |
| Mention data serialization (→ metadata) | Library |
| Mention data deserialization (← metadata) | Library |
| Mention rendering (highlight, badge) | Library |
| Mention notification priority | Backend + Library |
| Store mention-related data | ACS (via message metadata) |

---

## 4. Message Reactions / Emoji

### 4.1 Concept

User có thể react emoji vào bất kỳ tin nhắn nào (like, love, haha, wow, sad, angry, hoặc custom emoji).

### 4.2 ACS Support

> **ACS KHÔNG hỗ trợ native message reactions.**
> 
> Phải implement thông qua **Backend API** kết hợp **message metadata** hoặc **separate reactions store**.

### 4.3 Architecture Decision

**Option A: Store reactions in message metadata (ACS)**
- Update message metadata mỗi khi có reaction.
- Limitation: Mỗi reaction update = 1 `updateMessage()` call → race condition risk.
- Limitation: Message metadata max ~28KB.

**Option B (Recommended): Store reactions in Backend**
- Backend lưu reactions riêng biệt.
- Không phụ thuộc ACS message metadata limit.
- Backend broadcast reaction events qua realtime channel (SignalR/WebSocket).
- Tránh race condition.

### 4.4 Data Model

```ts
type ReactionType = '👍' | '❤️' | '😂' | '😮' | '😢' | '😡' | string;

interface MessageReaction {
  messageId: string;
  conversationId: string;
  userId: string;
  displayName: string;
  reaction: ReactionType;
  createdAt: Date;
}

// Aggregated view
interface MessageReactionSummary {
  messageId: string;
  reactions: Record<ReactionType, {
    count: number;
    users: Array<{ userId: string; displayName: string }>;
    hasCurrentUserReacted: boolean;
  }>;
  totalCount: number;
}
```

### 4.5 Backend API

```
POST   /api/conversations/{conversationId}/messages/{messageId}/reactions
Body:  { reaction: '👍' }
Response: { success: true, reactionSummary: MessageReactionSummary }

DELETE /api/conversations/{conversationId}/messages/{messageId}/reactions
Body:  { reaction: '👍' }
Response: { success: true, reactionSummary: MessageReactionSummary }

GET    /api/conversations/{conversationId}/messages/{messageId}/reactions
Response: { reactions: MessageReactionSummary }
```

### 4.6 Realtime Sync

```
Backend receives reaction
        ↓
Store in DB: message_reactions table
        ↓
Broadcast to all participants via SignalR/WebSocket:
  Event: 'reaction:added' or 'reaction:removed'
  Payload: { conversationId, messageId, userId, displayName, reaction }
        ↓
Library receives event
        ↓
Update reactionStore
        ↓
React re-renders reaction badges on message
```

### 4.7 UI Components

```tsx
// ReactionPicker — Emoji picker overlay
interface ReactionPickerProps {
  onSelect: (reaction: ReactionType) => void;
  defaultReactions?: ReactionType[];    // Quick reactions
  enableCustom?: boolean;               // Allow custom emoji
}

// ReactionBadge — Reaction count display on message
interface ReactionBadgeProps {
  reactions: MessageReactionSummary;
  onToggle: (reaction: ReactionType) => void;
  onViewDetails: () => void;
}

// ReactionDetailModal — Who reacted what
interface ReactionDetailModalProps {
  reactions: MessageReactionSummary;
  onClose: () => void;
}
```

### 4.8 API

```ts
interface UseReactionsReturn {
  // Get reactions for a message
  getReactions: (messageId: string) => MessageReactionSummary | null;
  
  // Toggle reaction (add if not exists, remove if exists)
  toggleReaction: (messageId: string, reaction: ReactionType) => Promise<void>;
  
  // Add reaction
  addReaction: (messageId: string, reaction: ReactionType) => Promise<void>;
  
  // Remove reaction
  removeReaction: (messageId: string, reaction: ReactionType) => Promise<void>;
  
  // Loading state
  loading: boolean;
}
```

---

## 5. Reply Message (Trả lời tin nhắn)

### 5.1 Concept

User có thể reply (trả lời) một tin nhắn cụ thể, tạo thành thread context. Tin nhắn reply sẽ hiển thị quote của tin nhắn gốc.

### 5.2 ACS Support

> **ACS KHÔNG hỗ trợ native reply/threading.**
> 
> Implement qua message metadata: lưu `parentMessageId` để link reply → original message.

### 5.3 Data Model

```ts
// Extended message metadata
interface ReplyMetadata {
  replyTo: string;                // JSON.stringify(ReplyToData)
}

interface ReplyToData {
  messageId: string;              // ID of the message being replied to
  content: string;                // Preview content of original message (truncated)
  senderId: string;               // Original message sender
  senderDisplayName: string;      // Original message sender name
  messageType: MessageType;       // text/html/system
}

// Extended ChatMessage
interface ChatMessage {
  // ... existing fields
  replyTo?: ReplyToData;          // Parsed from metadata.replyTo
}
```

### 5.4 Reply Flow

```
User long-press/swipe/click "Reply" on a message
        ↓
Show reply preview bar above MessageInput:
  ┌─────────────────────────────────┐
  │ ↩ Replying to User B            │ ✕
  │ "Original message content..."   │
  └─────────────────────────────────┘
  [                  Message Input                  ] [Send]
        ↓
User types reply content and sends
        ↓
Library sends:
  chatThreadClient.sendMessage(
    { content: replyContent },
    {
      metadata: {
        replyTo: JSON.stringify({
          messageId: originalMessage.id,
          content: truncate(originalMessage.content, 100),
          senderId: originalMessage.sender.id,
          senderDisplayName: originalMessage.senderDisplayName,
          messageType: originalMessage.type,
        })
      }
    }
  )
```

### 5.5 Reply Rendering

```tsx
// MessageItem with reply
<MessageItem>
  {message.replyTo && (
    <ReplyQuote
      replyTo={message.replyTo}
      onClick={() => scrollToMessage(message.replyTo.messageId)}
    />
  )}
  <MessageContent content={message.content} />
</MessageItem>

// ReplyQuote component
interface ReplyQuoteProps {
  replyTo: ReplyToData;
  onClick?: () => void;           // Scroll to original message
  renderQuote?: (replyTo: ReplyToData) => ReactNode;
}
```

### 5.6 Scroll to Original Message

```
User clicks on ReplyQuote
        ↓
Is original message loaded in current message list?
  ├── YES → Smooth scroll to message, highlight briefly
  └── NO  → 
        ├── Message is in an older page → Load messages until found, then scroll
        └── Message not found (deleted) → Show "Message not found" tooltip
```

### 5.7 API

```ts
interface UseReplyReturn {
  // Currently replying to message
  replyingTo: ChatMessage | null;
  
  // Start reply mode
  setReplyTo: (message: ChatMessage) => void;
  
  // Cancel reply
  cancelReply: () => void;
  
  // Send reply (wraps sendMessage with reply metadata)
  sendReply: (content: string, options?: SendMessageOptions) => Promise<void>;
}
```

---

## 6. Forward Message (Chuyển tiếp tin nhắn)

### 6.1 Concept

User có thể chuyển tiếp (forward) một tin nhắn sang conversation khác (hoặc nhiều conversations).

### 6.2 ACS Support

> **ACS KHÔNG hỗ trợ native forward.**
> 
> Implement bằng cách gửi một message mới tới target conversation với metadata đánh dấu "forwarded".

### 6.3 Data Model

```ts
interface ForwardMetadata {
  forwarded: string;            // JSON.stringify(ForwardedFromData)
}

interface ForwardedFromData {
  originalMessageId: string;
  originalConversationId: string;
  originalSenderId: string;
  originalSenderDisplayName: string;
  originalCreatedAt: string;     // ISO date string
}

// Extended ChatMessage
interface ChatMessage {
  // ... existing fields
  forwardedFrom?: ForwardedFromData;  // Parsed from metadata.forwarded
}
```

### 6.4 Forward Flow

```
User clicks "Forward" on a message
        ↓
Open ForwardDialog:
  - Show conversation list (can multi-select)
  - Search conversations
  - Optional: add comment before forwarding
        ↓
User selects target conversation(s) and confirms
        ↓
For each target conversation:
  chatThreadClient.sendMessage(
    { content: originalMessage.content },
    {
      metadata: {
        forwarded: JSON.stringify({
          originalMessageId: originalMessage.id,
          originalConversationId: originalMessage.conversationId,
          originalSenderId: originalMessage.sender.id,
          originalSenderDisplayName: originalMessage.senderDisplayName,
          originalCreatedAt: originalMessage.createdAt.toISOString(),
        }),
        // Also forward attachments metadata if any
        ...originalMessage.metadata
      }
    }
  )
        ↓
Show success: "Forwarded to N conversations"
```

### 6.5 Forward Rendering

```tsx
// MessageItem with forward indicator
<MessageItem>
  {message.forwardedFrom && (
    <ForwardIndicator forwardedFrom={message.forwardedFrom} />
  )}
  <MessageContent content={message.content} />
</MessageItem>

// ForwardIndicator
// Shows: "↪ Forwarded from User A"
interface ForwardIndicatorProps {
  forwardedFrom: ForwardedFromData;
}
```

### 6.6 UI Components

```tsx
// ForwardDialog — Select target conversations
interface ForwardDialogProps {
  message: ChatMessage;
  conversations: Conversation[];
  onForward: (targetConversationIds: string[], comment?: string) => Promise<void>;
  onClose: () => void;
  allowMultiSelect?: boolean;
  renderConversationItem?: (conversation: Conversation) => ReactNode;
}
```

### 6.7 API

```ts
interface UseForwardReturn {
  // Forward a message to one or more conversations
  forwardMessage: (
    message: ChatMessage,
    targetConversationIds: string[],
    comment?: string
  ) => Promise<void>;
  
  // Loading state
  forwarding: boolean;
}
```

---

## 7. Pin Message (Ghim tin nhắn)

### 7.1 Concept

Owner/Admin có thể ghim (pin) tin nhắn quan trọng trong conversation. Tin nhắn ghim hiển thị ở header/top của chat area.

### 7.2 ACS Support

> **ACS KHÔNG hỗ trợ native pin message.**
> 
> Backend quản lý pinned messages per conversation.

### 7.3 Data Model

```ts
interface PinnedMessage {
  id: string;                       // Pin record ID
  messageId: string;                // ACS message ID
  conversationId: string;
  pinnedBy: ChatUser;
  pinnedAt: Date;
  
  // Cached message content (in case original deleted)
  content: string;
  senderDisplayName: string;
  messageCreatedAt: Date;
}
```

### 7.4 Backend API

```
POST   /api/conversations/{conversationId}/pins
Body:  { messageId: string }
Response: { pinnedMessage: PinnedMessage }

DELETE /api/conversations/{conversationId}/pins/{pinId}
Response: { success: true }

GET    /api/conversations/{conversationId}/pins
Response: { pinnedMessages: PinnedMessage[] }
```

### 7.5 Pin Flow

```
User (owner/admin) right-clicks message → "Pin Message"
        ↓
Library calls Backend: POST /api/conversations/{id}/pins
        ↓
Backend validates permissions (owner/admin only)
        ↓
Backend stores pin record
        ↓
Backend broadcasts event: 'message:pinned'
        ↓
All participants receive pin event
        ↓
Library updates pinnedMessages store
        ↓
UI shows pinned message banner at top of chat
```

### 7.6 UI Components

```tsx
// PinnedMessageBanner — Sticky at top of message area
interface PinnedMessageBannerProps {
  pinnedMessages: PinnedMessage[];
  onScrollTo: (messageId: string) => void;
  onUnpin?: (pinId: string) => void;
  canUnpin: boolean;
}

// If multiple pins: show carousel or expandable list
```

### 7.7 API

```ts
interface UsePinnedMessagesReturn {
  pinnedMessages: PinnedMessage[];
  loading: boolean;
  
  pinMessage: (messageId: string) => Promise<void>;
  unpinMessage: (pinId: string) => Promise<void>;
  
  // Permission check
  canPin: boolean;
  canUnpin: boolean;
}
```

---

## 8. Audio / Video Calling

### 8.1 Concept

Cho phép user thực hiện cuộc gọi thoại (audio) và video call, bao gồm 1-1 và group call. Đây là tính năng quan trọng nhất của Phase 2.

### 8.2 ACS Calling SDK

> **ACS hỗ trợ đầy đủ Audio/Video calling qua Calling SDK.**
> 
> Package: `@azure/communication-calling`
> UI Package: `@azure/communication-react` (optional — pre-built composites)

### 8.3 Package Dependencies

```json
{
  "peerDependencies": {
    "@azure/communication-calling": "^1.28.0",
    "@azure/communication-common": "^2.0.0"
  },
  "optionalDependencies": {
    "@azure/communication-react": "^1.20.0"
  }
}
```

### 8.4 Calling Architecture

```
React Application
       │
       │ <CallProvider>
       ▼
┌──────────────────────────────────────────┐
│          Calling Module                   │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  UI Components                    │    │
│  │  CallScreen, IncomingCallDialog,  │    │
│  │  CallingControls, VideoGallery    │    │
│  └──────────────┬───────────────────┘    │
│                 │                         │
│  ┌──────────────▼───────────────────┐    │
│  │  Hooks                            │    │
│  │  useCall, useCallAgent,           │    │
│  │  useDevices, useCallState         │    │
│  └──────────────┬───────────────────┘    │
│                 │                         │
│  ┌──────────────▼───────────────────┐    │
│  │  Calling Service                  │    │
│  │  CallService, DeviceService       │    │
│  └──────────────┬───────────────────┘    │
│                 │                         │
│  ┌──────────────▼───────────────────┐    │
│  │  ACS Calling Adapter              │    │
│  │  CallAgent, Call, VideoStream     │    │
│  └──────────────┬───────────────────┘    │
│                 │                         │
└─────────────────┼────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │ Azure Communication │
        │ Services            │
        │ - Calling API       │
        │ - TURN/STUN servers │
        │ - Media relay       │
        └─────────────────────┘
```

### 8.5 Call Types

```ts
type CallType = 'audio' | 'video';
type CallDirection = 'incoming' | 'outgoing';
type CallMode = '1:1' | 'group';

interface CallInfo {
  id: string;                        // Call ID
  type: CallType;
  direction: CallDirection;
  mode: CallMode;
  state: CallState;
  
  // Participants
  caller: ChatUser;
  participants: CallParticipant[];
  
  // Conversation context
  conversationId?: string;           // Linked conversation
  
  // Timing
  startedAt?: Date;
  connectedAt?: Date;
  endedAt?: Date;
  duration?: number;                 // seconds
  
  // Media
  isLocalVideoOn: boolean;
  isLocalAudioOn: boolean;
  isScreenSharing: boolean;
}

type CallState =
  | 'none'
  | 'ringing'            // Outgoing: ringing target
  | 'incoming'           // Incoming: showing incoming call UI
  | 'connecting'         // Setting up media
  | 'connected'          // Active call
  | 'hold'               // Call on hold
  | 'disconnecting'      // Ending call
  | 'disconnected';      // Call ended

interface CallParticipant {
  user: ChatUser;
  state: ParticipantState;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  videoStream?: RemoteVideoStream;
}

type ParticipantState = 'connecting' | 'ringing' | 'connected' | 'hold' | 'disconnected';
```

### 8.6 Initialization

```ts
// CallProvider — wraps calling functionality
interface CallConfig {
  // ACS token (same as chat, but with ['voip'] scope)
  // Backend phải issue token với scope: ['chat', 'voip']
  token: string;
  userId: string;
  displayName: string;
  
  // Callbacks
  onIncomingCall?: (callInfo: IncomingCallInfo) => void;
  onCallEnded?: (callInfo: CallInfo, reason: CallEndReason) => void;
}

// Initialization flow
// 1. Create CallClient
// 2. Create CallAgent (with token + displayName)
// 3. Subscribe to incoming call events
// 4. Get device permissions (microphone, camera)
```

### 8.7 Call Flows

#### 8.7.1 Start 1-1 Audio Call

```
User clicks "Call" button in conversation header
        ↓
Library creates call via CallAgent:
  callAgent.startCall(
    [{ communicationUserId: targetUserId }],
    { videoOptions: { localVideoStreams: [] } }  // audio only
  )
        ↓
ACS establishes connection
        ↓
Show CallScreen UI:
  ┌────────────────────────────────┐
  │         Calling...             │
  │                                │
  │        [User Avatar]           │
  │        User B                  │
  │        00:00                   │
  │                                │
  │  [🔇]  [📞 End]  [🔊]        │
  └────────────────────────────────┘
        ↓
Target receives incoming call event
        ↓
Call connected → Update UI with timer
```

#### 8.7.2 Start 1-1 Video Call

```
User clicks "Video Call" button
        ↓
Request camera permission
        ↓
Create LocalVideoStream
        ↓
callAgent.startCall(
  [{ communicationUserId: targetUserId }],
  { videoOptions: { localVideoStreams: [localVideoStream] } }
)
        ↓
Show VideoCallScreen:
  ┌────────────────────────────────┐
  │                                │
  │   ┌──────────────────────┐     │
  │   │   Remote Video       │     │
  │   │   (User B)           │     │
  │   └──────────────────────┘     │
  │                                │
  │                    ┌─────────┐ │
  │                    │ Local   │ │
  │                    │ Video   │ │
  │                    └─────────┘ │
  │                                │
  │ [🎤] [📹] [🖥️] [📞 End]     │
  └────────────────────────────────┘
```

#### 8.7.3 Incoming Call

```
callAgent.on('incomingCall', (incomingCall) => ...)
        ↓
Show IncomingCallDialog:
  ┌────────────────────────────────┐
  │     Incoming Call              │
  │                                │
  │     [User Avatar]              │
  │     User A                     │
  │     Audio Call / Video Call    │
  │                                │
  │  [❌ Decline]    [✅ Accept]   │
  │               [📹 Video Accept]│
  └────────────────────────────────┘
        ↓
User accepts:
  incomingCall.accept({ videoOptions })
        ↓
Call connected
```

#### 8.7.4 Group Call

```
User clicks "Group Call" in group conversation
        ↓
callAgent.startCall(
  participants.map(p => ({ communicationUserId: p.userId })),
  { videoOptions }
)
        ↓
Show GroupCallScreen:
  ┌────────────────────────────────┐
  │  ┌──────┐ ┌──────┐ ┌──────┐  │
  │  │User A│ │User B│ │User C│  │
  │  │Video │ │Video │ │Video │  │
  │  └──────┘ └──────┘ └──────┘  │
  │                                │
  │  ┌──────┐ ┌──────┐            │
  │  │User D│ │User E│ + 2 more  │
  │  │Video │ │Avatar│            │
  │  └──────┘ └──────┘            │
  │                                │
  │  [🎤] [📹] [🖥️] [👥] [📞]  │
  └────────────────────────────────┘
```

### 8.8 Call Controls

```ts
interface CallControls {
  // Audio
  toggleMute: () => Promise<void>;
  isMuted: boolean;
  
  // Video
  toggleVideo: () => Promise<void>;
  isVideoOn: boolean;
  
  // Screen sharing
  toggleScreenShare: () => Promise<void>;
  isScreenSharing: boolean;
  
  // Call management
  hangUp: () => Promise<void>;
  hold: () => Promise<void>;
  resume: () => Promise<void>;
  
  // Device management
  switchCamera: () => Promise<void>;
  switchMicrophone: (deviceId: string) => Promise<void>;
  switchSpeaker: (deviceId: string) => Promise<void>;
  
  // Group call
  addParticipant: (userId: string) => Promise<void>;
  removeParticipant: (userId: string) => Promise<void>;
}
```

### 8.9 Device Management

```ts
interface DeviceInfo {
  cameras: VideoDeviceInfo[];
  microphones: AudioDeviceInfo[];
  speakers: AudioDeviceInfo[];
  
  selectedCamera?: VideoDeviceInfo;
  selectedMicrophone?: AudioDeviceInfo;
  selectedSpeaker?: AudioDeviceInfo;
  
  // Permissions
  cameraPermission: PermissionState;    // 'granted' | 'denied' | 'prompt'
  microphonePermission: PermissionState;
}

interface UseDevicesReturn {
  devices: DeviceInfo;
  
  // Request permissions
  requestCameraPermission: () => Promise<boolean>;
  requestMicrophonePermission: () => Promise<boolean>;
  
  // Switch devices
  selectCamera: (deviceId: string) => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  selectSpeaker: (deviceId: string) => Promise<void>;
  
  // Device changes
  onDevicesChanged: (callback: () => void) => void;
}
```

### 8.10 Call History / System Messages

```
Call ended
        ↓
Library sends system message to conversation:
  chatThreadClient.sendMessage(
    { content: 'Audio call · 5:23' },
    {
      metadata: {
        systemType: 'call_ended',
        callType: 'audio',
        callDuration: '323',        // seconds
        callId: 'call-xxx',
        participants: JSON.stringify(['user-a', 'user-b']),
      }
    }
  )
        ↓
Rendered as system message in chat:
  ┌──────────────────────┐
  │ 📞 Audio call · 5:23 │
  └──────────────────────┘
```

### 8.11 UI Components

```tsx
// CallProvider — Context for calling
<CallProvider config={callConfig}>
  {children}
</CallProvider>

// CallScreen — Full screen call UI (audio or video)
interface CallScreenProps {
  call: CallInfo;
  onHangUp: () => void;
  renderControls?: (controls: CallControls) => ReactNode;
  renderParticipant?: (participant: CallParticipant) => ReactNode;
}

// IncomingCallDialog — Popup for incoming calls
interface IncomingCallDialogProps {
  call: IncomingCallInfo;
  onAccept: (withVideo: boolean) => void;
  onDecline: () => void;
}

// CallingControls — Control bar (mute, video, hangup, etc.)
interface CallingControlsProps {
  controls: CallControls;
  layout?: 'horizontal' | 'vertical';
}

// VideoGallery — Grid layout for multiple video streams
interface VideoGalleryProps {
  participants: CallParticipant[];
  localVideoStream?: LocalVideoStream;
  layout?: 'gallery' | 'speaker' | 'sidebar';
  dominantSpeaker?: string;  // userId of dominant speaker
}

// LocalVideoPreview — Self preview before/during call
interface LocalVideoPreviewProps {
  videoStream: LocalVideoStream;
  isMirrored?: boolean;
}

// DeviceSettings — Device selection (camera, mic, speaker)
interface DeviceSettingsProps {
  devices: DeviceInfo;
  onSelectCamera: (deviceId: string) => void;
  onSelectMicrophone: (deviceId: string) => void;
  onSelectSpeaker: (deviceId: string) => void;
}
```

### 8.12 Hooks API

```ts
// useCall — Main call hook
interface UseCallReturn {
  // Current call
  currentCall: CallInfo | null;
  callState: CallState;
  
  // Start call
  startAudioCall: (userId: string) => Promise<void>;
  startVideoCall: (userId: string) => Promise<void>;
  startGroupCall: (userIds: string[], withVideo?: boolean) => Promise<void>;
  
  // Incoming call
  incomingCall: IncomingCallInfo | null;
  acceptCall: (withVideo?: boolean) => Promise<void>;
  declineCall: () => Promise<void>;
  
  // Controls
  controls: CallControls;
  
  // Participants
  remoteParticipants: CallParticipant[];
  
  // Error
  error: ChatError | null;
}

// useCallAgent — Lower-level call agent management
interface UseCallAgentReturn {
  callAgent: CallAgent | null;
  isReady: boolean;
  error: ChatError | null;
}

// useDevices — Device management
// (defined in section 8.9)
```

### 8.13 Token Scope Update

```
// Phase 1: token scope = ['chat']
// Phase 2: token scope = ['chat', 'voip']

// Backend must update token issuance:
CommunicationIdentityClient.getToken(user, ['chat', 'voip'])
```

### 8.14 Error Cases

| Error | Handling |
|---|---|
| Camera/mic permission denied | Show permission request dialog |
| No camera/mic device found | Show device not found error |
| Call failed to connect | Retry or show error |
| Network interrupted during call | Show reconnecting UI, auto-retry |
| Target user offline/unavailable | Show "User unavailable" after timeout |
| Concurrent call (already in call) | Block new call, show "Already in a call" |
| Token expired during call | Auto-refresh token (same mechanism as chat) |

### 8.15 ACS Calling SDK API Reference

| Capability | ACS API | Notes |
|---|---|---|
| Create CallClient | `new CallClient()` | One per app |
| Create CallAgent | `callClient.createCallAgent(credential, { displayName })` | One per user |
| Start call | `callAgent.startCall(participants, options)` | Audio or video |
| Accept incoming call | `incomingCall.accept(options)` | |
| Decline incoming call | `incomingCall.reject()` | |
| Hang up | `call.hangUp()` | |
| Mute/unmute | `call.mute()` / `call.unmute()` | |
| Start/stop video | `call.startVideo(stream)` / `call.stopVideo(stream)` | |
| Screen share | `call.startScreenSharing()` / `call.stopScreenSharing()` | Desktop only |
| Hold/resume | `call.hold()` / `call.resume()` | |
| Add participant | `call.addParticipant(identifier)` | |
| Remove participant | `call.removeParticipant(identifier)` | |
| Get devices | `callClient.getDeviceManager()` | Cameras, mics, speakers |
| Subscribe events | `call.on('stateChanged', ...)` | |

---

## 9. Screen Sharing

### 9.1 Concept

Trong video call, user có thể chia sẻ màn hình (toàn bộ screen, cửa sổ ứng dụng, hoặc tab trình duyệt).

### 9.2 ACS Support

> **ACS Calling SDK hỗ trợ screen sharing.**
> 
> `call.startScreenSharing()` / `call.stopScreenSharing()`
> Chỉ hỗ trợ trên Desktop browser (không hỗ trợ mobile browser).

### 9.3 Screen Sharing Flow

```
User clicks "Share Screen" button during call
        ↓
Browser shows screen/window/tab picker (native browser UI)
        ↓
User selects what to share
        ↓
call.startScreenSharing()
        ↓
Remote participants receive screen stream
        ↓
UI: Show shared screen as primary view, video feeds as thumbnails
        ↓
User clicks "Stop Sharing"
        ↓
call.stopScreenSharing()
```

### 9.4 Screen Share Layout

```
┌────────────────────────────────────┐
│  ┌──────────────────────────────┐  │
│  │                              │  │
│  │     Shared Screen            │  │
│  │     (Full width)             │  │
│  │                              │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌─────┐ ┌─────┐ ┌─────┐          │
│  │ Me  │ │ B   │ │ C   │ + more   │
│  └─────┘ └─────┘ └─────┘          │
│                                    │
│  [🎤] [📹] [🖥️ Stop] [📞]       │
└────────────────────────────────────┘
```

### 9.5 API

```ts
interface UseScreenShareReturn {
  isScreenSharing: boolean;
  isRemoteScreenSharing: boolean;
  remoteScreenShareStream?: RemoteVideoStream;
  screenShareUser?: ChatUser;
  
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  
  // Browser support check
  isScreenShareSupported: boolean;
}
```

---

## 10. Voice Message (Tin nhắn thoại)

### 10.1 Concept

User có thể ghi âm giọng nói và gửi dưới dạng tin nhắn thoại (giống Zalo voice message).

### 10.2 ACS Support

> **ACS KHÔNG hỗ trợ native voice message.**
> 
> Implement bằng: MediaRecorder API (browser) → upload audio file → Backend storage → send message with audio metadata.

### 10.3 Voice Message Flow

```
User holds/clicks microphone button
        ↓
Request microphone permission (if not granted)
        ↓
Start recording via MediaRecorder API
        ↓
Show recording UI:
  ┌──────────────────────────────────────┐
  │ 🔴 Recording... 00:05  [Cancel] [✓] │
  │ ▁▂▃▅▃▂▁▃▅▇▅▃▂  (waveform)         │
  └──────────────────────────────────────┘
        ↓
User stops recording (release button / click stop)
        ↓
Create audio Blob (format: WebM/OGG or MP4/AAC)
        ↓
Upload to Backend: POST /api/files/upload
  Body: FormData { file: audioBlob, type: 'voice_message' }
        ↓
Backend returns: { fileId, url, duration, waveformData }
        ↓
Library sends ACS message:
  chatThreadClient.sendMessage(
    { content: '🎤 Voice message' },
    {
      metadata: {
        attachmentType: 'voice',
        fileId: 'xxx',
        fileUrl: 'https://blob.../audio.webm',
        duration: '5',              // seconds
        waveform: '[0.2,0.5,0.8,0.3,...]',  // normalized amplitudes
        mimeType: 'audio/webm',
      }
    }
  )
```

### 10.4 Voice Message Rendering

```tsx
// VoiceMessagePlayer component
<VoiceMessagePlayer
  url={metadata.fileUrl}
  duration={parseInt(metadata.duration)}
  waveform={JSON.parse(metadata.waveform)}
/>

// Renders:
┌────────────────────────────────────┐
│ ▶ ▁▂▃▅▃▂▁▃▅▇▅▃▂▁ 0:05            │
│   ━━━━━━━━━━━━━━━━━━━━━  progress │
└────────────────────────────────────┘
```

### 10.5 Data Model

```ts
interface VoiceMessageData {
  fileId: string;
  fileUrl: string;
  duration: number;           // seconds
  waveform: number[];         // normalized amplitude values [0..1]
  mimeType: string;
}

// Parse from message metadata
function parseVoiceMessage(metadata?: Record<string, string>): VoiceMessageData | null {
  if (metadata?.attachmentType !== 'voice') return null;
  return {
    fileId: metadata.fileId,
    fileUrl: metadata.fileUrl,
    duration: parseInt(metadata.duration),
    waveform: JSON.parse(metadata.waveform || '[]'),
    mimeType: metadata.mimeType,
  };
}
```

### 10.6 UI Components

```tsx
// VoiceRecorder — Recording button + controls
interface VoiceRecorderProps {
  onRecordComplete: (blob: Blob, duration: number, waveform: number[]) => void;
  onCancel: () => void;
  maxDuration?: number;       // Default: 300 seconds (5 min)
}

// VoiceMessagePlayer — Playback component
interface VoiceMessagePlayerProps {
  url: string;
  duration: number;
  waveform: number[];
  autoPlay?: boolean;
}
```

### 10.7 API

```ts
interface UseVoiceMessageReturn {
  // Recording state
  isRecording: boolean;
  recordingDuration: number;   // current recording duration in seconds
  
  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ blob: Blob; duration: number; waveform: number[] }>;
  cancelRecording: () => void;
  
  // Send recorded voice message
  sendVoiceMessage: (conversationId: string) => Promise<void>;
  
  // Permission
  hasMicrophonePermission: boolean;
  requestPermission: () => Promise<boolean>;
}
```

---

## 11. Message Search

### 11.1 Concept

Cho phép user tìm kiếm tin nhắn trong conversation hoặc toàn bộ conversations.

### 11.2 ACS Support

> **ACS KHÔNG hỗ trợ message search.**
> 
> Backend phải implement full-text search (Azure Cognitive Search hoặc tương đương).

### 11.3 Search Scopes

| Scope | Mô tả | Backend API |
|---|---|---|
| **Global search** | Tìm trong tất cả conversations | `GET /api/search/messages?q=keyword` |
| **Conversation search** | Tìm trong 1 conversation cụ thể | `GET /api/conversations/{id}/search?q=keyword` |
| **User search** | Tìm tin nhắn từ user cụ thể | `GET /api/search/messages?q=keyword&senderId=xxx` |

### 11.4 Search Result Model

```ts
interface SearchResult {
  messageId: string;
  conversationId: string;
  conversationName: string;
  content: string;               // Full message content
  highlightedContent: string;    // Content with <mark> highlights
  sender: ChatUser;
  createdAt: Date;
  matchCount: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

### 11.5 Backend API

```
GET /api/search/messages
  Query params:
    q: string                    // Search keyword
    conversationId?: string      // Scope to specific conversation
    senderId?: string            // Filter by sender
    dateFrom?: string            // ISO date
    dateTo?: string              // ISO date
    page?: number                // Default: 1
    pageSize?: number            // Default: 20
  
  Response: SearchResponse
```

### 11.6 Search Flow

```
User opens search (Ctrl+F or search icon)
        ↓
Show SearchOverlay:
  ┌──────────────────────────────────┐
  │ 🔍 [Search messages...       ] ✕ │
  │                                  │
  │ Filters: [All chats ▼] [Date ▼] │
  │                                  │
  │ Results:                         │
  │ ┌──────────────────────────────┐ │
  │ │ Team Chat — User A            │ │
  │ │ "Let's discuss the **API**..." │ │
  │ │ 2 hours ago                    │ │
  │ └──────────────────────────────┘ │
  │ ┌──────────────────────────────┐ │
  │ │ Direct — User B               │ │
  │ │ "Updated the **API** docs"     │ │
  │ │ Yesterday                      │ │
  │ └──────────────────────────────┘ │
  │                                  │
  │ [Load more results]              │
  └──────────────────────────────────┘
        ↓
User clicks result
        ↓
Navigate to conversation → Scroll to message → Highlight
```

### 11.7 UI Components

```tsx
// SearchOverlay — Full search experience
interface SearchOverlayProps {
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
  scope?: 'global' | 'conversation';
  conversationId?: string;
  renderResult?: (result: SearchResult) => ReactNode;
}

// SearchBar — Inline search within conversation
interface SearchBarProps {
  conversationId: string;
  onNavigateToResult: (messageId: string) => void;
}
```

### 11.8 API

```ts
interface UseSearchReturn {
  // Search state
  results: SearchResult[];
  totalCount: number;
  loading: boolean;
  hasMore: boolean;
  error: ChatError | null;
  
  // Actions
  search: (query: string, options?: SearchOptions) => Promise<void>;
  searchMore: () => Promise<void>;
  clearSearch: () => void;
  
  // Navigate to result
  navigateToResult: (result: SearchResult) => Promise<void>;
}

interface SearchOptions {
  conversationId?: string;
  senderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  pageSize?: number;
}
```

---

## 12. Stickers & GIFs

### 12.1 Concept

User có thể gửi sticker (nhãn dán) và GIF (ảnh động) trong tin nhắn.

### 12.2 ACS Support

> **ACS KHÔNG hỗ trợ native stickers/GIFs.**
> 
> Implement qua message metadata + Backend sticker management + GIF provider API.

### 12.3 Sticker Architecture

```
Backend manages sticker packs:
  ┌─────────────────────┐
  │ Sticker Packs       │
  │ ├── Default Pack 1  │
  │ │   ├── sticker_1   │
  │ │   ├── sticker_2   │
  │ │   └── ...         │
  │ ├── Pack 2          │
  │ └── User Custom     │
  └─────────────────────┘
```

### 12.4 Data Model

```ts
interface StickerPack {
  id: string;
  name: string;
  thumbnailUrl: string;
  stickers: Sticker[];
  isDefault: boolean;
  isUserAdded: boolean;
}

interface Sticker {
  id: string;
  packId: string;
  url: string;                  // CDN URL to sticker image (PNG/WebP/APNG)
  thumbnailUrl: string;
  altText: string;
  width: number;
  height: number;
}

// GIF from provider (GIPHY/Tenor)
interface GifResult {
  id: string;
  url: string;                  // Full GIF URL
  previewUrl: string;           // Preview/thumbnail
  width: number;
  height: number;
  title: string;
}
```

### 12.5 Send Sticker/GIF Flow

```
User clicks sticker/GIF button in MessageInput
        ↓
Show StickerGifPicker:
  ┌──────────────────────────────────┐
  │ [Stickers] [GIFs]               │
  │ 🔍 Search...                     │
  │                                  │
  │ [😀] [🎉] [🐱]                  │ ← Sticker pack tabs
  │                                  │
  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
  │ │ 😊 │ │ 😂 │ │ 😍 │ │ 🎉 │    │
  │ └────┘ └────┘ └────┘ └────┘    │
  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
  │ │ 👍 │ │ ❤️ │ │ 🎊 │ │ 🌟 │    │
  │ └────┘ └────┘ └────┘ └────┘    │
  └──────────────────────────────────┘
        ↓
User selects sticker/GIF
        ↓
Library sends:
  chatThreadClient.sendMessage(
    { content: altText },        // Fallback text
    {
      metadata: {
        attachmentType: 'sticker' | 'gif',
        imageUrl: stickerOrGifUrl,
        thumbnailUrl: thumbnailUrl,
        width: '200',
        height: '200',
        stickerId: 'xxx',        // For stickers
        gifId: 'xxx',            // For GIFs
        gifProvider: 'giphy',    // For GIFs
      }
    }
  )
```

### 12.6 API

```ts
interface UseStickersReturn {
  // Sticker packs
  packs: StickerPack[];
  loadPacks: () => Promise<void>;
  
  // Send sticker
  sendSticker: (conversationId: string, sticker: Sticker) => Promise<void>;
}

interface UseGifsReturn {
  // Search GIFs
  searchGifs: (query: string) => Promise<GifResult[]>;
  trendingGifs: () => Promise<GifResult[]>;
  
  // Send GIF
  sendGif: (conversationId: string, gif: GifResult) => Promise<void>;
}
```

---

## 13. Online Presence / User Status

### 13.1 Concept

Hiển thị trạng thái online/offline/away/busy của user trong conversation list, participant list, và chat header.

### 13.2 ACS Support

> **ACS Chat SDK KHÔNG hỗ trợ user presence/status.**
> 
> Phải implement qua Backend riêng biệt (SignalR/WebSocket heartbeat).

### 13.3 Presence Architecture

```
User opens app
        ↓
Library connects to Backend Presence Service (SignalR/WebSocket)
        ↓
Send heartbeat every 30 seconds
        ↓
Backend tracks:
  user_presence table:
  ┌──────────┬──────────┬─────────────────────┐
  │ user_id  │ status   │ last_seen_at        │
  ├──────────┼──────────┼─────────────────────┤
  │ user_a   │ online   │ 2026-08-06 09:00:00 │
  │ user_b   │ away     │ 2026-08-06 08:55:00 │
  │ user_c   │ offline  │ 2026-08-06 07:30:00 │
  └──────────┴──────────┴─────────────────────┘
        ↓
Backend broadcasts presence changes to relevant users
        ↓
Library updates presenceStore
        ↓
UI shows green dot (online), yellow (away), gray (offline)
```

### 13.4 Data Model

```ts
type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: Date;
  statusMessage?: string;      // Custom status text
}
```

### 13.5 Presence Logic

```ts
// Auto status transitions
// Online → Away: No activity for 5 minutes
// Away → Offline: No heartbeat for 2 minutes
// Offline → Online: App focus + heartbeat received

// Manual status
// User can set: Online, Away, Busy, Offline (appear offline)
```

### 13.6 API

```ts
interface UsePresenceReturn {
  // Get presence for specific users
  getPresence: (userId: string) => UserPresence | null;
  
  // Batch get (for conversation lists)
  getPresences: (userIds: string[]) => Record<string, UserPresence>;
  
  // Set own status
  setStatus: (status: PresenceStatus) => Promise<void>;
  setStatusMessage: (message: string) => Promise<void>;
  
  // Current user presence
  myPresence: UserPresence;
}
```

### 13.7 UI Components

```tsx
// PresenceDot — Green/yellow/gray dot
interface PresenceDotProps {
  status: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
}

// LastSeen — "Active 5 min ago" text
interface LastSeenProps {
  presence: UserPresence;
  format?: 'relative' | 'absolute';
}
```

---

## 14. Cloud Media (Image/Video Preview)

### 14.1 Concept

Khi user gửi ảnh hoặc video, hiển thị preview inline trong chat (không chỉ link download).

### 14.2 Architecture

```
User selects image/video
        ↓
Upload to Backend → Azure Blob Storage
        ↓
Backend generates:
  - Thumbnail (image: 300x300, video: 300x300 first frame)
  - Compressed version (for inline display)
  - Original (for download/full view)
        ↓
Backend returns URLs + metadata
        ↓
Library sends message with media metadata
        ↓
Receivers see inline preview
```

### 14.3 Data Model

```ts
interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  
  // URLs
  originalUrl: string;
  thumbnailUrl: string;
  compressedUrl?: string;       // For inline display
  
  // Dimensions
  width: number;
  height: number;
  
  // File info
  fileName: string;
  fileSize: number;
  mimeType: string;
  
  // Video specific
  duration?: number;            // seconds
  
  // Blurhash for placeholder while loading
  blurhash?: string;
}
```

### 14.4 Image/Video Rendering

```tsx
// ImageMessage — Inline image with lightbox
<ImageMessage
  media={mediaAttachment}
  onClick={() => openLightbox(mediaAttachment)}
/>

// Renders:
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   [Image Preview]   │ │
│ │    (max 300x300)    │ │
│ │                     │ │
│ └─────────────────────┘ │
│ photo.jpg · 2.1MB       │
└─────────────────────────┘

// VideoMessage — Inline video with play button
<VideoMessage
  media={mediaAttachment}
  onClick={() => openVideoPlayer(mediaAttachment)}
/>

// Renders:
┌─────────────────────────┐
│ ┌─────────────────────┐ │
│ │                     │ │
│ │   [Video Thumbnail] │ │
│ │      ▶ 0:32         │ │
│ │                     │ │
│ └─────────────────────┘ │
│ video.mp4 · 15.3MB      │
└─────────────────────────┘
```

### 14.5 Image Gallery / Lightbox

```tsx
// MediaLightbox — Full screen image/video viewer
interface MediaLightboxProps {
  media: MediaAttachment[];
  initialIndex: number;
  onClose: () => void;
  onDownload: (media: MediaAttachment) => void;
}

// Features:
// - Swipe left/right to navigate
// - Pinch to zoom (touch)
// - Scroll to zoom (mouse)
// - Download button
// - Share button
```

### 14.6 Multi-image Upload

```
User selects multiple images (max 10 per batch)
        ↓
Show upload preview:
  ┌────────────────────────────────┐
  │ ┌────┐ ┌────┐ ┌────┐ ✕       │
  │ │img1│ │img2│ │img3│          │
  │ └────┘ └────┘ └────┘          │
  │ [Add more] [Optional caption] │
  │                        [Send] │
  └────────────────────────────────┘
        ↓
Upload all images → send single message with multiple attachments
  metadata: {
    attachmentType: 'media_album',
    attachments: JSON.stringify([...MediaAttachment[]])
  }
```

### 14.7 API

```ts
interface UseMediaReturn {
  // Upload media
  uploadMedia: (files: File[]) => Promise<MediaAttachment[]>;
  
  // Upload progress
  uploadProgress: Record<string, number>;  // fileId → progress %
  
  // Send media message
  sendMediaMessage: (
    conversationId: string,
    media: MediaAttachment[],
    caption?: string
  ) => Promise<void>;
  
  // Cancel upload
  cancelUpload: (fileId: string) => void;
}
```

---

## 15. Notification Management (Mute/Pin/Archive)

### 15.1 Concept

Per-user conversation settings: mute, pin to top, archive.

### 15.2 ACS Support

> **ACS KHÔNG hỗ trợ per-user conversation settings.**
> 
> Backend manages all notification preferences.

### 15.3 Data Model

```ts
interface ConversationSettings {
  conversationId: string;
  userId: string;
  
  // Mute
  isMuted: boolean;
  muteUntil?: Date;            // null = muted forever, Date = muted until
  muteExceptMentions: boolean; // Still notify for @mentions
  
  // Pin
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedOrder?: number;        // Sort order for multiple pins
  
  // Archive
  isArchived: boolean;
  archivedAt?: Date;
  
  // Notification tone
  notificationTone?: string;   // Custom notification sound
  
  // Custom
  customBackground?: string;   // Custom chat wallpaper
}
```

### 15.4 Backend API

```
PATCH /api/conversations/{conversationId}/settings
Body: Partial<ConversationSettings>
Response: { settings: ConversationSettings }

GET /api/conversations/{conversationId}/settings
Response: { settings: ConversationSettings }
```

### 15.5 Mute Logic

```
New message arrives
        ↓
Check conversation settings
        ↓
Is conversation muted?
  ├── NO → Normal notification
  └── YES →
        ├── muteExceptMentions = true AND user is mentioned → Notify
        ├── muteUntil expired → Unmute, normal notification
        └── Otherwise → Suppress notification, update badge only
```

### 15.6 Archive Logic

```
User archives conversation
        ↓
Move to "Archived" section (separate from main list)
        ↓
New message in archived conversation:
  - Automatically unarchive
  - Move back to main list
  - Show notification (unless muted)
```

### 15.7 API

```ts
interface UseConversationSettingsReturn {
  settings: ConversationSettings | null;
  loading: boolean;
  
  // Mute
  muteConversation: (options?: { until?: Date; exceptMentions?: boolean }) => Promise<void>;
  unmuteConversation: () => Promise<void>;
  
  // Pin
  pinConversation: () => Promise<void>;
  unpinConversation: () => Promise<void>;
  
  // Archive
  archiveConversation: () => Promise<void>;
  unarchiveConversation: () => Promise<void>;
  
  // Custom
  updateSettings: (updates: Partial<ConversationSettings>) => Promise<void>;
}
```

---

## 16. Multi-device Sync

### 16.1 Concept

User sử dụng trên nhiều device (PC, mobile, tablet). Tất cả state phải đồng bộ.

### 16.2 Sync Strategy

| Data | Sync Mechanism |
|---|---|
| Messages | ACS realtime events (native) |
| Unread count | Backend persistence + ACS events |
| Read position | Backend persistence (last read message per conversation) |
| Conversation list | Backend API + ACS events |
| Settings (mute/pin/archive) | Backend persistence |
| Presence | Backend WebSocket |
| Call state | ACS Calling SDK (native) |

### 16.3 Read Position Sync

```
Device A reads message #50 in conversation X
        ↓
Library sends read receipt (ACS) + update Backend:
  POST /api/conversations/{id}/read-position
  Body: { lastReadMessageId: '50' }
        ↓
Device B opens same conversation
        ↓
Library loads read position from Backend
        ↓
Calculate unread from lastReadMessageId → show correct badge
```

### 16.4 Backend API

```
POST /api/conversations/{conversationId}/read-position
Body: { lastReadMessageId: string, lastReadAt: string }

GET /api/users/me/sync-state
Response: {
  conversations: Array<{
    id: string;
    lastReadMessageId: string;
    lastReadAt: string;
    unreadCount: number;
    settings: ConversationSettings;
  }>
}
```

---

## 17. Message Quote & Rich Text Formatting

### 17.1 Rich Text Support

ACS hỗ trợ `html` message type, cho phép format text:

```ts
// Supported formatting
interface TextFormatting {
  bold: boolean;       // <strong>text</strong>
  italic: boolean;     // <em>text</em>
  underline: boolean;  // <u>text</u>
  strikethrough: boolean; // <del>text</del>
  code: boolean;       // <code>text</code>
  codeBlock: boolean;  // <pre><code>text</code></pre>
  bulletList: boolean;  // <ul><li>text</li></ul>
  numberedList: boolean; // <ol><li>text</li></ol>
  link: boolean;       // <a href="url">text</a>
}
```

### 17.2 Rich Text Editor

```tsx
// RichTextInput — Enhanced MessageInput with formatting
interface RichTextInputProps extends MessageInputProps {
  enableFormatting?: boolean;
  renderToolbar?: () => ReactNode;
}

// Toolbar:
// [B] [I] [U] [S] [Code] [Link] [List] [Numbered]
```

### 17.3 Message Rendering

```ts
// Sanitize HTML before rendering
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'b', 'i', 'em', 'strong', 'u', 'del', 'a', 
  'p', 'br', 'ul', 'ol', 'li', 
  'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];
```

---

## 18. Contact / User Search & Directory

### 18.1 Concept

Tìm kiếm user để tạo conversation mới, add vào group, hoặc xem profile.

### 18.2 Backend API

```
GET /api/users/search?q=keyword&page=1&pageSize=20
Response: {
  users: Array<{
    userId: string;
    displayName: string;
    email?: string;
    avatarUrl?: string;
    department?: string;
    isOnline: boolean;
  }>;
  totalCount: number;
  hasMore: boolean;
}
```

### 18.3 API

```ts
interface UseUserSearchReturn {
  results: SearchedUser[];
  loading: boolean;
  hasMore: boolean;
  
  searchUsers: (query: string) => Promise<void>;
  searchMore: () => Promise<void>;
  clearSearch: () => void;
}
```

---

## 19. Link Preview

### 19.1 Concept

Khi user gửi tin nhắn chứa URL, hiển thị preview card (title, description, image) của URL đó.

### 19.2 Architecture

```
User types/pastes URL in message
        ↓
Detect URL pattern (regex)
        ↓
Call Backend: POST /api/link-preview
Body: { url: 'https://example.com/article' }
        ↓
Backend fetches URL, extracts Open Graph/meta tags:
  { title, description, imageUrl, siteName, favicon }
        ↓
Show preview in message compose area
        ↓
On send, include in metadata:
  metadata: {
    linkPreview: JSON.stringify({
      url: 'https://example.com/article',
      title: 'Article Title',
      description: 'Article description...',
      imageUrl: 'https://example.com/og-image.jpg',
      siteName: 'Example.com',
      favicon: 'https://example.com/favicon.ico',
    })
  }
```

### 19.3 Data Model

```ts
interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  favicon?: string;
}
```

### 19.4 UI Component

```tsx
// LinkPreviewCard
interface LinkPreviewCardProps {
  preview: LinkPreview;
  onClick?: () => void;  // Open URL in new tab
}

// Renders:
┌──────────────────────────────────┐
│ ┌────────┐                      │
│ │ Image  │  Article Title       │
│ │        │  Article description │
│ └────────┘  example.com         │
└──────────────────────────────────┘
```

---

## 20. Updated Architecture — Phase 2

```
React Application
       │
       │  <ChatProvider config={...}>
       │    <CallProvider config={...}>
       │      <ChatContainer />
       │    </CallProvider>
       │  </ChatProvider>
       │
       ▼
┌────────────────────────────────────────────────────┐
│              React Chat Library (Phase 2)          │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  UI Components                                │  │
│  │  Phase 1: ChatContainer, MessageList, etc.    │  │
│  │  Phase 2: CallScreen, VoiceRecorder,          │  │
│  │           StickerPicker, MentionInput,         │  │
│  │           ReactionPicker, SearchOverlay,       │  │
│  │           ForwardDialog, PinnedBanner,         │  │
│  │           MediaLightbox, PresenceDot, etc.     │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐  │
│  │  React Hooks                                  │  │
│  │  Phase 1: useChat, useMessages, etc.          │  │
│  │  Phase 2: useCall, useMentions, useReactions, │  │
│  │           useReply, useForward, usePinned,     │  │
│  │           useVoiceMessage, useSearch,           │  │
│  │           useStickers, usePresence,             │  │
│  │           useMedia, useScreenShare,             │  │
│  │           useConversationSettings, etc.         │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐  │
│  │  State (Zustand)                              │  │
│  │  Phase 1: chatStore, messageStore, etc.       │  │
│  │  Phase 2: callStore, reactionStore,           │  │
│  │           presenceStore, searchStore,          │  │
│  │           mediaStore, settingsStore            │  │
│  └──────────────────┬───────────────────────────┘  │
│                     │                               │
│  ┌──────────────────▼───────────────────────────┐  │
│  │  Services                                     │  │
│  │  Phase 1: chatService, messageService, etc.   │  │
│  │  Phase 2: callService, reactionService,       │  │
│  │           presenceService, searchService,      │  │
│  │           mediaService, linkPreviewService     │  │
│  └───────┬──────────────────────┬───────────────┘  │
│          │                      │                   │
│  ┌───────▼────────┐  ┌─────────▼───────────────┐  │
│  │  ACS Chat       │  │  ACS Calling Adapter    │  │
│  │  Adapter         │  │  CallClient, CallAgent, │  │
│  │  (Phase 1)       │  │  Call, VideoStream      │  │
│  └───────┬─────────┘  └─────────┬──────────────┘  │
│          │                      │                   │
└──────────┼──────────────────────┼───────────────────┘
           │                      │
  ┌────────▼────────┐  ┌─────────▼──────────┐
  │ Application     │  │ Azure Communication │
  │ Backend         │  │ Services            │
  │                 │  │                     │
  │ + Reactions API │  │ - Chat SDK          │
  │ + Pin API       │  │ - Calling SDK       │
  │ + Search API    │  │ - TURN/STUN         │
  │ + Presence      │  │ - WebSocket         │
  │ + Stickers      │  │ - Media Relay       │
  │ + Link Preview  │  │                     │
  │ + Media Storage │  │                     │
  └─────────────────┘  └────────────────────┘
```

---

## 21. ACS Package Dependencies — Phase 2

| Package | Purpose | Phase |
|---|---|---|
| `@azure/communication-chat` (^1.6.0) | Chat SDK | Phase 1 |
| `@azure/communication-common` (^2.0.0) | Common types, credentials | Phase 1 + 2 |
| `@azure/communication-calling` (^1.28.0) | **Calling SDK — Audio/Video** | **Phase 2** |
| `@azure/communication-react` (^1.20.0) | **Optional: Pre-built calling UI composites** | **Phase 2 (optional)** |

### Token Scope Update

```ts
// Phase 1
CommunicationIdentityClient.getToken(user, ['chat']);

// Phase 2
CommunicationIdentityClient.getToken(user, ['chat', 'voip']);
```

---

## 22. Updated Directory Structure — Phase 2

```
src/
├── components/
│   ├── ... (Phase 1 components)
│   │
│   ├── Mention/                    # NEW
│   │   ├── MentionInput.tsx        # @mention autocomplete in message input
│   │   └── MentionBadge.tsx        # Inline mention highlight
│   │
│   ├── Reaction/                   # NEW
│   │   ├── ReactionPicker.tsx      # Emoji picker for reactions
│   │   ├── ReactionBadge.tsx       # Reaction counts on messages
│   │   └── ReactionDetail.tsx      # Who reacted modal
│   │
│   ├── Reply/                      # NEW
│   │   ├── ReplyQuote.tsx          # Quoted message in reply
│   │   └── ReplyBar.tsx            # Reply preview above input
│   │
│   ├── Forward/                    # NEW
│   │   └── ForwardDialog.tsx       # Forward target selection dialog
│   │
│   ├── Pin/                        # NEW
│   │   └── PinnedMessageBanner.tsx # Pinned messages at top
│   │
│   ├── Call/                       # NEW
│   │   ├── CallProvider.tsx        # Calling context provider
│   │   ├── CallScreen.tsx          # Full screen call UI
│   │   ├── IncomingCallDialog.tsx  # Incoming call popup
│   │   ├── CallingControls.tsx     # Call control buttons
│   │   ├── VideoGallery.tsx        # Multi-participant video grid
│   │   ├── LocalVideoPreview.tsx   # Self video preview
│   │   └── DeviceSettings.tsx      # Camera/mic/speaker selection
│   │
│   ├── VoiceMessage/               # NEW
│   │   ├── VoiceRecorder.tsx       # Recording button + waveform
│   │   └── VoiceMessagePlayer.tsx  # Playback component
│   │
│   ├── Search/                     # NEW
│   │   ├── SearchOverlay.tsx       # Full search experience
│   │   └── SearchBar.tsx           # Inline search
│   │
│   ├── Sticker/                    # NEW
│   │   └── StickerGifPicker.tsx    # Sticker/GIF picker
│   │
│   ├── Presence/                   # NEW
│   │   ├── PresenceDot.tsx         # Online status indicator
│   │   └── LastSeen.tsx            # Last active time
│   │
│   ├── Media/                      # NEW
│   │   ├── ImageMessage.tsx        # Inline image preview
│   │   ├── VideoMessage.tsx        # Inline video preview
│   │   ├── MediaLightbox.tsx       # Fullscreen media viewer
│   │   └── MediaUploadPreview.tsx  # Upload preview before send
│   │
│   ├── LinkPreview/                # NEW
│   │   └── LinkPreviewCard.tsx     # URL preview card
│   │
│   └── RichText/                   # NEW
│       └── RichTextInput.tsx       # Formatting toolbar
│
├── hooks/
│   ├── ... (Phase 1 hooks)
│   ├── useMentions.ts              # NEW
│   ├── useReactions.ts             # NEW
│   ├── useReply.ts                 # NEW
│   ├── useForward.ts               # NEW
│   ├── usePinnedMessages.ts        # NEW
│   ├── useCall.ts                  # NEW
│   ├── useCallAgent.ts             # NEW
│   ├── useDevices.ts               # NEW
│   ├── useScreenShare.ts           # NEW
│   ├── useVoiceMessage.ts          # NEW
│   ├── useSearch.ts                # NEW
│   ├── useStickers.ts              # NEW
│   ├── useGifs.ts                  # NEW
│   ├── usePresence.ts              # NEW
│   ├── useMedia.ts                 # NEW
│   ├── useConversationSettings.ts  # NEW
│   ├── useLinkPreview.ts           # NEW
│   └── useUserSearch.ts            # NEW
│
├── store/
│   ├── ... (Phase 1 stores)
│   ├── callStore.ts                # NEW — Call state
│   ├── reactionStore.ts            # NEW — Reactions per message
│   ├── presenceStore.ts            # NEW — User presence
│   ├── searchStore.ts              # NEW — Search results
│   ├── mediaStore.ts               # NEW — Upload progress, media cache
│   └── settingsStore.ts            # NEW — Per-conversation settings
│
├── services/
│   ├── ... (Phase 1 services)
│   ├── callService.ts              # NEW
│   ├── reactionService.ts          # NEW
│   ├── presenceService.ts          # NEW
│   ├── searchService.ts            # NEW
│   ├── mediaService.ts             # NEW
│   ├── stickerService.ts           # NEW
│   ├── linkPreviewService.ts       # NEW
│   └── voiceMessageService.ts      # NEW
│
├── adapters/
│   ├── acs/                        # Phase 1
│   │   ├── acsClientAdapter.ts
│   │   ├── acsThreadAdapter.ts
│   │   ├── acsEventAdapter.ts
│   │   └── acsMappers.ts
│   └── calling/                    # NEW
│       ├── callingAdapter.ts       # ACS Calling SDK wrapper
│       ├── callingEventAdapter.ts  # Call event normalization
│       └── callingMappers.ts       # Call type mappers
│
├── models/
│   ├── ... (Phase 1 models)
│   ├── Call.ts                     # NEW
│   ├── Reaction.ts                 # NEW
│   ├── Presence.ts                 # NEW
│   ├── Sticker.ts                  # NEW
│   └── Media.ts                    # NEW
│
├── types/
│   ├── ... (Phase 1 types)
│   ├── call.types.ts               # NEW
│   ├── reaction.types.ts           # NEW
│   ├── presence.types.ts           # NEW
│   ├── search.types.ts             # NEW
│   ├── media.types.ts              # NEW
│   ├── sticker.types.ts            # NEW
│   ├── mention.types.ts            # NEW
│   └── link-preview.types.ts       # NEW
│
└── index.ts                        # Updated exports
```

---

## 23. Updated State Management — Phase 2

### 23.1 New Stores

```ts
// Call Store
interface CallStore {
  currentCall: CallInfo | null;
  incomingCall: IncomingCallInfo | null;
  callHistory: CallInfo[];
  callAgent: CallAgent | null;
  devices: DeviceInfo;
  
  // Actions
  setCurrentCall: (call: CallInfo | null) => void;
  setIncomingCall: (call: IncomingCallInfo | null) => void;
  updateCallState: (state: CallState) => void;
  updateParticipant: (userId: string, updates: Partial<CallParticipant>) => void;
  addCallToHistory: (call: CallInfo) => void;
}

// Reaction Store
interface ReactionStore {
  reactionsByMessage: Record<string, MessageReactionSummary>;
  
  // Actions
  setReactions: (messageId: string, reactions: MessageReactionSummary) => void;
  addReaction: (messageId: string, userId: string, reaction: ReactionType) => void;
  removeReaction: (messageId: string, userId: string, reaction: ReactionType) => void;
}

// Presence Store
interface PresenceStore {
  presences: Record<string, UserPresence>;
  myPresence: UserPresence;
  
  // Actions
  updatePresence: (userId: string, presence: Partial<UserPresence>) => void;
  setMyPresence: (presence: Partial<UserPresence>) => void;
  batchUpdatePresences: (presences: Record<string, UserPresence>) => void;
}

// Search Store
interface SearchStore {
  query: string;
  results: SearchResult[];
  totalCount: number;
  loading: boolean;
  hasMore: boolean;
  error: ChatError | null;
  
  // Actions
  setResults: (results: SearchResult[], totalCount: number, hasMore: boolean) => void;
  appendResults: (results: SearchResult[]) => void;
  clearSearch: () => void;
}

// Settings Store
interface SettingsStore {
  settingsByConversation: Record<string, ConversationSettings>;
  
  // Actions
  setSettings: (conversationId: string, settings: ConversationSettings) => void;
  updateSettings: (conversationId: string, updates: Partial<ConversationSettings>) => void;
}

// Media Store
interface MediaStore {
  uploadProgress: Record<string, number>;  // fileId → %
  mediaCache: Record<string, MediaAttachment>;
  
  // Actions
  setUploadProgress: (fileId: string, progress: number) => void;
  removeUploadProgress: (fileId: string) => void;
  cacheMedia: (fileId: string, media: MediaAttachment) => void;
}
```

---

## 24. Updated Public API — Phase 2

### 24.1 New Exports

```ts
// src/index.ts — Phase 2 additions

// ===== Components =====
export { CallProvider } from './components/Call/CallProvider';
export { CallScreen } from './components/Call/CallScreen';
export { IncomingCallDialog } from './components/Call/IncomingCallDialog';
export { CallingControls } from './components/Call/CallingControls';
export { VideoGallery } from './components/Call/VideoGallery';
export { MentionInput } from './components/Mention/MentionInput';
export { MentionBadge } from './components/Mention/MentionBadge';
export { ReactionPicker } from './components/Reaction/ReactionPicker';
export { ReactionBadge } from './components/Reaction/ReactionBadge';
export { ReplyQuote } from './components/Reply/ReplyQuote';
export { ForwardDialog } from './components/Forward/ForwardDialog';
export { PinnedMessageBanner } from './components/Pin/PinnedMessageBanner';
export { VoiceRecorder } from './components/VoiceMessage/VoiceRecorder';
export { VoiceMessagePlayer } from './components/VoiceMessage/VoiceMessagePlayer';
export { SearchOverlay } from './components/Search/SearchOverlay';
export { StickerGifPicker } from './components/Sticker/StickerGifPicker';
export { PresenceDot } from './components/Presence/PresenceDot';
export { ImageMessage } from './components/Media/ImageMessage';
export { VideoMessage } from './components/Media/VideoMessage';
export { MediaLightbox } from './components/Media/MediaLightbox';
export { LinkPreviewCard } from './components/LinkPreview/LinkPreviewCard';
export { RichTextInput } from './components/RichText/RichTextInput';

// ===== Hooks =====
export { useCall } from './hooks/useCall';
export { useCallAgent } from './hooks/useCallAgent';
export { useDevices } from './hooks/useDevices';
export { useScreenShare } from './hooks/useScreenShare';
export { useMentions } from './hooks/useMentions';
export { useReactions } from './hooks/useReactions';
export { useReply } from './hooks/useReply';
export { useForward } from './hooks/useForward';
export { usePinnedMessages } from './hooks/usePinnedMessages';
export { useVoiceMessage } from './hooks/useVoiceMessage';
export { useSearch } from './hooks/useSearch';
export { useStickers } from './hooks/useStickers';
export { useGifs } from './hooks/useGifs';
export { usePresence } from './hooks/usePresence';
export { useMedia } from './hooks/useMedia';
export { useConversationSettings } from './hooks/useConversationSettings';
export { useLinkPreview } from './hooks/useLinkPreview';
export { useUserSearch } from './hooks/useUserSearch';

// ===== Types =====
export type {
  // Call
  CallInfo, CallState, CallType, CallDirection, CallMode,
  CallParticipant, CallControls, CallConfig,
  IncomingCallInfo, DeviceInfo,
  
  // Mention
  MentionData,
  
  // Reaction
  ReactionType, MessageReaction, MessageReactionSummary,
  
  // Reply & Forward
  ReplyToData, ForwardedFromData,
  
  // Pin
  PinnedMessage,
  
  // Voice Message
  VoiceMessageData,
  
  // Search
  SearchResult, SearchResponse, SearchOptions,
  
  // Sticker & GIF
  StickerPack, Sticker, GifResult,
  
  // Presence
  PresenceStatus, UserPresence,
  
  // Media
  MediaAttachment, LinkPreview,
  
  // Settings
  ConversationSettings,
} from './types';
```

---

## 25. Implementation Phases — Phase 2

### Sub-phase 2.1 — Message Enhancements (2-3 tuần)

**Priority**: High — Builds on existing message system

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.1.1 — Mention types + metadata parsing | 2 days | Phase 1 message system |
| 2.1.2 — MentionInput component (autocomplete) | 3 days | Phase 1 MessageInput |
| 2.1.3 — MentionBadge + rendering | 1 day | Task 2.1.1 |
| 2.1.4 — Reply types + metadata | 1 day | Phase 1 message system |
| 2.1.5 — ReplyBar + ReplyQuote components | 2 days | Task 2.1.4 |
| 2.1.6 — Scroll-to-reply-original logic | 2 days | Task 2.1.5 |
| 2.1.7 — Forward types + ForwardDialog | 2 days | Phase 1 conversation system |
| 2.1.8 — Link preview service + LinkPreviewCard | 2 days | Backend API |
| 2.1.9 — Rich text input (formatting toolbar) | 3 days | Phase 1 MessageInput |
| 2.1.10 — Tests for all message enhancements | 2 days | All above |

---

### Sub-phase 2.2 — Reactions & Pins (1-2 tuần)

**Priority**: High

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.2.1 — Reaction types + store | 1 day | — |
| 2.2.2 — Reaction service (Backend API integration) | 2 days | Backend reactions API |
| 2.2.3 — ReactionPicker + ReactionBadge components | 2 days | Task 2.2.1 |
| 2.2.4 — Reaction realtime sync (Backend WebSocket) | 2 days | Task 2.2.2 |
| 2.2.5 — Pin message types + store | 1 day | — |
| 2.2.6 — Pin service (Backend API integration) | 1 day | Backend pins API |
| 2.2.7 — PinnedMessageBanner component | 1 day | Task 2.2.5 |
| 2.2.8 — Tests | 1 day | All above |

---

### Sub-phase 2.3 — Audio/Video Calling (3-4 tuần)

**Priority**: Critical — Major feature

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.3.1 — Calling types + models | 2 days | — |
| 2.3.2 — ACS Calling adapter (CallClient, CallAgent) | 3 days | `@azure/communication-calling` |
| 2.3.3 — Calling event adapter | 2 days | Task 2.3.2 |
| 2.3.4 — Call store (Zustand) | 2 days | Task 2.3.1 |
| 2.3.5 — Call service (start/end/accept/decline) | 3 days | Tasks 2.3.2-4 |
| 2.3.6 — Device management service + hook | 2 days | Task 2.3.2 |
| 2.3.7 — CallProvider component | 2 days | Task 2.3.5 |
| 2.3.8 — IncomingCallDialog component | 2 days | Task 2.3.7 |
| 2.3.9 — CallScreen component (audio) | 2 days | Task 2.3.7 |
| 2.3.10 — CallScreen component (video) | 3 days | Task 2.3.9 |
| 2.3.11 — VideoGallery (multi-participant) | 3 days | Task 2.3.10 |
| 2.3.12 — CallingControls (mute/video/hangup) | 2 days | Tasks 2.3.9-10 |
| 2.3.13 — Screen sharing integration | 2 days | Task 2.3.10 |
| 2.3.14 — DeviceSettings component | 1 day | Task 2.3.6 |
| 2.3.15 — Call history (system messages) | 1 day | Phase 1 message system |
| 2.3.16 — Group call support | 2 days | Tasks 2.3.5, 2.3.11 |
| 2.3.17 — Tests | 3 days | All above |

---

### Sub-phase 2.4 — Voice Message & Media (2-3 tuần)

**Priority**: Medium-High

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.4.1 — Voice message types | 1 day | — |
| 2.4.2 — VoiceRecorder component (MediaRecorder API) | 3 days | — |
| 2.4.3 — VoiceMessagePlayer component | 2 days | Task 2.4.1 |
| 2.4.4 — Voice message service (record → upload → send) | 2 days | Backend file API |
| 2.4.5 — Media types + MediaAttachment model | 1 day | — |
| 2.4.6 — Media upload service (multi-file, progress) | 2 days | Backend file API |
| 2.4.7 — ImageMessage + VideoMessage components | 2 days | Task 2.4.5 |
| 2.4.8 — MediaLightbox (fullscreen viewer) | 3 days | Task 2.4.7 |
| 2.4.9 — MediaUploadPreview (before send) | 2 days | Task 2.4.6 |
| 2.4.10 — Tests | 2 days | All above |

---

### Sub-phase 2.5 — Search & Stickers (1-2 tuần)

**Priority**: Medium

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.5.1 — Search types + store | 1 day | — |
| 2.5.2 — Search service (Backend API integration) | 2 days | Backend search API |
| 2.5.3 — SearchOverlay + SearchBar components | 3 days | Task 2.5.2 |
| 2.5.4 — Navigate-to-search-result (scroll to message) | 2 days | Task 2.5.3 |
| 2.5.5 — Sticker types + StickerService | 1 day | Backend sticker API |
| 2.5.6 — GIF service (GIPHY/Tenor integration) | 1 day | GIF provider API key |
| 2.5.7 — StickerGifPicker component | 2 days | Tasks 2.5.5-6 |
| 2.5.8 — Tests | 1 day | All above |

---

### Sub-phase 2.6 — Presence & Settings (1-2 tuần)

**Priority**: Medium

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.6.1 — Presence types + store | 1 day | — |
| 2.6.2 — Presence service (Backend WebSocket/SignalR) | 3 days | Backend presence service |
| 2.6.3 — PresenceDot + LastSeen components | 1 day | Task 2.6.1 |
| 2.6.4 — Conversation settings types + store | 1 day | — |
| 2.6.5 — Settings service (mute/pin/archive) | 2 days | Backend settings API |
| 2.6.6 — Settings UI in conversation header | 2 days | Task 2.6.5 |
| 2.6.7 — Multi-device sync service | 2 days | Backend sync API |
| 2.6.8 — User search service + UserSearchDialog | 2 days | Backend user API |
| 2.6.9 — Tests | 1 day | All above |

---

### Sub-phase 2.7 — Polish & Integration (1-2 tuần)

**Priority**: High

| Task | Estimated Effort | Dependencies |
|---|---|---|
| 2.7.1 — Update MessageInput (integrate mention, reply, voice, sticker, media) | 3 days | All sub-phases |
| 2.7.2 — Update MessageItem (integrate reaction, reply quote, forward, media preview) | 3 days | All sub-phases |
| 2.7.3 — Update ConversationList (integrate presence, settings badges) | 2 days | Sub-phase 2.6 |
| 2.7.4 — Update ChatContainer (integrate call button, search, pinned) | 2 days | All sub-phases |
| 2.7.5 — CSS Variables for all Phase 2 components | 2 days | — |
| 2.7.6 — Update public exports (index.ts) | 1 day | — |
| 2.7.7 — Integration tests | 3 days | All above |
| 2.7.8 — Performance testing & optimization | 2 days | All above |
| 2.7.9 — Documentation update | 2 days | All above |

---

## 26. Testing Strategy — Phase 2

### 26.1 Unit Tests

| Target | What to Test |
|---|---|
| Mention parsing/serialization | Parse from metadata, serialize to metadata, offset calculation |
| Reaction aggregation | Count, has-reacted, merge reactions |
| Reply metadata parsing | Parse replyTo, handle missing fields |
| Forward metadata | Serialize/deserialize forwarded data |
| Call state machine | State transitions, error states |
| Voice message waveform | Generate waveform from audio data |
| Search result highlighting | Keyword highlighting in content |
| Link preview URL detection | Regex URL matching |
| Presence status transitions | Online → away → offline logic |

### 26.2 Integration Tests

| Target | What to Test |
|---|---|
| Call flow | Start → connect → control → end |
| Reaction sync | Add/remove → realtime update |
| Voice message | Record → upload → send → play |
| Search | Query → results → navigate to message |
| Mention in group | Type @ → select → send → highlight |
| Pin message | Pin → banner → unpin |
| Forward message | Select → choose target → forward |

### 26.3 E2E Tests

```
Extended E2E flows:
1. Send message with @mention → verify highlight
2. Add reaction → verify count → remove reaction
3. Reply to message → verify quote → click to scroll
4. Forward message → verify in target conversation
5. Start audio call → accept → mute → hangup
6. Start video call → toggle camera → screen share → end
7. Record voice message → send → playback
8. Search "keyword" → click result → verify scroll
9. Send sticker → verify render
10. Pin message → verify banner → unpin
11. Mute conversation → verify no notification
12. Check presence → verify online dot
```

---

## 27. Definition of Done — Phase 2

### Mentions
- [ ] @mention autocomplete in MessageInput
- [ ] Mention parsing from message metadata
- [ ] Mention highlight rendering (MentionBadge)
- [ ] @all / @everyone support
- [ ] Mention notification priority

### Reactions
- [ ] ReactionPicker (6 default + custom emoji)
- [ ] Toggle reaction on message
- [ ] ReactionBadge with counts
- [ ] Reaction detail (who reacted)
- [ ] Realtime reaction sync

### Reply & Forward
- [ ] Reply bar above input
- [ ] Reply quote in message
- [ ] Scroll to original message
- [ ] Forward dialog (multi-select conversations)
- [ ] Forward indicator on message

### Pin Message
- [ ] Pin/unpin message (permission-gated)
- [ ] Pinned message banner
- [ ] Click to scroll to pinned message

### Audio/Video Calling
- [ ] Start 1-1 audio call
- [ ] Start 1-1 video call
- [ ] Accept/decline incoming call
- [ ] Call controls (mute, video toggle, hangup)
- [ ] Group call support
- [ ] Screen sharing
- [ ] Device management (camera/mic/speaker selection)
- [ ] Call history system messages
- [ ] Video gallery (multi-participant layout)
- [ ] Hold/resume call

### Voice Message
- [ ] Record voice message (waveform visualization)
- [ ] Upload and send voice message
- [ ] Voice message playback with progress
- [ ] Max duration limit

### Search
- [ ] Global message search
- [ ] Conversation-scoped search
- [ ] Search result highlighting
- [ ] Navigate to search result

### Stickers & GIFs
- [ ] Sticker pack browser
- [ ] Send sticker
- [ ] GIF search (GIPHY/Tenor)
- [ ] Send GIF
- [ ] Sticker/GIF rendering in message

### Online Presence
- [ ] Presence indicator (online/away/offline)
- [ ] Last seen time
- [ ] Auto status transitions
- [ ] Manual status setting

### Cloud Media
- [ ] Image upload with thumbnail generation
- [ ] Video upload with preview
- [ ] Inline media preview in messages
- [ ] Full-screen media viewer (lightbox)
- [ ] Multi-image upload
- [ ] Upload progress indicator

### Notification Management
- [ ] Mute conversation (with/without mentions)
- [ ] Pin conversation to top
- [ ] Archive/unarchive conversation
- [ ] Per-conversation settings

### Rich Text & Link Preview
- [ ] Rich text formatting toolbar
- [ ] HTML message rendering (sanitized)
- [ ] Link detection and preview card
- [ ] Link preview in message

### Multi-device Sync
- [ ] Unread count sync across devices
- [ ] Read position sync
- [ ] Settings sync
- [ ] Conversation state sync

### Quality
- [ ] Unit tests for all Phase 2 features
- [ ] Integration tests for critical flows
- [ ] E2E tests for calling and messaging enhancements
- [ ] Updated documentation (README, API reference)
- [ ] CSS variables for all new components
- [ ] Performance optimization for video calls
- [ ] Accessibility for calling UI

---

## 28. Open Questions — Phase 2

### Must Decide Before Implementation

1. **GIF Provider: GIPHY hay Tenor?**
   - GIPHY: Phổ biến nhất, free tier có watermark.
   - Tenor: Owned by Google, tích hợp tốt, free.
   - **Recommendation**: Tenor (free, no watermark).

2. **ACS Calling SDK vs ACS UI Library (composites)?**
   - Calling SDK: Full control, more effort.
   - UI Library composites: Pre-built, less customizable.
   - **Recommendation**: Calling SDK cho core logic + custom UI components (phù hợp với library architecture).

3. **Presence service: Backend custom vs third-party?**
   - Custom SignalR/WebSocket hub.
   - Azure SignalR Service.
   - **Recommendation**: Azure SignalR Service (managed, scalable).

4. **Sticker storage: CDN hay Azure Blob?**
   - CDN: Fast delivery, global edge.
   - Azure Blob + Azure CDN: Integrated.
   - **Recommendation**: Azure Blob Storage + Azure CDN endpoint.

5. **Rich text editor: Build from scratch vs third-party?**
   - Custom: Full control, minimal dependency.
   - Tiptap/Slate.js: Full-featured, more weight.
   - **Recommendation**: Start with simple toolbar (bold/italic/link), add Tiptap later if needed.

6. **Voice message format: WebM/Opus vs MP4/AAC?**
   - WebM/Opus: Browser native (MediaRecorder default), smaller.
   - MP4/AAC: Better mobile playback compatibility.
   - **Recommendation**: Record as WebM/Opus, Backend transcodes to MP4/AAC for storage.

7. **Backend realtime channel for non-ACS events (reactions, pins, presence)?**
   - Option A: Reuse ACS message metadata (hack — not recommended for high-frequency events).
   - Option B: Separate SignalR/WebSocket connection for app events.
   - **Recommendation**: Option B — Separate SignalR hub for app-specific events.

8. **Video call layout: Gallery view vs Speaker view?**
   - Gallery: All participants equal grid (Zoom-like).
   - Speaker: Dominant speaker large, others small.
   - **Recommendation**: Both — default gallery, switch to speaker when someone is speaking.

9. **Call recording?**
   - ACS supports server-side recording (requires additional setup).
   - **Decision needed**: Include in Phase 2 or defer to Phase 3?
   - **Recommendation**: Defer to Phase 3.

10. **Emoji reactions: Fixed set (6) vs full emoji picker?**
    - Fixed: 👍❤️😂😮😢😡 (like Zalo/Facebook Messenger).
    - Full: Full emoji keyboard.
    - **Recommendation**: Fixed 6 as quick reactions + "+" button opens full emoji picker.
