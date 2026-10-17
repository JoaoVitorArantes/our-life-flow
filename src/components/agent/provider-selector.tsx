import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getProviderCatalog } from "@/lib/agent/providers/providers.functions";
import {
  PROVIDER_NAMES,
  eligibleModels,
  providerIdSchema,
  type ProviderId,
  type ProviderSelection,
} from "@/lib/agent/providers/contracts";

export function ProviderSelector({
  userId,
  workspaceId,
  selection,
  onChange,
  disabled,
}: {
  userId: string;
  workspaceId: string;
  selection: ProviderSelection | null;
  onChange: (value: ProviderSelection | null) => void;
  disabled: boolean;
}) {
  const getCatalog = useServerFn(getProviderCatalog);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(selection?.provider ?? "lovable-ai");
  const [model, setModel] = useState(selection?.model ?? "");
  const [consent, setConsent] = useState(false);
  const catalog = useQuery({
    queryKey: ["ai_provider_catalog", userId, workspaceId],
    enabled: open,
    queryFn: () => getCatalog({ data: { workspaceId } }),
  });
  const entry = catalog.data?.providers.find((p) => p.id === provider);
  const models = eligibleModels(entry?.models ?? []);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label="Configurar provedor do Life AI"
          className="max-w-full gap-2"
        >
          <Settings2 className="size-4 shrink-0" />
          <span className="truncate">
            {selection
              ? `${PROVIDER_NAMES[selection.provider]} · ${selection.model}`
              : "Selecionar IA"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[min(36rem,80dvh)] w-80 max-w-[calc(100vw-2rem)] space-y-4 overflow-y-auto"
      >
        <h3 className="font-semibold">Provedor do Life AI</h3>
        <label className="block space-y-2 text-sm">
          <span>Credencial</span>
          <Select value="shared">
            <SelectTrigger aria-label="Tipo de credencial">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Compartilhada neste espaço</SelectItem>
              <SelectItem value="personal" disabled>
                Pessoal · cofre indisponível
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="block space-y-2 text-sm">
          <span>Provedor</span>
          <Select
            value={provider}
            onValueChange={(v) => {
              setProvider(providerIdSchema.parse(v));
              setModel("");
              setConsent(false);
            }}
          >
            <SelectTrigger aria-label="Provedor de IA">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providerIdSchema.options.map((id) => (
                <SelectItem key={id} value={id}>
                  {PROVIDER_NAMES[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {catalog.isPending ? (
          <p className="text-sm text-muted-foreground">Consultando configuração…</p>
        ) : catalog.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">Não foi possível consultar os provedores.</p>
            <Button variant="outline" size="sm" onClick={() => void catalog.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {entry?.state === "catalog_error"
                ? "Catálogo indisponível. Nenhum modelo alternativo será usado."
                : entry?.configured
                  ? "Credencial configurada · validade e disponibilidade não verificadas."
                  : "Pendente de credencial compartilhada neste espaço."}
            </p>
            <label className="block space-y-2 text-sm">
              <span>Modelo com ferramentas</span>
              <Select
                value={model}
                onValueChange={(v) => {
                  setModel(v);
                  setConsent(false);
                }}
                disabled={!entry?.configured || !models.length}
              >
                <SelectTrigger aria-label="Modelo de IA">
                  <SelectValue placeholder="Selecione explicitamente" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-start gap-3 text-xs leading-relaxed">
              <Checkbox
                aria-label="Consentir envio de dados ao provedor"
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                disabled={!entry?.configured || !model}
                className="mt-0.5"
              />
              <span>
                Autorizo enviar o histórico desta conversa, nomes e dados acessíveis deste espaço,
                incluindo resultados das consultas internas, para {PROVIDER_NAMES[provider]} usando{" "}
                {model || "o modelo selecionado"}. A conversa continua compartilhada; o uso pode ser
                cobrado pelo provedor.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!consent || !entry?.configured || !models.some((m) => m.id === model)}
                onClick={() => {
                  onChange({
                    provider,
                    model,
                    scope: "shared",
                    consent: { userId, workspaceId, provider, model, accepted: true },
                  });
                  setOpen(false);
                }}
              >
                Usar nesta sessão
              </Button>
              {selection && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onChange(null);
                    setConsent(false);
                  }}
                >
                  Revogar
                </Button>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
