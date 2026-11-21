import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Panel } from "@/components/common/page";
import { LoadingState } from "@/components/common/states";
import { WeddingShell } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PLAN, planInputSchema, type PlanInput } from "@/features/wedding/contracts";
import { useSavePlan } from "@/features/wedding/api";
import { useWeddingData } from "@/features/wedding/use-wedding";

export const Route = createFileRoute("/_authenticated/casamento/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações do casamento — Life OS" },
      { name: "description", content: "Datas, orçamento e premissas do planejamento do casal." },
      { property: "og:title", content: "Configurações do casamento — Life OS" },
      { property: "og:description", content: "Premissas do planejamento do casal." },
    ],
  }),
  component: WeddingSettings,
});

function WeddingSettings() {
  const w = useWeddingData();
  const save = useSavePlan(w.workspaceId, w.userId);
  const [form, setForm] = useState<PlanInput>(DEFAULT_PLAN);
  useEffect(() => {
    if (w.plan)
      setForm({
        wedding_date: w.plan.wedding_date,
        move_in_date: w.plan.move_in_date,
        total_budget: w.plan.total_budget == null ? null : Number(w.plan.total_budget),
        housing: w.plan.housing as PlanInput["housing"],
        bedrooms: w.plan.bedrooms,
        standard: w.plan.standard as PlanInput["standard"],
        savings_start: w.plan.savings_start,
        notes: w.plan.notes,
      });
  }, [w.plan]);
  if (w.loading) return <LoadingState />;
  const set = <K extends keyof PlanInput>(k: K, v: PlanInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const submit = () => {
    const parsed = planInputSchema.safeParse(form);
    if (!parsed.success) {
      toast.error("Confira os campos.");
      return;
    }
    save.mutate(parsed.data, {
      onSuccess: () => toast.success("Plano salvo."),
      onError: (e) => toast.error(e.message),
    });
  };
  return (
    <WeddingShell title="Configurações" subtitle="Campos vazios ficam como “não informado”.">
      <Panel className="grid gap-4 sm:grid-cols-2">
        <Field label="Data do casamento">
          <Input
            type="date"
            value={form.wedding_date ?? ""}
            onChange={(e) => set("wedding_date", e.target.value || null)}
          />
        </Field>
        <Field label="Data da mudança">
          <Input
            type="date"
            value={form.move_in_date ?? ""}
            onChange={(e) => set("move_in_date", e.target.value || null)}
          />
        </Field>
        <Field label="Orçamento total (R$)">
          <Input
            type="number"
            min={0}
            value={form.total_budget ?? ""}
            onChange={(e) =>
              set("total_budget", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
        <Field label="Início da economia">
          <Input
            type="date"
            value={form.savings_start ?? ""}
            onChange={(e) => set("savings_start", e.target.value || null)}
          />
        </Field>
        <Field label="Moradia">
          <Select
            value={form.housing}
            onValueChange={(v) => set("housing", v as PlanInput["housing"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rent">Alugada</SelectItem>
              <SelectItem value="own">Própria</SelectItem>
              <SelectItem value="other">Outra</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quartos">
          <Input
            type="number"
            min={0}
            value={form.bedrooms ?? ""}
            onChange={(e) => set("bedrooms", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
        <Field label="Padrão das aquisições">
          <Select
            value={form.standard}
            onValueChange={(v) => set("standard", v as PlanInput["standard"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Econômico</SelectItem>
              <SelectItem value="intermediate">Intermediário</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button onClick={submit} disabled={save.isPending}>
            Salvar plano
          </Button>
        </div>
      </Panel>
    </WeddingShell>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
