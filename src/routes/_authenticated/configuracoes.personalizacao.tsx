import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, Star } from "lucide-react";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NAV_GROUPS } from "@/features/app/navigation";
import {
  DEFAULT_PREFERENCES,
  usePreferences,
  useSavePreferences,
  type Preferences,
} from "@/features/preferences/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configuracoes/personalizacao")({
  head: () => ({
    meta: [
      { title: "Personalização — Life OS" },
      {
        name: "description",
        content: "Ordem do menu, módulos visíveis, favoritos e tela inicial.",
      },
      { property: "og:title", content: "Personalização — Life OS" },
      { property: "og:description", content: "Deixe o Life OS do seu jeito." },
    ],
  }),
  component: Personalizacao,
});

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function Personalizacao() {
  const prefs = usePreferences().data ?? DEFAULT_PREFERENCES;
  const save = useSavePreferences();

  function update(patch: Partial<Preferences>, message = "Preferência salva.") {
    save.mutate(patch, {
      onSuccess: () => toast.success(message),
      onError: (e) => toast.error(e.message),
    });
  }

  function move(groupItems: string[], to: string, dir: -1 | 1) {
    const order = ALL_ITEMS.map((i) => i.to).sort((a, b) => rank(a) - rank(b));
    const local = groupItems.slice().sort((a, b) => rank(a) - rank(b));
    const index = local.indexOf(to);
    const swap = local[index + dir];
    if (!swap) return;
    const ia = order.indexOf(to);
    const ib = order.indexOf(swap);
    [order[ia], order[ib]] = [order[ib]!, order[ia]!];
    update({ nav_order: order }, "Ordem atualizada.");
  }

  function rank(to: string) {
    const i = prefs.nav_order.indexOf(to);
    return i === -1 ? 1000 + ALL_ITEMS.findIndex((item) => item.to === to) : i;
  }

  const isFav = (to: string) => prefs.favorites.some((f) => f.to === to);

  return (
    <div className="space-y-6">
      <PageHeader title="Personalização" subtitle="Só muda o seu menu. Ocultar não apaga nada." />

      <Panel className="space-y-2">
        <PanelTitle>Tela inicial</PanelTitle>
        <Label className="sr-only">Tela inicial</Label>
        <Select
          value={prefs.home_route}
          onValueChange={(home_route) => update({ home_route }, "Tela inicial salva.")}
        >
          <SelectTrigger className="sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALL_ITEMS.map((item) => (
              <SelectItem key={item.to} value={item.to}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Abre ao entrar no Life OS.</p>
      </Panel>

      <Panel>
        <PanelTitle
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                update({ nav_order: [], nav_hidden: [], favorites: [] }, "Menu restaurado.")
              }
            >
              Restaurar padrão
            </Button>
          }
        >
          Minha navegação
        </PanelTitle>
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => {
            const items = group.items.slice().sort((a, b) => rank(a.to) - rank(b.to));
            return (
              <div key={group.label}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {group.label}
                </p>
                <ul className="divide-y divide-border">
                  {items.map((item, index) => {
                    const hidden = prefs.nav_hidden.includes(item.to);
                    return (
                      <li
                        key={item.to}
                        className={cn("flex items-center gap-2 py-2", hidden && "opacity-50")}
                      >
                        <item.icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          aria-label={`Subir ${item.label}`}
                          disabled={index === 0}
                          onClick={() =>
                            move(
                              group.items.map((i) => i.to),
                              item.to,
                              -1,
                            )
                          }
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          aria-label={`Descer ${item.label}`}
                          disabled={index === items.length - 1}
                          onClick={() =>
                            move(
                              group.items.map((i) => i.to),
                              item.to,
                              1,
                            )
                          }
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          aria-label={
                            isFav(item.to)
                              ? `Remover ${item.label} dos favoritos`
                              : `Favoritar ${item.label}`
                          }
                          onClick={() =>
                            update({
                              favorites: isFav(item.to)
                                ? prefs.favorites.filter((f) => f.to !== item.to)
                                : [...prefs.favorites, { kind: "module", to: item.to }],
                            })
                          }
                        >
                          <Star
                            className={cn("size-4", isFav(item.to) && "fill-primary text-primary")}
                          />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          aria-label={hidden ? `Mostrar ${item.label}` : `Ocultar ${item.label}`}
                          onClick={() =>
                            update({
                              nav_hidden: hidden
                                ? prefs.nav_hidden.filter((to) => to !== item.to)
                                : [...prefs.nav_hidden, item.to],
                            })
                          }
                        >
                          {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Módulos ocultos continuam acessíveis pela busca (Ctrl+K) e pelos links do app.
        </p>
      </Panel>
    </div>
  );
}
