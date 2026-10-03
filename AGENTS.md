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
