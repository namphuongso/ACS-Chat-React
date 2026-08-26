/**
 * WebSocket Chat Protocol Type Definitions
 * Based on App-wide WebSocket Chat specification
 */

/* -------------------------------------------------------------------------- */
/*                         Client -> Server Messages                          */
/* -------------------------------------------------------------------------- */

export interface WsClientHeartbeatMessage {
  type: 'heartbeat';
  lastVisibleMessageId?: string;
}

export interface WsClientEnterRoomMessage {
  type: 'enter_room';
  roomId: string;
  lastVisibleMessageId?: string;
}

export interface WsClientLeaveRoomMessage {
  type: 'leave_room';
  lastVisibleMessageId?: string;
}

export interface WsClientReadMessage {
  type: 'read';
  lastVisibleMessageId: string;
}

export type WsClientMessage =
  | WsClientHeartbeatMessage
  | WsClientEnterRoomMessage
  | WsClientLeaveRoomMessage
  | WsClientReadMessage;

/* -------------------------------------------------------------------------- */
/*                         Server -> Client Messages                          */
/* -------------------------------------------------------------------------- */

export interface WsServerConnectedMessage {
  type: 'connected';
  sessionId: string;
  heartbeatIntervalSeconds: number;
  heartbeatTimeoutSeconds: number;
  [key: string]: unknown;
}

export interface WsServerEnterRoomAckMessage {
  type: 'enter_room_ack';
  [key: string]: unknown;
}

export interface WsServerLeaveAckMessage {
  type: 'leave_ack';
  [key: string]: unknown;
}

export interface WsServerHeartbeatAckMessage {
  type: 'heartbeat_ack';
  [key: string]: unknown;
}

export interface WsServerReadAckMessage {
  type: 'read_ack';
  readAtUtc?: string;
  updated?: boolean;
  [key: string]: unknown;
}

export type WsErrorCode =
  | 'MESSAGE_TYPE_REQUIRED'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'INVALID_JSON'
  | 'INVALID_MESSAGE_SIZE'
  | 'MESSAGE_TOO_LARGE_OR_FRAGMENTED'
  | 'ROOM_ID_REQUIRED'
  | 'NOT_ROOM_MEMBER'
  | 'NO_ACTIVE_ROOM'
  | 'MESSAGE_ID_REQUIRED'
  | 'MESSAGE_NOT_FOUND_OR_INVALID'
  | 'ROOM_MISMATCH';

export interface WsServerErrorMessage {
  type: 'error';
  errorCode: WsErrorCode | string;
  message: string;
  [key: string]: unknown;
}

/* -------------------------------------------------------------------------- */
/*                              Room Event Types                              */
/* -------------------------------------------------------------------------- */

export type WsRoomEventType =
  // Message events
  | 'NewMessage'
  | 'MessageUpdated'
  | 'MessageDeleted'
  | 'MessagePinned'
  | 'MessageUnpinned'
  | 'MessageReacted'
  | 'MessageReactionRemoved'
  // Room events
  | 'RoomCreated'
  | 'RoomUpdated'
  | 'RoomDisbanded'
  | 'RoomRoleChanged'
  | 'RoomOwnershipTransferred'
  | 'RoomPinned'
  | 'RoomUnpinned'
  // Member events
  | 'MemberJoined'
  | 'MemberLeft'
  | 'MemberRemoved';

/* -------------------------------------------------------------------------- */
/*                            Room Event Payloads                             */
/* -------------------------------------------------------------------------- */

export interface WsNewMessagePayload {
  messageId?: string;
  MessageId?: string;
  content?: string;
  Content?: string;
  createdDate?: string;
  CreatedDate?: string;
  editedDate?: string | null;
  EditedDate?: string | null;
  deletedDate?: string | null;
  DeletedDate?: string | null;
  isDeleted?: boolean;
  IsDeleted?: boolean;
  senderId?: string;
  SenderId?: string;
  senderName?: string;
  SenderName?: string;
  metadata?: Record<string, unknown>;
  Metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WsMessageUpdatedPayload {
  messageId?: string;
  MessageId?: string;
  content?: string;
  Content?: string;
  createdDate?: string;
  CreatedDate?: string;
  editedDate?: string | null;
  EditedDate?: string | null;
  deletedDate?: string | null;
  DeletedDate?: string | null;
  isDeleted?: boolean;
  IsDeleted?: boolean;
  senderId?: string;
  SenderId?: string;
  senderName?: string;
  SenderName?: string;
  metadata?: Record<string, unknown>;
  Metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface WsMessageDeletedPayload {
  messageId?: string;
  MessageId?: string;
  deletedAtUtc?: string;
  DeletedAtUtc?: string;
  deletedDate?: string;
  DeletedDate?: string;
  deletedBy?: string;
  DeletedBy?: string;
  [key: string]: unknown;
}

export interface WsMessagePinnedPayload {
  messageId?: string;
  MessageId?: string;
  actorId?: string;
  ActorId?: string;
  actorName?: string;
  ActorName?: string;
  actionAtUtc?: string;
  ActionAtUtc?: string;
  [key: string]: unknown;
}

export interface WsMessageUnpinnedPayload {
  messageId?: string;
  MessageId?: string;
  actorId?: string;
  ActorId?: string;
  actorName?: string;
  ActorName?: string;
  actionAtUtc?: string;
  ActionAtUtc?: string;
  [key: string]: unknown;
}

export interface WsMessageReactedPayload {
  messageId?: string;
  MessageId?: string;
  reactionCode?: string;
  ReactionCode?: string;
  actorId?: string;
  ActorId?: string;
  actorName?: string;
  ActorName?: string;
  [key: string]: unknown;
}

export interface WsMessageReactionRemovedPayload {
  messageId?: string;
  MessageId?: string;
  reactionCode?: null;
  ReactionCode?: null;
  actorId?: string;
  ActorId?: string;
  actorName?: string;
  ActorName?: string;
  [key: string]: unknown;
}

export interface WsRoomMemberItem {
  userId?: string;
  UserId?: string;
  contactName?: string;
  ContactName?: string;
  cui?: string;
  Cui?: string;
  avatarUrl?: string;
  AvatarUrl?: string;
  isAdmin?: boolean;
  IsAdmin?: boolean;
  [key: string]: unknown;
}

export interface WsRoomCreatedPayload {
  roomId?: string;
  RoomId?: string;
  roomName?: string;
  RoomName?: string;
  avatarUrl?: string;
  AvatarUrl?: string;
  roomType?: string;
  RoomType?: string;
  createdByUserId?: string;
  CreatedByUserId?: string;
  createdByName?: string;
  CreatedByName?: string;
  createdDate?: string;
  CreatedDate?: string;
  members?: WsRoomMemberItem[];
  Members?: WsRoomMemberItem[];
  [key: string]: unknown;
}

export interface WsRoomUpdatedPayload {
  roomId?: string;
  RoomId?: string;
  roomName?: string;
  RoomName?: string;
  avatarUrl?: string;
  AvatarUrl?: string;
  roomType?: string;
  RoomType?: string;
  [key: string]: unknown;
}

export interface WsRoomDisbandedPayload {
  roomId?: string;
  RoomId?: string;
  disbandedBy?: string;
  DisbandedBy?: string;
  disbandedAtUtc?: string;
  DisbandedAtUtc?: string;
  [key: string]: unknown;
}

export interface WsRoomRoleChangedPayload {
  roomId?: string;
  RoomId?: string;
  userId?: string;
  UserId?: string;
  isAdmin?: boolean;
  IsAdmin?: boolean;
  changedByUserId?: string;
  ChangedByUserId?: string;
  changedAtUtc?: string;
  ChangedAtUtc?: string;
  [key: string]: unknown;
}

export interface WsRoomOwnershipTransferredPayload {
  roomId?: string;
  RoomId?: string;
  fromUserId?: string;
  FromUserId?: string;
  toUserId?: string;
  ToUserId?: string;
  actionAtUtc?: string;
  ActionAtUtc?: string;
  [key: string]: unknown;
}

export type WsRoomPinnedPayload = null | Record<string, unknown>;
export type WsRoomUnpinnedPayload = null | Record<string, unknown>;

export interface WsMemberJoinedPayload {
  roomId?: string;
  RoomId?: string;
  addedUserIds?: string[];
  AddedUserIds?: string[];
  addedByUserId?: string;
  AddedByUserId?: string;
  addedByName?: string;
  AddedByName?: string;
  actionAtUtc?: string;
  ActionAtUtc?: string;
  [key: string]: unknown;
}

export interface WsMemberLeftPayload {
  roomId?: string;
  RoomId?: string;
  userId?: string;
  UserId?: string;
  leftAtUtc?: string;
  LeftAtUtc?: string;
  [key: string]: unknown;
}

export interface WsMemberRemovedPayload {
  roomId?: string;
  RoomId?: string;
  removedUserId?: string;
  RemovedUserId?: string;
  removedByUserId?: string;
  RemovedByUserId?: string;
  actionAtUtc?: string;
  ActionAtUtc?: string;
  [key: string]: unknown;
}

export interface WsServerRoomEventMessage<T = unknown> {
  type: 'room_event';
  success?: boolean;
  roomId?: string;
  RoomId?: string;
  eventType?: WsRoomEventType;
  EventType?: WsRoomEventType;
  payload: T;
  Payload?: T;
  serverTimeUtc?: string;
  ServerTimeUtc?: string;
  [key: string]: unknown;
}

export type WsServerMessage =
  | WsServerConnectedMessage
  | WsServerEnterRoomAckMessage
  | WsServerLeaveAckMessage
  | WsServerHeartbeatAckMessage
  | WsServerReadAckMessage
  | WsServerErrorMessage
  | WsServerRoomEventMessage;

/* -------------------------------------------------------------------------- */
/*                         Connection & Configuration                         */
/* -------------------------------------------------------------------------- */

export type WsConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';
