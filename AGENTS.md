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
- Trash: tasks, notes, goals, contexts, events and purchases are soft-deleted through the `trash_record` RPC; their SELECT policies add `deleted_at IS NULL`, and the trash is read only via `list_trash`. Why: trashed rows vanish from every screen, count and search without per-query filters.
- Workspace identity (name, description, avatar, cover, accent) changes only through the `update_workspace_identity` RPC, gated by `workspace_can`. Why: one permission check and audit point, also reused by Life AI after Confirm.
- `workspace_activity` is written only by SECURITY DEFINER functions/triggers with minimal metadata (actor, action, entity type, short label). Why: useful history without storing sensitive content or letting clients forge entries.
- Per-person preferences (menu order/hidden/favorites, home screen) live in `user_preferences` and are applied by `useNavGroups`. Why: hiding a module never removes features and never affects the partner.
- Settings is a layout route (`/configuracoes`) with one sub-route per Control Center section. Why: each area stays small and linkable on mobile.
