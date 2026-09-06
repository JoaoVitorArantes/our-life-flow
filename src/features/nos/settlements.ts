import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { Transaction } from "@/features/finance/queries";

export type Settlement = Tables<"settlements">;
export type Split = Tables<"transaction_splits">;
export type Payer = Tables<"transaction_payers">;

export type Party = { userId: string; amount: number };
export type Transfer = { fromUserId: string; toUserId: string; amount: number };

export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/* -------------------------------------------------------------- cálculos */

/**
 * Responsabilidade (splits) x pagamento efetivo (payers).
 * Quem pagou mais do que devia vira credor; quem pagou menos vira devedor.
 * Como o Nós é um espaço de duas pessoas, o resultado é um único acerto.
 */
export function computeTransfer(shares: Party[], payers: Party[]): Transfer | null {
  const net = new Map<string, number>();
  for (const share of shares) net.set(share.userId, (net.get(share.userId) ?? 0) - share.amount);
  for (const payer of payers) net.set(payer.userId, (net.get(payer.userId) ?? 0) + payer.amount);

  const creditors = [...net.entries()]
    .filter(([, value]) => value > 0.005)
    .sort((a, b) => b[1] - a[1]);
  const debtors = [...net.entries()]
    .filter(([, value]) => value < -0.005)
    .sort((a, b) => a[1] - b[1]);

  const creditor = creditors[0];
  const debtor = debtors[0];
  if (!creditor || !debtor) return null;

  const amount = round2(Math.min(creditor[1], -debtor[1]));
  if (amount < 0.01) return null;
  return { fromUserId: debtor[0], toUserId: creditor[0], amount };
}

/** Sinal canônico do par (ordena pelos ids) para comparar acertos já pagos. */
export function signedAmount(transfer: Transfer | null, a: string, b: string) {
  if (!transfer) return 0;
  const [low, high] = a < b ? [a, b] : [b, a];
  if (transfer.fromUserId === low && transfer.toUserId === high) return transfer.amount;
  if (transfer.fromUserId === high && transfer.toUserId === low) return -transfer.amount;
  return 0;
}

export function transferFromSigned(signed: number, a: string, b: string): Transfer | null {
  const [low, high] = a < b ? [a, b] : [b, a];
  const amount = round2(Math.abs(signed));
  if (amount < 0.01) return null;
  return signed > 0
    ? { fromUserId: low, toUserId: high, amount }
    : { fromUserId: high, toUserId: low, amount };
}

/** Consolida todos os acertos pendentes em um único saldo líquido. */
export function netBalance(settlements: Settlement[], userId?: string) {
  const pending = settlements.filter((item) => item.status === "PENDING");
  let owedByMe = 0;
  let owedToMe = 0;
  const pairs = new Map<string, number>();

  for (const item of pending) {
    const value = Number(item.amount);
    if (userId) {
      if (item.from_user_id === userId) owedByMe += value;
      if (item.to_user_id === userId) owedToMe += value;
    }
    const [low, high] =
      item.from_user_id < item.to_user_id
        ? [item.from_user_id, item.to_user_id]
        : [item.to_user_id, item.from_user_id];
    const key = `${low}|${high}`;
    const signed = item.from_user_id === low ? value : -value;
    pairs.set(key, (pairs.get(key) ?? 0) + signed);
  }

  const transfers: Transfer[] = [];
  for (const [key, signed] of pairs) {
    const [low, high] = key.split("|") as [string, string];
    const transfer = transferFromSigned(signed, low, high);
    if (transfer) transfers.push(transfer);
  }

  return {
    pending,
    owedByMe: round2(owedByMe),
    owedToMe: round2(owedToMe),
    net: round2(owedToMe - owedByMe),
    transfers,
  };
}

/* ----------------------------------------------------------------- dados */

export function useSettlements(workspaceId?: string) {
  return useQuery({
    queryKey: ["settlements", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settlements")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Settlement[];
    },
  });
}

export function useSplits(workspaceId?: string) {
  return useQuery({
    queryKey: ["transaction_splits", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_splits")
        .select("*, transactions!inner(workspace_id)")
        .eq("transactions.workspace_id", workspaceId!);
      if (error) throw error;
      return (data ?? []) as unknown as Split[];
    },
  });
}

export function usePayers(workspaceId?: string) {
  return useQuery({
    queryKey: ["transaction_payers", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transaction_payers")
        .select("*, transactions!inner(workspace_id)")
        .eq("transactions.workspace_id", workspaceId!);
      if (error) throw error;
      return (data ?? []) as unknown as Payer[];
    },
  });
}

export function useTransactionDivision(transactionId?: string, enabled = true) {
  return useQuery({
    queryKey: ["transaction_division", transactionId],
    enabled: !!transactionId && enabled,
    queryFn: async () => {
      const [splits, payers, settlements] = await Promise.all([
        supabase.from("transaction_splits").select("*").eq("transaction_id", transactionId!),
        supabase.from("transaction_payers").select("*").eq("transaction_id", transactionId!),
        supabase.from("settlements").select("*").eq("transaction_id", transactionId!),
      ]);
      if (splits.error) throw splits.error;
      if (payers.error) throw payers.error;
      if (settlements.error) throw settlements.error;
      return {
        splits: (splits.data ?? []) as Split[],
        payers: (payers.data ?? []) as Payer[],
        settlements: (settlements.data ?? []) as Settlement[],
      };
    },
  });
}

/* ------------------------------------------------------------- agrupamento */

export function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const list = map.get(id);
    if (list) list.push(row);
    else map.set(id, [row]);
  }
  return map;
}

/** Divisão + pagamento de uma despesa, com fallback: quem lançou pagou tudo. */
export function divisionOf(
  transaction: Transaction,
  splits: Split[],
  payers: Payer[],
): { shares: Party[]; payers: Party[]; transfer: Transfer | null } {
  const shares = splits.map((split) => ({
    userId: split.user_id,
    amount: Number(split.amount),
  }));
  const paid = payers.length
    ? payers.map((payer) => ({ userId: payer.user_id, amount: Number(payer.amount) }))
    : [{ userId: transaction.owner_id, amount: Number(transaction.amount) }];
  return { shares, payers: paid, transfer: computeTransfer(shares, paid) };
}
