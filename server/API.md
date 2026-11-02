# Career Code API

All routes are under `/api`, JSON in and out, errors as `{ "error": "message" }`.
The session is an httpOnly cookie set by login/register; the browser sends it
automatically. The server derives who is calling from the session — requests never
carry a caller id or role.

Roles: `student`, `normal_admin`, `expert_admin`, `super_admin`.
"Managers" = `expert_admin` + `super_admin` (see every ticket, manage people).
Timestamps are millisecond epoch numbers. Response shapes match `src/types/index.ts`.

Frontend helpers: `src/lib/api.ts` (`api.get/post/put/patch/del`, `uploadFiles`,
`errorMessage`), `src/lib/liveData.ts` (live hooks), `src/lib/socket.ts`.

## Auth

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /auth/me | anyone | — | `{ profile: UserProfile \| null }` |
| POST | /auth/login | anyone | `{ email, password }` | `{ profile }` (sets cookie) |
| POST | /auth/register | anyone | `{ fullName, email, password (8+), phone, qualification, qualificationDetail?, board? }` | `{ profile }` (always a student) |
| POST | /auth/logout | anyone | — | `{ success }` |
| POST | /auth/change-password | signed in | `{ currentPassword, newPassword }` | `{ success }` |

`profile.mustChangePassword` is true after an admin creates the account or resets its password.

## Users

| Method | Path | Who | Body / query | Response |
|---|---|---|---|---|
| PATCH | /users/me | signed in | `{ displayName?, phoneNumber?, photoURL?, qualification?, qualificationDetail?, board?, professionalTitle?, shortDescription? }` (student vs admin fields) | `UserProfile` |
| GET | /users/:uid | signed in | — | `UserProfile` (students may only look up counselors, public fields only) |
| GET | /admins | signed in | — | `UserProfile[]` counselors (managers: all incl. deactivated with contact details; others: active only) |
| GET | /admin/students | managers | — | `UserProfile[]` |
| GET | /admin/users | managers | — | `UserProfile[]` everyone |
| GET | /admin/stats/replies-24h | managers | — | `{ [adminUid]: replyCount }` |
| PATCH | /admin/users/:uid/status | managers | `{ status: 'active'\|'deactivated', reassignToUid? }` | `{ success, profile, reassignedCount }` — deactivating an admin hands open tickets to `reassignToUid`, or to the unassigned queue when omitted |
| POST | /admin/admins | managers (expert admins: only `normal_admin`) | `{ email, password, displayName, role, professionalTitle?, shortDescription?, phoneNumber?, assignedCategories? }` | `{ success, profile }` |
| PATCH | /admin/admins/:uid | self or managers | `{ displayName?, phoneNumber?, professionalTitle?, shortDescription?, photoURL?, assignedCategories? (managers), role? (super admin) }` | `{ success, profile }` |
| PUT | /admin/users/:uid/password | managers | `{ newPassword }` | `{ success, message }` (signs the user out everywhere) |
| DELETE | /admin/admins/:uid?reassignToUid= | managers | — | `{ success, message }` |
| GET | /public/mentors | anyone | — | `{ success, mentors }` |

## Categories

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /categories[?status=active] | anyone (logged out: active only) | — | `CategoryItem[]` (with `assignedAdminIds`) |
| POST | /admin/categories | managers | `{ name, description?, subcategories?, assignedAdminIds?, primaryAdminId?, backupAdminId?, status? }` | `CategoryItem` |
| PUT | /admin/categories/:id | managers | same | `CategoryItem` |
| DELETE | /admin/categories/:id | managers | — | `{ success }`; 409 if any ticket uses it |

Admin ↔ category assignment is stored once on the server; updating either side
(category's `assignedAdminIds` or admin's `assignedCategories`) updates both views.

## Queries (tickets) and messages

`QueryTicket.expertId` is `'unassigned'` for tickets in the general queue.
`deletedForUsers` lists users who hid the chat ("delete for me").

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /queries[?scope=all] | signed in | — | `QueryTicket[]` newest activity first. Student: own. Normal admin: assigned + unassigned in their categories. Managers: `scope=all` → everything, default → assigned to them |
| GET | /queries/:id | can view | — | `QueryTicket` (404 if not allowed) |
| GET | /queries-meta/experts[?categoryId=] | signed in | — | active counselors `{ uid, displayName, role, professionalTitle, shortDescription, photoURL, isOnline, averageRating, ratingCount }[]` |
| GET | /queries-meta/unassigned | admins | — | unassigned `QueryTicket[]` the caller can pick up |
| POST | /queries | student | `{ categoryId, expertId?, title, detail, attachments?, audioUrl?, audioDuration? }` | `{ ticket, merged }` — merged = added to the student's existing chat with that counselor; server creates ticket number, header message and notifications |
| GET | /queries/:id/messages | can view | — | `ConversationMessage[]` oldest first |
| POST | /queries/:id/messages | ticket's student, or staff of the ticket | `{ content, attachments?, audioUrl?, audioDuration? }` | `{ message, ticket }` — server updates previews, unread flags, status, notifications |
| POST | /queries/:id/follow-up | ticket's student | `{ title, detail, attachments?, audioUrl?, audioDuration? }` | `{ message, ticket }` |
| PATCH | /queries/:id/status | staff; student may only set `resolved` | `{ status }` | `QueryTicket` (resolving notifies the student; ratings are kept) |
| POST | /queries/:id/reopen | ticket's student or staff | — | `QueryTicket` (clears the rating) |
| POST | /queries/:id/rating | ticket's student, ticket resolved | `{ rating 1-5, feedback?, tags? }` | `{ ticket, expert: { ratingCount, ratingSum, averageRating } }` (re-rating replaces the old rating) |
| POST | /queries/:id/read | can view | — | `QueryTicket` — marks my notifications for it read; for the student / assigned admin also clears unread flags and marks the other side's messages read |
| POST | /queries/:id/hide | can view | — | `{ success }` — hides the chat for me, deletes my saved answers and notifications for it |
| POST | /queries/:id/reassign | staff of the ticket | `{ newExpertId }` | `{ oldTicket, targetTicket, merged }` (409 if already reassigned) |
| GET | /queries/:id/coffee-treat | can view | — | `CoffeeTreatItem \| null` |

"Staff of the ticket" = managers, the assigned admin, or a normal admin covering
the category of an unassigned ticket (replying claims it).

Attachments and `audioUrl` must be files uploaded first via `POST /uploads`
(URLs look like `/api/files/<uuid>`); data URLs are rejected.

## Uploads

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /uploads | signed in | multipart, field `files` (≤10 files, ≤10 MB each; images, PDF, audio, Word) | `{ files: AttachmentItem[] }` |
| GET | /files/:id | anyone with the link | — | the file (supports Range) |

Use `uploadFiles()` / `uploadFile()` from `src/lib/api.ts`, or
`uploadDataUrls()` / `uploadDataUrl()` from `src/lib/fileUploadHelper.ts`.

## Notifications (created only by the server)

| Method | Path | Who | Response |
|---|---|---|---|
| GET | /notifications[?limit=] | signed in | `NotificationItem[]` newest first |
| PATCH | /notifications/:id/read | owner | `{ success }` |
| POST | /notifications/read-all | signed in | `{ updated }` |
| POST | /notifications/read-by-query `{ queryId }` | signed in | `{ updated }` |

## Saved answers

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /saved-answers[?queryId=] | signed in | — | `SavedAnswerItem[]` (own) |
| POST | /saved-answers | signed in, can view the ticket | `{ queryId, messageId?, queryTitle, categoryName, expertName, questionText, answerText }` | `SavedAnswerItem` (same `messageId` twice returns the existing one) |
| DELETE | /saved-answers/:id | owner | — | `{ success }` |

## Articles

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /articles, /articles/:id | anyone | — | `ArticleItem` (with `likedBy`, `likesCount`) |
| POST | /articles | admins | `{ title, description, coverImage, category, tags?, content, readTimeMinutes? }` | `ArticleItem` (author taken from session; HTML sanitized) |
| PATCH | /articles/:id | author or managers | partial of the above | `ArticleItem` |
| DELETE | /articles/:id | author or managers | — | `{ success }` |
| POST | /articles/:id/like | signed in | `{ liked: boolean }` | `{ likesCount, likedBy }` |
| POST | /articles/:id/view | anyone | — | `{ viewsCount }` |
| GET | /saved-articles | signed in | — | `string[]` article ids |
| PUT / DELETE | /saved-articles/:articleId | signed in | — | `{ success }` |

`src/lib/articleService.ts` wraps these with the old function names.

## Reviews, coffee treats, audit

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /reviews | anyone | — | `UnifiedReviewItem[]` (managers also get `studentEmail`, `title`) |
| POST | /platform-reviews | anyone (3/day/IP) | `{ studentName, studentQualification?, studentBoard?, rating, ratingFeedback, ratingTags? }` | review + `pending` (guests' reviews need approval) |
| GET | /admin/platform-reviews[?status=pending] | managers | — | `PlatformReviewItem[]` |
| PATCH | /admin/platform-reviews/:id | managers | `{ status: 'active'\|'hidden'\|'pending' }` | review |
| GET | /coffee-treats/config | signed in | — | `{ amount, paymentMethod, accountNumber, accountTitle, enabled }` |
| POST | /coffee-treats | student of the ticket | `{ ticketId, paymentMethod?, screenshotUrl (uploaded), screenshotName?, note? }` | `CoffeeTreatItem` |
| GET | /admin/coffee-treats | super admins | — | `CoffeeTreatItem[]` |
| GET | /admin/audit-logs[?limit=] | managers | — | `AuditLogItem[]` newest first |

## Google Drive

| Method | Path | Who | Response |
|---|---|---|---|
| GET | /drive/config | signed in | `{ config: DriveConfig \| null, apiConfigured }` |
| POST | /drive/config `{ rootFolderUrl \| rootFolderId, rootFolderName? }` | managers | `{ success, config }` (verifies the folder is public) |
| GET | /drive/folder-contents?folderId=&refresh=true | signed in | `{ items: DriveItem[], folderName }` — only folders inside the configured root |
| GET | /drive/file-stream?fileId= | signed in | streams the file (audio playback) |

## Socket.IO events (server → client)

Connected automatically while signed in (`src/lib/socket.ts`). Only users allowed
to see the data receive it.

| Event | Payload |
|---|---|
| `query:upsert` | `QueryTicket` (created or changed) |
| `query:removed` | `{ id }` (hidden for me, or no longer mine) |
| `message:new` | `ConversationMessage` (only while the chat is open — `useMessages` joins the room) |
| `message:update` | `{ queryId, readIds }` |
| `notification:new` | `NotificationItem` |
| `notification:read` | `{ ids }` \| `{ all: true }` \| `{ queryId }` |
| `profile:update` | `UserProfile` (own) |
| `saved-answer:upsert` / `saved-answer:deleted` | `SavedAnswerItem` / `{ id }` |
| `data:changed` | `{ resource }` — `users`, `categories`, `articles`, `reviews`, `saved-articles`: refetch |
