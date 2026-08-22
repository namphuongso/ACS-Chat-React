# Git Diff Review — np-acs-library (1.1.0 → 1.2.0)

**Branch:** `Production` — **Reviewed:** Fri Aug 21 2026
**Scope:** Staged changes (71 files, +6338/−1828) + unstaged working-tree changes (+1145/−267)
**Summary of the change:**

- Realtime layer migrated from the ACS signaling SDK (`acsEventAdapter` deleted) to a custom backend **WebSocket protocol** (`websocketAdapter`, `websocketMappers`, `websocketService`, `useWebSocket`, `websocket.types`).
- Stores reworked for **alias-aware conversation keys** (`messageStore`, `conversationStore`, `participantStore`; new `registry.ts`, `conversationKeys.ts`).
- Services revised: `chatService`, `messageService` (merge-on-load, pin sync), `fileService` (multi-file upload via `azure-storage-upload`), `readReceiptService`.
- UI: rich-text formatting, **pinned messages**, **jump-to-message**, highlight, empty-state validation, IME handling.
- Package version bumped 1.1.0 → 1.2.0 (new `.tgz`); ACS realtime events (`typing`, `readReceipt`, `connection:*`) no longer emitted.

---

## Table of contents

1. [Critical issues](#critical-issues)
2. [High severity](#high-severity)
3. [Medium severity](#medium-severity)
4. [Low severity / nits](#low-severity--nits)
5. [Staged vs unstaged inconsistency (packaging risk)](#staged-vs-unstaged-inconsistency-packaging-risk)
6. [Breaking API changes](#breaking-api-changes)
7. [Security review](#security-review)
8. [Test coverage gaps](#test-coverage-gaps)
9. [Positives](#positives)
10. [Recommended priorities](#recommended-priorities)

---

## Critical issues

### C1. Staged code ships an XSS vulnerability; the fix exists only in the unstaged worktree

- **`src/components/MessageItem/index.tsx:220-223`** (staged): `message.content` is passed straight into `dangerouslySetInnerHTML` with **no sanitization**.
- The unstaged fix (`sanitizeHtml(normalizeFormattingHtml(content))`) is still **wrongly ordered**: `normalizeFormattingHtml` (hexpression `htmlUtils.ts:134-137`) does `div.innerHTML = html` on untrusted input **before** DOMPurify runs — `onerror`-style handlers fire during that parse. Sanitize must run **first** (`sanitizeHtml(content)` → then normalize).
- **`htmlUtils.ts:151-153`**: `sanitizeHtml` is **fail-open** (`catch { return html }`) — if DOMPurify throws, raw HTML is rendered.
- If `namphuongtechnologi-acs-chat-react-1.2.0.tgz` was built from the staged tree, the published package is vulnerable.
- **Fix:** sanitize before parsing, fail closed, and rebuild the tarball from the fixed tree.

---

## High severity

### H1. Reconnect is permanently bricked by a socket stuck in `CONNECTING`

- **`websocketAdapter.ts:111-121`** (guard `state === CONNECTING → resolve()`) + **`websocketService.ts:349-378`** (`scheduleReconnect` race timeout).
- If a reconnect socket stays in `CONNECTING` (server accepts TCP but never answers the handshake), the 15 s `Promise.race` times out but the socket is **never aborted/discarded**. Every subsequent retry short-circuits on the CONNECTING guard, `isConnected()` is false, and the loop burns all retries → "Max reconnection retries reached". No staleness cleanup for `CONNECTING` (only `CLOSED` is handled at `websocketAdapter.ts:122-128`).
- **Fix:** after the race timeout, `close()`/discard the hung socket and create a fresh one.

### H2. `heartbeatTimeoutSeconds` is parsed and stored but never enforced

- **`websocketService.ts:144-155, 194-197`**: the negotiated heartbeat timeout is dead config; `heartbeat_ack` is a no-op. A dead TCP connection (carrier NAT drop, laptop suspend) that never fires `onclose` leaves the app "connected" forever. The old ACS SDK handled this; parity is lost. No watchdog/pong tracking exists.

### H3. ACS realtime events are silently dropped — consumers break without failing

- Deleted `acsEventAdapter` emitted 12 normalized events; the WS stack **never emits** `typing:started`, `readReceipt:received`, `connection:connected`, `connection:disconnected`, `conversation:deleted`.
- **`connectionService.ts:45-53`**: the `connection:disconnected` subscription was the only programmatic trigger of `reconnect()` besides browser `online` — it is now **dead code**. For `enableWebSocket: false` deployments there is **no reconnect at all**.
- **`chatService.ts:111`** sets `connectionState: 'connected'` unconditionally even when WS is disabled/unreachable — UI shows "connected" with no realtime. The `chatService.ts:388-473` `handleDomainEvent` cases for legacy events are dead code.
- Typing indicators linger the full 8 s timeout forever (nothing ever emits `typing:started`).
- **Action:** either emit legacy events mapped from WS, or explicitly document the removal (CHANGELOG/release notes) and rework `connectionService`.

### H4. Dedup "identical re-send" fix only works when payloads carry `clientMessageId`/`sequenceId` — which the real WS path never provides

- **`messageStore.ts:216-233, 326-345`**: `isProvablyDistinct` requires **both** messages to carry `clientMessageId`/`sequenceId`. The WS mapper (`websocketMappers.ts:105`) only recovers `clientMessageId` from `metadata.clientMessageId`, and `messageService.sendMessage` never writes it. **Empirically reproduced:** confirmed at `now-10s` + new optimistic temp (same content) → the new message is **dropped**. The existing test (`messageStore.test.ts:197`) uses `now-55s`, dodging the breakage band.
- **`messageStore.ts:226-233, 277-297`**: `isConfirmationOf` requires `confirmedTime >= optimisticTime − 30s`. With device clock >30s ahead of the server, a confirmed push fails both step-2 replacement and final cleanup → permanent ghost duplicate. **Empirically reproduced.** Old code had no timestamp gate. Fix: two-sided tolerance or tie-break by `clientMessageId`.

### H5. `loadMessages` merge semantics: server-side deletions never surface

- **`messageService.ts:79-153`**: `loadMessages` now merges with existing store messages instead of replacing — recalled/deleted messages removed on the server persist forever client-side. Also no request-ordering guard between concurrent `loadMessages`/`loadMore` (last-write-wins on cursor state).

### H6. `loadLatestMessage` and initial page assume newest-first ordering

- **`messageService.ts:187-201, 116`**: `get-messages?pageSize=1` is assumed to return the **latest** message first and `items[0]` newest, with no `sort`/`order` param passed. If the backend pages oldest-first, every resync sets the _oldest_ message as "latest" preview. `options.startTime` (still in the public signature at :81) is silently ignored.

### H7. Jump-to-message index-offset bug — fix exists only in the unstaged tree

- **`MessageList/index.tsx`** (staged): `scrollToIndex(targetIndex)` / `initialTopMostItemIndex={items.length - 1}` ignore the `firstItemIndex` (1,000,000) offset, clamping every jump to the top of the list. The fix (`firstItemIndex + targetIndex`, `MessageList/index.tsx:198-248`) exists **only in the unstaged worktree**, and the tests passing them (`MessageList.test.tsx:254-297`) pass only against the fixed code. Same published-tarball risk as C1.

### H8. Cross-conversation jump: `jumpTarget.conversationId` is never validated

- **`MessageList/index.tsx:318-329`**: reacts to _any_ `jumpTarget?.messageId` regardless of `conversationId`. A stale/foreign target (or a pinned-banner jump while the wrong list is mounted) makes the rendered list fire `onLoadMore` (up to 30 attempts, `:351`) hunting a message that can never appear, then `clearJumpTarget()` destroys the jump for the correct conversation. `useMessages.ts:99-104` stamps `conversationId` — the consumer ignores it.

### H9. Plain vs HTML payload inconsistency

- **`MessageInput/index.tsx:110` + `ConversationFooter.tsx:137-144`**: `handleSend` always sends contentEditable `innerHTML` (`normalizeFormattingHtml`), but `type: 'html'` is attached **only in format mode**. A plain-mode multi-line message (Shift+Enter → `<div>line1</div><div>line2</div>`) is sent with `type: 'text'` (`messageService.ts:347`) and rendered by `MessageItem` (line 224) as escaped literal text — remote users see raw tags. Previously the client always sent `type: 'html'`. The dedicated test asserts only a single-line `"Hello plain text"`.

---

## Medium severity

### M1. Duplicate room join / ambiguous room targeting

- **`websocketService.ts:166-168, 123-129`**: `roomId` is carried in the connect URL query _and_ re-sent as `enter_room` in the handshake — double join if the server treats the URL param as a join. `WsClientReadMessage`/`leave_room` carry **no `roomId`**, so `sendRead` (L496-515) targets an implicit "active room". `lastVisibleMessageIds` only ever grows (never pruned outside `dispose()`).

### M2. Re-`initialize()` during an in-flight reconnect loop competes with the new session

- **`websocketService.ts:67-70, 316-388`**: the old loop survives `dispose()` and re-reads the _new_ `adapter`/`config`/`activeRoomId` each iteration, keeping `isReconnecting = true` and swallowing the fresh session's `handleClose`. Reconnect loop is not cancelled/joined on `dispose()` (`dispose()` also doesn't clear `chatServiceRef`).

### M3. Send-read/`leaveRoom` trust unverified server-side room state

- `conversationService.ts:636-642` / `websocketService.ts:472-491`: `leaveRoom()` sets `activeRoomId = null` before the send; if the send fails, after reconnect the server never receives `leave_room` for the previous room and read-tracking goes stale. `useWebSocket.ts:42-52` optimistically overwrites `activeRoomId` regardless of the service return value (e.g. `false` when disconnected).

### M4. Stale `CONNECTING` socket after race timeout (service side)

- **`websocketService.ts:349-378`**: the timeout only rejects the race; the adapter's own `connect()` promise stays pending indefinitely, and `pendingConnectReject` holds a stale closure. Also `scheduleReconnect` invoked from `handleClose` without `.catch`.

### M5. Aliased keys double storage/dedup/render fan-out

- **`messageStore.ts:357-377`**: every add writes to _all_ alias keys and re-runs `dedupAndSortMessages` per alias (typically 2×). Any component pairing `useMessages(threadId)` with `useMessages(roomId)` for the same conversation renders duplicates. `participantStore.ts:84-94` shares the same array/object reference across aliases — future in-place mutation cascades silently.

### M6. Pin-sync fire-and-forget races and dead catch

- **`chatService.ts:344-358`**: `getPinnedMessages` never rejects (catches into `{error}`), so the `.catch` is dead; an older slow response can overwrite a newer pinned list. The `hasFetchedPinned` gate (`:298, :373`) drops pin events entirely for conversations never opened, making pin state diverge from the server.

### M7. `loadMore` pagination can get permanently stuck

- **`messageService.ts:290-293`**: fallback `hasMore = nextContinuationToken && olderMessages.length > 0` — a page of only already-loaded (deduped) IDs sets `hasMore = false` even though `nextContinuationToken` exists. `messageStore.ts:244-249` computing `oldestLoadedMessageId` from `updatedMessages[0]` is also unreliable during a pending initial load.

### M8. Failed upload leaves a ghost message stuck in `sending` forever

- **`useConversationFooter.ts:171-174, 273-276`**: on upload failure `uploadFile` throws correctly, but the optimistic `sending` entry is never marked `failed`/removed — ghost message with no retry path. (`fileService.ts:98-102`: throwing _after_ the blob is committed creates a possibly orphaned blob; backend reconciliation warning exists.)

### M9. Jump/scroll competing effects double-drive pagination

- **`MessageList/index.tsx:257-287 + 332-364`**: two independent effects both drive the pending jump and both call `onLoadMore` (both un-awaited; `loadMore` rejects on error → unhandled rejections). Combined with H8 this makes the 30-attempt loop far easier to hit. `pendingJumpRef` is lost on remount (`Conversation/index.tsx:195` `key={idToUse}`) while `jumpTarget` persists.

### M10. `firstItemIndexRef` only ever decreases

- **`MessageList/index.tsx:135-150`**: switching `roomType` away from `'U'` or removing a top optimistic message shrinks the list but never realigns `firstItemIndex` → prepend/`scrollToIndex` math drifts.

### M11. A11y regression on clickable areas

- **`PinnedMessageBanner.tsx:126-135, 186-201`**: clickable content regions are plain `div`s — no `role`/`tabindex`/keyboard handling (mouse-only). Also `MessageList.module.scss:8-14` adds `overflow: hidden` which can clip bottom-anchored absolute dropdowns (`MessageItem` `dropdownMenuUp`). `MessageInput` placeholder div (`index.tsx:186-197`) duplicates the textarea's `aria-placeholder` and isn't `aria-hidden`.

### M12. Reconnect policy gaps

- **`websocketService.ts:294-304`**: server close with code 1000 (normal) or duplicate-session → no reconnect ever; an idle server close leaves chat permanently stale until reload. Also `onerror` after `onopen` (`websocketAdapter.ts:176-192`) leaves state `'connected'` with no close-timeout safety net → ties into H2.

### M13. `dispose()` leaks reconnection state across re-init

- **`websocketService.ts:562-577`**: `heartbeatIntervalSec`/`heartbeatTimeoutSec` not reset; in-flight `scheduleReconnect` loop with `config = null` throws TypeError inside try and burns retries while logging a misleading "Max reconnection retries reached" on intentional dispose. `readReceiptService.ts:97-127` debounce timer never cleared on `dispose()` (fires post-dispose; `lastSentMessageIds` never reset).

### M14. `jumpTarget` store slot has no lifecycle

- **`messageStore.ts:737-745`**: never expires/validates; `timestamp` stored but never read anywhere; only the list consumer clears it. Enables H8.

### M15. Upload headers confusion + public blob URLs

- **`fileService.ts:20, 40-48, 114-137`**: `apiHeaders` is dead weight since all three session endpoints are overridden (only `mergedHeaders` effective); SAS is stripped from the returned `fileUrl`, so if the Azure container is private, `metadata.url` (used by MessageItem `img src`) breaks unless the backend `complete-upload` returns a signed URL. `uploadFiles` return type changed `Promise<string>` → `Promise<UploadFilesResult>` (fine for consumers, but a new public contract; internal consumers must migrate).

### M16. WS payload zero runtime validation

- **`websocketMappers.ts:236-241`**: everything decoded via `as Record<string, unknown>`; a backend payload with wrong `type` casing or stringified `payload` silently becomes `null`/mis-mapped with no `ws:error` surfaced. `RoomDisbanded`/`RoomRoleChanged`/`RoomOwnershipTransferred` (`:373-398`) pass payloads through untyped, violating `ChatDomainEvent<T>` typing without a runtime guard.

### M17. Tests don't exercise the riskiest paths; one test is a no-op

- `chatService.test.ts` "initialization errors gracefully" spies a throw but never awaits `initialize` — the actual init-failure path is untested.
- No tests for: hung-`CONNECTING` reconnect (H1), heartbeat enforcement (H2), the 0–30 s re-send band / >30 s clock-skew ghosts (H4), cross-conversation jumps (H8), pending-pagination jumps, highlight expiry, sanitization ordering (C1), banner disappearance after unpin, duplicate-delivery idempotency (only single delivery tested).

---

## Low severity / nits

| #   | Location                               | Finding                                                                                                                                                                                                                                                   |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L1  | `websocketAdapter.ts:57-60`            | Unparseable URL silently drops `access_token`/`deviceId`/`roomId` — confusing auth failure with no log.                                                                                                                                                   |
| L2  | `websocketAdapter.ts:243-277`          | `disconnect()` fabricates a `CloseEvent` (`wasClean: true`) firing synchronously even when never open; real close codes/reasons lost for normal disconnects.                                                                                              |
| L3  | `websocketService.ts:279-287`          | `ws:disconnected` dispatched even for intentional `dispose()` — listeners can't distinguish teardown from a drop.                                                                                                                                         |
| L4  | `websocketService.ts:123-132`          | Dispose-aborted initial connect logs error-level "Failed to establish initial WebSocket connection" on every quick init/teardown (noise).                                                                                                                 |
| L5  | `websocketMappers.ts:80`               | `senderId` defaults to `'unknown'` (old contract used `''`), which now flows into store dedup/sender-matching heuristics.                                                                                                                                 |
| L6  | `websocketMappers.ts:89-91`            | `isDeleted` derived from presence of a delete date; `isDeleted: true` without date backfills `deletedAt` with `editedAt`/`createdAt`.                                                                                                                     |
| L7  | `websocket.types.ts`                   | `WsReactionRemovedPayload.reactionCode?: null` makes "removed" semantics a type lie; `enter_room` has `roomId` but `read`/`leave_room` don't (asymmetry with no server spec to verify against).                                                           |
| L8  | `constants/websocket.ts:14-26`         | `WS_ERROR_CODES` exported but unused; `ALT_WS_PATH` dead; `WS_MAX_MESSAGE_SIZE` added staged then removed unstaged — churn.                                                                                                                               |
| L9  | `chatService.ts:92-105`                | `console.warn` instead of `logger`; fails-soft with warning while still reporting `connected` (H3 adjacen).                                                                                                                                               |
| L10 | `messageStore.ts:236-260, 311-315`     | Invalid-id filtering is string-literal based (`'[object Object]'`, `'null'`, `'undefined'`) — duplicates logic already in `messageService.sendMessage:400`.                                                                                               |
| L11 | `conversationKeys.ts:32-35, 60-62`     | Alias index last-writer-wins on collision (no detection); `conversations[id]` fast-path can bypass the index if a caller uses a different record key.                                                                                                     |
| L12 | `registry.ts:12-19`                    | `getMessageStoreHook()?.getState()` silently returns `null` when `messageStore` is tree-shaken — sender-name fallback skipped.                                                                                                                            |
| L13 | `conversationStore.ts:150`             | `updateConversation` blindly spreads `updates` — could churn `id`/`conversationId` and desync the alias index.                                                                                                                                            |
| L14 | `participantStore.ts:116-131, 181-224` | `removeParticipant`/`removeTypingUser`/`clearTypingUsers` always return new objects even on no-op → spurious re-renders (old code returned `state` when key absent).                                                                                      |
| L15 | `messageService.ts:383-390`            | `options.attachments` on `SendMessageOptions` is silently dropped from the body — misleading public type.                                                                                                                                                 |
| L16 | `messageService.ts:400-419`            | `serverMessageId` falls back to `tempId` on empty backend response; message reported `sent` without confirmation.                                                                                                                                         |
| L17 | `acsMappers.ts:124-127`                | `mapAcsMessageToMessage` accepts `unknown`; null/undefined payload → TypeError mapped to generic `NETWORK_ERROR`; attachments (`content.attachments`, `message.types.ts:126`) never mapped → REST-fetched history loses file attachments.                 |
| L18 | `fileService.ts`                       | `CreateUploadSessionResponse` declares `uploadId: string` required but `data?.uploadId` may be undefined — the type lies (`file.types.ts:4-13`); `import { CreateUploadSessionResponse }` types imported as values (breaks under `verbatimModuleSyntax`). |
| L19 | `file.ts`                              | Extension allowlists are presentation-only (no server-side MIME validation).                                                                                                                                                                              |
| L20 | `readReceiptService.ts:147`            | Unnecessary dynamic import of `acsMappers`; unused `conversationId` in warn.                                                                                                                                                                              |
| L21 | `MessageInput/index.tsx:99-122`        | Editor cleared even if the send dispatch chain fails later (fire-and-forget) — draft lost on failure.                                                                                                                                                     |
| L22 | `MessageInput/index.tsx:48-54`         | `resizeTextarea` + empty resize effect are dead code.                                                                                                                                                                                                     |
| L23 | `MessageItem/index.tsx:236`            | `acs-msg-<id>` duplicate DOM ids across two mounted lists; highlight row animation (`forwards` fill) flickers at the exact 2.5 s class removal.                                                                                                           |
| L24 | `PinnedMessageBanner.tsx:88-97`        | Optimistic `setPinnedMessages(filter)` replaces whole array from a possibly stale closure — a concurrent WS unpin of another message can be resurrected; `hasFetchedPinned` early-return means a failed first fetch never retries until remount.          |
| L25 | `Conversation/index.tsx:45-51`         | When `pinnedMessageIds` prop is supplied, WS pin events update the store but the prop keeps `MessageList` pinned flags stale.                                                                                                                             |
| L26 | `useWebSocket.ts:30-31`                | On `ws:disconnected` only `connectionState` resets; `sessionId`/`activeRoomId` stay stale in UI.                                                                                                                                                          |
| L27 | `logger.ts`                            | `config.logger` (custom `ChatLogger`) ignored — logs to `console` unconditionally, contradicting docs.                                                                                                                                                    |
| L28 | `connectionService.ts:27-29`           | `this.reconnect(...)` called un-awaited/un-caught (safe today, brittle).                                                                                                                                                                                  |
| L29 | `websocketService.ts:185`              | `enter_room_ack` logs `this.activeRoomId`, which may already have changed.                                                                                                                                                                                |
| L30 | `htmlUtils.ts:199-216`                 | `setSelectionCharacterOffsetsWithin` silently no-ops if offsets exceed text length after normalization; `normalizeFormattingElement` flatten loop can re-order deep nesting (cosmetic).                                                                   |
| L31 | `useConversationFooter.ts:400-408`     | Decoration normalization skipped for empty selections (inconsistent with collapsed-caret bold case).                                                                                                                                                      |
| L32 | `MessageList/index.tsx:402`            | `useChatStore.getState()?.currentUser` read inside render path — no subscription, no re-render on display-name change (impact limited).                                                                                                                   |
| L33 | `MessageList/index.tsx:222-238`        | `requestAnimationFrame`/`setTimeout(100)` scrolls never cancelled on unmount (safe only because ref is nulled).                                                                                                                                           |
| L34 | `MessageItem/index.tsx`                | No `rel`/`referrerpolicy` on image `img src` from untrusted WS `metadata.url`.                                                                                                                                                                            |
| L35 | `conversationService.ts:545-563`       | `openConversation` on an already-loaded conversation doesn't call `resolveConversationKeys`.                                                                                                                                                              |

---

## Staged vs unstaged inconsistency (packaging risk)

Critical divergence between what is staged and what the working tree contains. If the `namphuongtechnologi-acs-chat-react-1.2.0.tgz` was built from the **staged** tree, the published package:

- ships the **unsanitized `dangerouslySetInnerHTML`** XSS bug (C1),
- has the **broken jump-to-message scrolling** (H7, index-offset),
- lacks the query-param preservation, `enableWebSocket: false` handling, stale-CLOSED socket cleanup, connect-timeout race cleanup, and `conversation:updated` undefined-merge guard.

Unstaged fixes are real improvements — **commit them and rebuild the tarball** before release. The tgz committed at 1.1.0 → 1.2.0 also differs in size from the working-tree file (1,672,371 → 1,673,519 bytes) and is not reproducible, so its provenance is uncertain.

---

## Breaking API changes

| Change                                                                                                                | Impact                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acsEventAdapter` / `AcsEventAdapter` / `ChatEventHandlerFn` deleted; `ChatService.getEventAdapter()` removed         | Not reachable via package `exports` (only `.`), so published consumers unaffected — but any deep import breaks.                                                                                                                                                                                                                                            |
| Realtime event names (`typing:started`, `readReceipt:received`, `connection:*`, `conversation:deleted`) never emitted | Silent behavioral break for `chatService.subscribe` consumers; payload shapes also changed (`message:deleted` lost `sender` → `deletedBy`; `participant:added` lost `addedBy`/`addedAt`; `conversation:created/updated` lost `createdBy`/`metadata`; `message:received/edited` gained `attachments`/`clientMessageId`/`sequenceId` — compatible superset). |
| `src/index.ts` now exports `./services`, `./adapters/websocket`, `./constants/websocket` wholesale                    | New public surface without versioning thought (`VERSION` still 1.0.0 while package is 1.2.0).                                                                                                                                                                                                                                                              |
| `uploadFiles` return `Promise<string>` → `Promise<UploadFilesResult>`                                                 | Internal consumers must migrate.                                                                                                                                                                                                                                                                                                                           |
| `messagesByConversation` gains alias-key entries                                                                      | Code enumerating keys to derive "conversations with messages" observes duplicates.                                                                                                                                                                                                                                                                         |
| Store exports                                                                                                         | All previously exported symbols remain; added fields (`hasFetched`, `continuationToken`, `jumpTarget`, `highlightedMessageId`, `getConversationKeys`, `findConversationKey`) are additive. **No breaking public store change.**                                                                                                                            |
| `@namphuongtechnologi/azure-blob-transfer` is a `file:` tarball dependency (`package.json:60`)                        | Will not resolve for downstream consumers from npm.                                                                                                                                                                                                                                                                                                        |

---

## Security review

1. **XSS via rich-text HTML** — Critical (C1): staged = unsanitized; unstaged = sanitize-after-parse (still exploitable via `onerror` during `innerHTML` parse) + fail-open fallback. Fix ordering, fail closed.
2. **WS auth token in URL query string** (`websocketAdapter.ts:75`) — tokens may land in access logs/proxies. Typical WS pattern; consider `Sec-WebSocket-Protocol` or short-lived token.
3. **Image URLs from WS payloads** — rendered directly in `img src` without `rel`/`referrerpolicy`; untrusted URLs can point anywhere (tracking). No `javascript:` risk for `img src` in modern browsers, but add `referrerpolicy="no-referrer"`.
4. **`fetchBackend`/upload headers** — `backendHeaders` injected everywhere; `uploadHeaders` merged (unstaged fix) for the 3 upload endpoints; auth is consistently forwarded. OK.
5. **Sanitize/`DOMPurify` defaults** allow `style` and `font[size]` — cosmetic abuse possible, not script XSS.

---

## Test coverage gaps

- **Websocket:** hung-`CONNECTING` path (H1), heartbeat enforcement (H2 — no fake timers; tests rely on real sleeps, mildly flaky in CI), `useWebSocket` subscribe/state-update flow (untested), duplicate-delivery idempotency (only single delivery tested), reconnect for code 1000/duplicate-session.
- **Stores:** the 0–30 s re-send band and >30 s clock-skew ghost (H4 — both buggy paths untested), out-of-order confirmations, cross-alias `updateMessage`/`removeMessage`/participant actions, `goto`/banner when `conversationId` mismatches.
- **Services:** `connectionService` reconnect with WS-only signaling (dead path, untested), `loadLatestMessage` error, send/edit/delete/pin failure rollbacks, `retryMessage`, `cancelSession`/empty-`fileUrl`/SAS-strip upload paths, `loadMessages` failure (loading flips back), pin error paths.
- **Components:** pending/paginated jumps, attempt exhaustion, cross-conversation targets, `isHighlighted` prop on rendered items, highlight expiry (a 2500 ms real-timer highlight leaks across tests — `beforeEach` doesn't reset `useMessageStore`), sanitize ordering, banner disappearance after unpin, plain-mode multi-line payload (`type: 'text'` with markup).
- **Other:** `chatService` init-failure path is spied-but-never-awaited (no-op test).

---

## Positives

- WS adapter wraps every callback invocation in try/catch; unsubscribe functions and per-callback guards are defensive and correct.
- Promise-based `connect()` semantics genuinely tested (open resolution, close-before-open rejection, disconnect-while-pending, CLOSING guard, stale-CLOSED handler detach).
- Reconnect backoff math is correct; unstaged change to await real `onopen` (vs fixed 500 ms sleep) is right.
- `dedupAndSortMessages` genuinely fixes the old "WS push without `clientMessageId` never replaces the optimistic temp" bug (when IDs are present).
- Alias-aware conversation keys solve a real problem (WS room GUID vs UI thread key).
- `uploadLargeFile` correctly handles `cancelSession` on failure + committed-blob reconciliation warnings; `uploadFiles` uses `Promise.allSettled` (tested partial-failure).
- Pinned-message flow is wired end-to-end (optimistic + WS `message:unpinned` → store → banner), gated on `hasFetchedPinned`.
- Jump-to-message routed through the store so any component can trigger it; pending-jump pagination loop capped at 30.
- IME composition guard (`isComposing` + keyCode 229) handled and tested.
- Button types (`type="button"`) correct throughout; `conversation:updated` undefined-merge fix in the unstaged diff is a real correctness improvement.
- Test suites per-layer are extensive (40+ store tests, 41 websocket tests pass).

---

## Recommended priorities

1. **Pre-release:** fix C1 (sanitize-before-parse, fail closed), commit the unstaged fix set, and rebuild the 1.2.0 tarball from the corrected tree (H7 index-offset ships with it).
2. **Reconnect reliability:** abort hung `CONNECTING` sockets (H1), enforce a heartbeat/pong watchdog (H2), cancel/join the reconnect loop in `dispose()` (M2), handle server code 1000 / duplicate-session closes (M12).
3. **Realtime compat:** decide the legacy-event story (emit mapped `typing:*`/`readReceipt:*`/`connection:*` or document removal + fix `connectionService` dead resync path) (H3).
4. **Dedup correctness:** two-sided clock-skew tolerance or `clientMessageId` tie-break; populate `clientMessageId` into `metaData` on send (H4).
5. **MessageList:** guard on `jumpTarget.conversationId` (H8), single-owner for the pending jump (M9), `firstItemIndex` realignment (M10).
6. **Payloads:** plain-mode messages must send plain text (or always include `type: 'html'`) (H9).
7. **Tests:** add coverage for every bug-class above; convert the no-op init-failure test; use fake timers for heartbeat/backoff.
