import type { InboxAction } from "@/lib/inbox/inbox.functions";
import { CONTEXT_DEFAULTS } from "@/features/contexts/ai-contract";
import { CONTEXT_TYPES, CONTEXT_STATUSES, type Context } from "@/features/contexts/queries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Action = InboxAction;
export function ContextFields({
  action,
  current,
  onChange,
}: {
  action: Action;
  current?: Context | undefined;
  onChange: (patch: Partial<Action>) => void;
}) {
  const fields = { ...CONTEXT_DEFAULTS, ...current, ...action.context_data };
  const patch = (values: NonNullable<Action["context_data"]>) =>
    onChange({ context_data: { ...action.context_data, ...values } });
  if (!["create_context", "update_context"].includes(action.intent)) return null;
  return (
    <>
      <Select
        value={fields.type ?? CONTEXT_DEFAULTS.type}
        onValueChange={(v) => patch({ type: v as NonNullable<typeof fields.type> })}
      >
        <SelectTrigger aria-label="Tipo do contexto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTEXT_TYPES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={fields.status ?? CONTEXT_DEFAULTS.status}
        onValueChange={(v) => patch({ status: v as NonNullable<typeof fields.status> })}
      >
        <SelectTrigger aria-label="Situação do contexto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CONTEXT_STATUSES.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={fields.visibility ?? CONTEXT_DEFAULTS.visibility}
        onValueChange={(v) => patch({ visibility: v as "PRIVATE" | "SHARED" })}
      >
        <SelectTrigger aria-label="Visibilidade do contexto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="SHARED">Compartilhado</SelectItem>
          <SelectItem value="PRIVATE">Pessoal</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Início do contexto"
        value={fields.start_date ?? ""}
        onChange={(e) => patch({ start_date: e.target.value || null })}
      />
      <Input
        type="date"
        aria-label="Fim do contexto"
        value={fields.end_date ?? ""}
        onChange={(e) => patch({ end_date: e.target.value || null })}
      />
      <Input
        aria-label="Local do contexto"
        placeholder="Local"
        value={fields.location ?? ""}
        onChange={(e) => patch({ location: e.target.value || null })}
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        aria-label="Orçamento do contexto"
        placeholder="Orçamento"
        value={fields.budget_amount ?? ""}
        onChange={(e) =>
          patch({ budget_amount: e.target.value === "" ? null : Number(e.target.value) })
        }
      />
      <Textarea
        aria-label="Descrição do contexto"
        value={fields.description ?? ""}
        onChange={(e) => patch({ description: e.target.value || null })}
      />
    </>
  );
}
