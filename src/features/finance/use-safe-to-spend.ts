import { useMemo } from "react";
import { useAccounts, useCards, useInvoicePayments, useRecurring, useTransactions } from "./queries";
import { calculateSafeToSpend } from "./safe-to-spend";

/** Mesmo Dinheiro livre do Financeiro, para qualquer tela (Dashboard etc.). */
export function useSafeToSpend(workspaceId?: string) {
  const accounts = useAccounts(workspaceId);
  const transactions = useTransactions(workspaceId);
  const recurring = useRecurring(workspaceId);
  const payments = useInvoicePayments(workspaceId);
  const cards = useCards(workspaceId); // abastece o motor de cartão
  const ready = !!accounts.data && !!transactions.data && !!cards.data;
  const value = useMemo(
    () =>
      ready
        ? calculateSafeToSpend(accounts.data!, transactions.data!, 30, undefined, recurring.data ?? [], payments.data ?? [])
        : null,
    [ready, accounts.data, transactions.data, recurring.data, payments.data],
  );
  return value;
}
