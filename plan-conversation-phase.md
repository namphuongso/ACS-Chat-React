# Plan: Conversation Phase (Backend APIs)

This document outlines the backend APIs required to fulfill the remaining conversation-related tasks in the `acs-chat` project.

## 1. 1-1 Conversation & Prevent Duplicate Direct Conversation

**Goal:** Create a 1-1 (direct) conversation between the current user and another user. The backend must enforce that only one direct conversation exists between any two given users.

**Endpoint:** `POST /api/conversations/direct`

**Description:** Creates a new 1-1 conversation. Before creating a new thread via Azure Communication Services (ACS), the backend must check its database to see if a direct conversation already exists between the requester and the target participant.
- If it exists, return the existing conversation ID and its details.
- If it does not exist, create a new ACS chat thread, add both participants, save the 1-1 mapping in the backend database (to enforce uniqueness), and return the new conversation ID.

**Request Body:**
```json
{
  "participantId": "string" // The ID of the user to chat with
}
```

**Response (Success - 200/201):**
```json
{
  "statusCode": 200,
  "message": "Success",
  "totalRecord": 1,
  "data": {
    "id": "string", // ACS thread ID
    "type": "direct",
    "participants": [
      { "id": "user1", "displayName": "User One" },
      { "id": "user2", "displayName": "User Two" }
    ],
    "createdAt": "iso-date-string"
  }
}
```

## 2. Conversation Pagination

**Goal:** Allow fetching the user's conversation list in chunks to improve performance, rather than loading all conversations at once.

**Endpoint:** `GET /api/conversations`

**Description:** Retrieves a paginated list of conversations for the authenticated user, sorted by the most recent activity (e.g., `lastMessageReceivedAt` descending or `updatedAt`).

**Query Parameters:**
- `page` (number, optional): The page number to fetch (default: 1).
- `limit` (number, optional): The number of conversations per page (default: 20).
- *Alternative:* `cursor` (string, optional) can be used for cursor-based pagination, which is often preferred for chat applications to prevent duplicate/missing items when new messages arrive.

**Response (Success - 200):**
```json
{
  "statusCode": 200,
  "message": "Success",
  "totalRecord": 100, // Total number of conversations (if offset pagination)
  "data": [
    {
      "id": "string", // ACS thread ID
      "topic": "string", // Group topic, if applicable
      "type": "direct | group",
      "lastMessage": {
        "content": "string",
        "senderId": "string",
        "createdAt": "iso-date-string"
      },
      "updatedAt": "iso-date-string"
    }
  ]
}
```

## 3. Group Management (Topic, Participants)

### 3.1 Update Group Topic

**Goal:** Allow authorized users (or any participant, depending on business rules) to change the topic/name of a group conversation.

**Endpoint:** `PATCH /api/conversations/group/:conversationId/topic`

**Description:** Updates the topic of an existing group conversation. The backend will update its own database (if applicable) and also update the ACS thread topic.

**Path Parameters:**
- `conversationId`: The ID of the group conversation (ACS thread ID).

**Request Body:**
```json
{
  "topic": "string" // The new topic for the group
}
```

**Response (Success - 200):**
```json
{
  "statusCode": 200,
  "message": "Success",
  "totalRecord": 1,
  "data": {
    "id": "string",
    "topic": "string",
    "updatedAt": "iso-date-string"
  }
}
```

### 3.2 Add Participants to Group

**Goal:** Allow users to add new members to an existing group conversation.

**Endpoint:** `POST /api/conversations/group/:conversationId/participants`

**Description:** Adds one or more participants to the specified group conversation.

**Path Parameters:**
- `conversationId`: The ID of the group conversation (ACS thread ID).

**Request Body:**
```json
{
  "participantIds": ["string"] // Array of user IDs to add
}
```

**Response (Success - 200):**
```json
{
  "statusCode": 200,
  "message": "Success",
  "totalRecord": 1,
  "data": {
    "addedParticipants": ["string"] // IDs of users successfully added
  }
}
```

### 3.3 Remove Participants from Group

**Goal:** Allow users (or admins) to remove members from an existing group conversation.

**Endpoint:** `DELETE /api/conversations/group/:conversationId/participants`

*(Alternatively, use `DELETE /api/conversations/group/:conversationId/participants/:participantId` if deleting one at a time is preferred)*

**Description:** Removes one or more participants from the specified group conversation.

**Path Parameters:**
- `conversationId`: The ID of the group conversation (ACS thread ID).

**Request Body (if using the bulk deletion endpoint):**
```json
{
  "participantIds": ["string"] // Array of user IDs to remove
}
```

**Response (Success - 200):**
```json
{
  "statusCode": 200,
  "message": "Success",
  "totalRecord": 1,
  "data": {
    "removedParticipants": ["string"]
  }
}
```
