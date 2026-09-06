import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/features/finance/calc";
import {
  computeTransfer,
  round2,
  signedAmount,
  transferFromSigned,
  type Party,
  type Settlement,
} from "./settlements";

type SyncInput = {
  workspaceId: string;
  transactionId: string;
  memberIds: string[];
  shares: Party[];
  payers: Party[];
  note?: string | null;
};

/**
 * Recalcula o acerto de uma despesa dividida.
 * - acertos já pagos NUNCA são apagados; entram no cálculo como valor já quitado;
 * - existe no máximo um acerto pendente por despesa (índice único no banco).
 */
export async function syncTransactionSettlement(input: SyncInput) {
  const [a, b] = pairOf(input.memberIds, input.shares, input.payers);
  const desired = computeTransfer(input.shares, input.payers);

  const { data, error } = await supabase
    .from("settlements")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("transaction_id", input.transactionId);
  if (error) throw error;
  const existing = (data ?? []) as Settlement[];
  const pending = existing.find((item) => item.status === "PENDING") ?? null;
  const paidSigned = existing
    .filter((item) => item.status === "SETTLED")
    .reduce(
      (total, item) =>
        total +
        signedAmount(
          { fromUserId: item.from_user_id, toUserId: item.to_user_id, amount: Number(item.amount) },
          a,
          b,
        ),
      0,
    );

  const remaining = transferFromSigned(
    round2(signedAmount(desired, a, b) - paidSigned),
    a,
    b,
  );

  if (!remaining) {
    if (pending) {
      const { error: deleteError } = await supabase
        .from("settlements")
        .delete()
        .eq("workspace_id", input.workspaceId)
        .eq("id", pending.id);
      if (deleteError) throw deleteError;
    }
    return { settlement: null, paidHistory: existing.filter((i) => i.status === "SETTLED") };
  }

  if (pending) {
    const { error: updateError } = await supabase
      .from("settlements")
      .update({
        from_user_id: remaining.fromUserId,
        to_user_id: remaining.toUserId,
        amount: remaining.amount,
        note: input.note ?? pending.note,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", pending.id);
    if (updateError) throw updateError;
    return { settlement: { ...pending, ...remaining }, paidHistory: [] };
  }

  const { error: insertError } = await supabase.from("settlements").insert({
    workspace_id: input.workspaceId,
    transaction_id: input.transactionId,
    from_user_id: remaining.fromUserId,
    to_user_id: remaining.toUserId,
    amount: remaining.amount,
    status: "PENDING",
    note: input.note ?? null,
  });
  if (insertError) throw insertError;
  return { settlement: remaining, paidHistory: [] };
}

function pairOf(memberIds: string[], shares: Party[], payers: Party[]): [string, string] {
  const ids = new Set<string>([...memberIds, ...shares.map((s) => s.userId), ...payers.map((p) => p.userId)]);
  const sorted = [...ids].sort();
  return [sorted[0] ?? "", sorted[1] ?? sorted[0] ?? ""];
}

/** Regrava divisão + quem pagou de uma despesa e sincroniza o acerto. */
export async function saveDivision(input: SyncInput) {
  await supabase.from("transaction_splits").delete().eq("workspace_id", input.workspaceId).eq("transaction_id", input.transactionId);
  await supabase.from("transaction_payers").delete().eq("workspace_id", input.workspaceId).eq("transaction_id", input.transactionId);

  const total = input.shares.reduce((sum, share) => sum + share.amount, 0);
  if (input.shares.length) {
    const { error } = await supabase.from("transaction_splits").insert(
      input.shares.map((share) => ({
        workspace_id: input.workspaceId,
        transaction_id: input.transactionId,
        user_id: share.userId,
        amount: round2(share.amount),
        percentage: total ? round2((share.amount / total) * 100) : 0,
      })),
    );
    if (error) throw error;
  }
  if (input.payers.length) {
    const { error } = await supabase.from("transaction_payers").insert(
      input.payers.map((payer) => ({
        workspace_id: input.workspaceId,
        transaction_id: input.transactionId,
        user_id: payer.userId,
        amount: round2(payer.amount),
      })),
    );
    if (error) throw error;
  }

  return syncTransactionSettlement(input);
}

/** Remove divisão, pagadores e acertos pendentes (histórico pago é mantido). */
export async function clearDivision(transactionId: string, workspaceId: string) {
  await supabase.from("transaction_splits").delete().eq("workspace_id", workspaceId).eq("transaction_id", transactionId);
  await supabase.from("transaction_payers").delete().eq("workspace_id", workspaceId).eq("transaction_id", transactionId);
  await supabase
    .from("settlements")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("transaction_id", transactionId)
    .eq("status", "PENDING");
}

export async function markSettlementPaid(id: string) {
  const { error } = await supabase
    .from("settlements")
    .update({ status: "SETTLED", settled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function reopenSettlement(id: string) {
  const { error } = await supabase
    .from("settlements")
    .update({ status: "PENDING", settled_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelSettlement(id: string) {
  const { error } = await supabase
    .from("settlements")
    .update({ status: "CANCELLED", settled_at: null })
    .eq("id", id);
  if (error) throw error;
}

/** Acerto avulso, fora de uma despesa específica. */
export async function createManualSettlement(input: {
  workspaceId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string | null;
  paid?: boolean;
}) {
  const { error } = await supabase.from("settlements").insert({
    workspace_id: input.workspaceId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    amount: round2(input.amount),
    status: input.paid ? "SETTLED" : "PENDING",
    settled_at: input.paid ? new Date().toISOString() : null,
    note: input.note ?? null,
  });
  if (error) throw error;
}

export const settlementToday = todayISO;
