import { supabase } from "@/integrations/supabase/client";
import { compressImage, validateImage } from "@/components/profile/image-utils";
import type { Workspace } from "./queries";

export const DEFAULT_ACCENT = "#7C5CFC";

/** Storage path hidden behind a signed URL (`…#avatar-path=<path>`). */
export function storedPath(url?: string | null) {
  if (!url) return null;
  return url.split("#avatar-path=")[1] ?? (url.startsWith("http") ? null : url);
}

/** Uploads into the workspace's private folder; storage policies check membership. */
export async function uploadWorkspaceImage(workspaceId: string, kind: "avatar" | "cover", file: File) {
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);
  const blob = kind === "avatar" ? await compressImage(file, 640, 640) : await compressImage(file, 1600, 600);
  const path = `workspaces/${workspaceId}/${kind}-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", cacheControl: "3600" });
  if (error) throw error;
  return path;
}

export async function removeStoredImage(path: string | null) {
  if (path) await supabase.storage.from("avatars").remove([path]);
}

export type IdentityPatch = {
  name: string;
  description: string | null;
  accentColor: string | null;
  /** undefined = keep, null = remove, string = new storage path */
  avatarPath?: string | null | undefined;
  coverPath?: string | null | undefined;
};

/** Same workspace, metadata only — never creates another workspace. */
export async function saveWorkspaceIdentity(workspace: Workspace, patch: IdentityPatch) {
  const { error } = await supabase.rpc("update_workspace_identity", {
    _workspace_id: workspace.id,
    _name: patch.name,
    _description: patch.description ?? "",
    _accent_color: patch.accentColor as string,
    _avatar_url: (patch.avatarPath ?? null) as string,
    _cover_url: (patch.coverPath ?? null) as string,
    _set_avatar: patch.avatarPath !== undefined,
    _set_cover: patch.coverPath !== undefined,
  });
  if (error) throw error;
}
