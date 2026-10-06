# Life OS Control Center

The Settings page becomes a Control Center with clear sections, delivered in 7 phases. Nothing existing gets removed: modules, quick actions, Life AI, mobile navigation and current access rules all keep working the same.

## Control Center layout

```text
Configurações
├── Meu perfil          nome, foto, e-mail (só leitura), tema, moeda, formato de data
├── Meu espaço          capa, foto, nome, descrição, cor de destaque, nº de membros
├── Pessoas             membros, papel (Proprietário/Membro), convite do parceiro
├── Personalização      ordem e visibilidade do menu, favoritos, tela inicial
├── Categorias          criar, editar, arquivar, excluir quando seguro
├── Financeiro          atalhos para contas, cartões e categorias
├── Dados               exportar (JSON + CSV), lixeira
├── Atividade           histórico das ações importantes
└── Sistema             demo (só workspace demo), sair
```

- Desktop: section list on the left, content on the right.
- Mobile: a list of sections; tapping one opens a full page with a back button. No wide tables.
- Visual identity stays the same (accent #7C5CFC, Inter, dark and light themes).

## Phases

**1. Workspace.** "Meu espaço" page with a cover, photo, name, description and accent color, with a preview before saving. Renaming only changes the same space, never creates another. The accent color only applies to small details (active items, progress bars, selection).

**2. Categories.** Create, edit and archive categories, with an icon, color and type.
- An archived category disappears from new-entry forms but stays in history.
- Delete is allowed only when the category is unused; otherwise the app explains the impact and suggests archiving.
- Subcategories are prepared but not shown in this phase (see the open points).

**3. People.** Member list with role and status. The Owner/Member roles stay as they are today, so João and Renifer keep full shared editing. The structure is ready to add Admin/Viewer later.

**4. Personalization.** Choice of home screen, plus order, hiding and favorite modules for the menu (desktop sidebar and mobile menu). Hiding never removes a feature. These choices are personal per person and survive a reload.

**5. Data.**
- **Export:** one JSON file for the whole space, plus a CSV per table, chosen in the screen.
- **Trash:** deleting a task, note, goal, context, event or purchase moves it to the trash instead of erasing it.
- The trash shows who deleted each item and when, with Restore and Delete permanently.
- Financial entries keep their current behavior in this phase (see the open points).

**6. Activity.** History of important actions: renaming the space, changing settings, categories or members, deleting, restoring, creating goals or contexts. Each entry shows who, what and when ("João renamed the space · 5 min ago"). Trivial actions are not recorded.

**7. Refinement.** Check all sizes from 320 px to large screens, plus empty, loading and error states. Life AI learns the space's name and description, can answer "how is our space?", and can propose renaming the space only with "Confirmar".

## Open points (assumptions)

- **Subcategories:** the columns are prepared, but they won't appear in the screens yet, to avoid changing every financial form.
- **Financial trash:** transactions, accounts and cards are linked to balances, invoices and settlements, so a full trash for them is left for later. Their deletes still ask for confirmation as they do today.
- **Personal preferences:** saved per person, not per space.

## Technical details

**Database (additive migrations only; every new table gets GRANTs and RLS by workspace membership, reusing `is_workspace_member`).**
- `workspaces`: new columns `description`, `cover_url`, `accent_color` (nullable or with a default). `avatar_url` and the existing triggers are reused.
- `categories`: new columns `archived_at`, `parent_id` (nullable, prepared for subcategories), `sort_order`. Category forms filter out archived ones.
- `user_preferences` (user_id primary key, only that user can read or edit it): `home_route`, `nav_order text[]`, `nav_hidden text[]`, `favorites jsonb`, `currency`, `date_format`, `density`.
- `deleted_at` + `deleted_by` columns on tasks, notes, goals, contexts, events and purchases.
  - Existing queries add `deleted_at is null`.
  - RLS keeps the same rule for reading, so the trash can list deleted items.
  - Permanent deletion is a real `DELETE`.
- `workspace_activity` (workspace_id, actor_id, action, entity_type, entity_label, created_at).
  - Written by SECURITY DEFINER triggers on the relevant tables (rename, settings, categories, members, trash, restore).
  - Members can read it; nobody can write to it directly.
- Permissions: a SQL function `workspace_can(_workspace_id, _action)` backed by the current `member_role`.
  - Today OWNER and MEMBER both get everything, so behavior doesn't change.
  - Settings actions call it, which prepares the ground for ADMIN/VIEWER.
- Storage: the private `avatars` bucket is reused with the existing policies for `workspaces/{id}/...`, extended to the cover (`workspaces/{id}/cover-*`). Images are validated by type and size and shown through signed URLs.

**Code.**
- Routes: `src/routes/_authenticated/configuracoes.tsx` becomes a layout with an `<Outlet/>`, with sub-routes `configuracoes.perfil`, `.espaco`, `.pessoas`, `.personalizacao`, `.categorias`, `.financeiro`, `.dados`, `.lixeira`, `.atividade` and `.sistema`.
- `src/components/media/image-picker.tsx`: one reusable component for upload, preview, replace and remove, with fallback, loading and error states. The profile, workspace and context photos use it.
- `src/features/preferences/` (query + mutation + `useNavItems()`), consumed by the sidebar, mobile menu and bottom nav.
- `src/features/categories/`, `src/features/trash/`, `src/features/activity/`, `src/features/export/`.
- Deletes in the listed modules go through a single `softDelete(table, id)`.
- Life AI: the space's description joins the agent's base context, and a new proposal type `rename_workspace` runs only after Confirmar (`execute.ts`).

**Validation.**
- `bunx tsgo --noEmit` and eslint.
- Playwright with a signed-in session at 320/390/768/1280/1920 px: rename and reload, create/archive a category and use it in a transaction, hide a module and reload, delete a task → restore it, export the data.
- Confirm in the database that the other workspace can't see any of these records.
