# Plan: Realtime Community Wall + Chatbot

Two large features built in one pass.

---

## A. Auto-publish reports → Community Wall

### Database (one migration)

1. **Add columns to `service_requests`** (the report source of truth):
   - `is_public boolean default true`
   - `response_at timestamptz` — set the first time status leaves `pending`
   - `resolved_at timestamptz` — set when status becomes `completed`
   - `assigned_department text`
   - Trigger that auto-fills `response_at` and `resolved_at` on status change.

2. **Extend `request_status` enum** with `under_review`, `assigned`, `closed` (keep existing `pending`, `in_progress`, `completed`, `rejected`).

3. **New table `report_comments`** (`report_id`, `user_id` nullable, `content`, `is_official` boolean, `created_at`). RLS: anyone can read, authenticated users can insert (with own `user_id`), admins can insert as `is_official=true`.

4. **New table `report_follows`** (`report_id`, `user_id`, unique). RLS: user manages own rows, anyone authenticated can read counts.

5. **New table `notifications`** (`user_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at`). RLS: user reads/updates own; service role inserts.

6. **Trigger `notify_report_subscribers`** on `service_requests` UPDATE — when status changes or admin_notes added, insert notifications for: (a) report owner, (b) all followers.

7. **Trigger on `report_comments`** — notify report owner + followers.

8. **Enable realtime publication** on `service_requests`, `report_comments`, `report_follows`, `notifications`, `chat_messages`.

### Community Wall UI changes (`src/pages/CommunityWall.tsx`)

- Query merges `posts` + public `service_requests` (where `category LIKE 'Report:%'`) into one unified feed sorted by `created_at`.
- Each report card shows: title, category, location, reporter name (or "Anonymous"), submitted time, **color-coded status badge** (Pending=orange, Under Review=amber, Assigned=indigo, In Progress=blue, Resolved=green, Closed=gray), assigned department, time-since-submission, time-to-first-response, resolution time when present.
- Realtime channel subscribes to `service_requests`, `report_comments`, `report_follows`, `notifications`.
- **Performance dashboard panel** at top (collapsible on mobile): Total / Active / Resolved / Avg Response / Avg Resolution — computed client-side from current month's reports.
- **Live Activity Feed** sidebar (desktop) / drawer (mobile): newest 10 events across reports.

### Report detail (`src/components/PostDetailDialog.tsx` updated + new `ReportDetailDialog.tsx`)

- Timeline: Submitted → Responded → Assigned → In Progress → Resolved with timestamps.
- Comments thread with realtime updates. Official replies highlighted.
- Like + Follow + Share buttons. Follow toggles `report_follows`.

### Notifications (`src/components/NotificationBell.tsx`)

- Bell icon in `HeroHeader` with unread badge.
- Dropdown lists notifications; clicking marks read & navigates to `link`.
- Realtime subscription on `notifications` filtered by `user_id`.

---

## B. Chatbot (AI + Live Admin)

### Database

- **`chat_threads`** (`id`, `user_id`, `mode` ('ai'|'staff'), `title`, `status` ('open'|'closed'), `last_message_at`).
- **`chat_messages`** (`id`, `thread_id`, `role` ('user'|'assistant'|'admin'|'system'), `content`, `sender_id` nullable, `created_at`).
- RLS: user reads/writes own threads & messages; admins read/write all `staff` mode threads.

### Edge function `chat-ai`

- Uses Lovable AI Gateway (`google/gemini-3-flash-preview`) via AI SDK.
- System prompt: "You are myCortes AI assistant for Cortes, Surigao del Sur. Answer questions about municipal services, offices, programs, emergency contacts, tourist spots…" + injects current `emergency_contacts` + `programs` summary as context.
- Streams response back; saves the assistant message to `chat_messages` on finish.

### UI

- **`src/components/ChatbotLauncher.tsx`**: floating button (bottom-right, above bottom nav) on every authenticated page.
- **`src/components/ChatbotPanel.tsx`**: slide-in panel with two tabs — **AI Assistant** and **Admin/Staff**.
  - AI tab: streams via the edge function, markdown-rendered.
  - Staff tab: persists messages to `chat_messages` mode=`staff`; subscribes to realtime for admin replies; shows "Typing/Waiting for staff…" hints.
- **Admin inbox `src/pages/AdminChat.tsx`**: list of staff threads with unread counts, conversation pane, realtime updates. Linked from admin sidebar.

---

## Files

**New**
- `src/components/ChatbotLauncher.tsx`
- `src/components/ChatbotPanel.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/ReportDetailDialog.tsx`
- `src/components/PerformanceDashboard.tsx`
- `src/components/ActivityFeed.tsx`
- `src/pages/AdminChat.tsx`
- `supabase/functions/chat-ai/index.ts`
- 1 migration

**Edited**
- `src/pages/CommunityWall.tsx` (merged feed, dashboard, activity feed)
- `src/pages/ReportIssue.tsx` (add `is_public` toggle, default true)
- `src/pages/AdminRequests.tsx` (writes `assigned_department`, supports new statuses)
- `src/components/HeroHeader.tsx` (notification bell)
- `src/components/admin/AdminSidebar.tsx` (Admin Chat link)
- `src/App.tsx` (route `/admin/chat`, mount `ChatbotLauncher`)

---

## Risk / scope notes

- Big migration — touches enums, adds 4 tables, 2 triggers, realtime publication. Will be one atomic SQL block.
- Chat AI uses existing `LOVABLE_API_KEY` (already set).
- "Receive updates" notifications are in-app only (no email/push) — call out so you can confirm.
- Comments + follows are gated to authenticated users; guests can read but not interact.

Approve and I'll execute migration first, then build the UI.