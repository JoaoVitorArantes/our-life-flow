<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Routine/habit occurrences are derived from the routine's frequency (occursOn) and only check-ins are stored in routine_logs — never persist occurrences as tasks or events, so the Agenda never duplicates them.
- AI Inbox: the server (`src/lib/inbox/`) only interprets text into validated intent objects with workspace-resolved IDs; execution happens client-side after user confirmation via the same mutations the forms use (`src/features/inbox/execute.ts`). Why: one pipeline reusable by future channels (WhatsApp/receipts) without duplicating business rules.
- Life OS AI agent (`/api/agent` + `src/lib/agent/tools.server.ts`): read tools query with the caller's RLS client and the workspace from the conversation; write intents are only `propose_action` previews executed client-side after Confirm via `src/features/inbox/execute.ts`. Why: AI never picks workspace/user ids and business rules stay in the existing mutations.
- Agent conversations live in `ai_conversations`/`ai_messages` (UIMessage JSON, shared by workspace), routed at `/inbox/$threadId`. Why: persisted, shareable history per thread.
- The global Life OS AI surface reuses the same conversations, `AgentChat`, and `/api/agent`; page context is advisory metadata only. Why: one agent and one authorization boundary across every module.
- Cross-device sync: DB triggers write minimal rows (workspace, table, op; no record ids) to `workspace_sync_events`, the only table published to Realtime; one subscription per active workspace (`src/features/sync/use-realtime-sync.ts`) invalidates React Query. Why: RLS-checked, tenant-isolated delivery including deletes, no cross-tenant id leaks.
- Demo data exists only in workspaces with `is_demo` (changeable only by admin SQL, enforced by trigger); the client calls `prepare_demo_workspace`/`reset_demo_workspace` RPCs, which re-check membership and the flag server-side. Why: users can never seed or wipe demo rows in a real workspace.
- Android ships as a Trusted Web Activity in `android/` that opens the hosted site. Why: the app depends on SSR, server functions and Google OAuth, which a static bundle cannot provide.
