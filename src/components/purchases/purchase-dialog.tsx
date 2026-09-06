import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ContextSelect, NO_CONTEXT } from "@/components/quick/context-select";
import { useApp } from "@/features/app/app-context";
import {
  createPurchase,
  updatePurchase,
  isValidUrl,
  PERSON_SCOPES,
  PURCHASE_CATEGORIES,
  PURCHASE_PRIORITIES,
  PURCHASE_STATUSES,
  type PersonScope,
  type Purchase,
  type PurchasePriority,
  type PurchaseStatus,
} from "@/features/purchases/queries";
import { parseAmount } from "@/lib/format";

const NO_CATEGORY = "none";

export function PurchaseDialog({
  open,
  onOpenChange,
  purchase,
  defaultContextId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchase?: Purchase | null;
  defaultContextId?: string | null;
}) {
  const { workspaceId, userId, activeContextId } = useApp();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(NO_CATEGORY);
  const [budget, setBudget] = useState("");
  const [price, setPrice] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [priority, setPriority] = useState<PurchasePriority>("MEDIUM");
  const [status, setStatus] = useState<PurchaseStatus>("WANT_TO_BUY");
  const [desired, setDesired] = useState("");
  const [person, setPerson] = useState<PersonScope>("COUPLE");
  const [contextId, setContextId] = useState(NO_CONTEXT);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (purchase) {
      setTitle(purchase.title);
      setDescription(purchase.description ?? "");
      setCategory(purchase.category ?? NO_CATEGORY);
      setBudget(purchase.budget_amount == null ? "" : String(Number(purchase.budget_amount)).replace(".", ","));
      setPrice(purchase.found_price == null ? "" : String(Number(purchase.found_price)).replace(".", ","));
      setUrl(purchase.purchase_url ?? "");
      setImage(purchase.image_url ?? "");
      setPriority(purchase.priority as PurchasePriority);
      setStatus(purchase.status as PurchaseStatus);
      setDesired(purchase.desired_date ?? "");
      setPerson(purchase.person_scope as PersonScope);
      setContextId(purchase.context_id ?? NO_CONTEXT);
      setNotes(purchase.notes ?? "");
    } else {
      setTitle("");
      setDescription("");
      setCategory(NO_CATEGORY);
      setBudget("");
      setPrice("");
      setUrl("");
      setImage("");
      setPriority("MEDIUM");
      setStatus("WANT_TO_BUY");
      setDesired("");
      setPerson("COUPLE");
      setContextId(defaultContextId ?? activeContextId ?? NO_CONTEXT);
      setNotes("");
    }
  }, [open, purchase, defaultContextId, activeContextId]);

  async function handleSubmit() {
    if (!workspaceId || !userId) return;
    if (!title.trim()) {
      toast.error("Informe o nome da compra.");
      return;
    }
    if (url.trim() && !isValidUrl(url.trim())) {
      toast.error("Informe um link válido (começando com https://).");
      return;
    }
    if (image.trim() && !isValidUrl(image.trim())) {
      toast.error("Informe um endereço de imagem válido.");
      return;
    }
    setSaving(true);
    try {
      const input = {
        title: title.trim(),
        description: description.trim() || null,
        category: category === NO_CATEGORY ? null : category,
        budget_amount: budget.trim() ? parseAmount(budget) : null,
        found_price: price.trim() ? parseAmount(price) : null,
        purchase_url: url.trim() || null,
        image_url: image.trim() || null,
        priority,
        status,
        desired_date: desired || null,
        context_id: contextId === NO_CONTEXT ? null : contextId,
        person_scope: person,
        notes: notes.trim() || null,
        purchased_at:
          status === "PURCHASED"
            ? (purchase?.purchased_at ?? new Date().toISOString().slice(0, 10))
            : null,
      };
      if (purchase) await updatePurchase(purchase.id, input);
      else await createPurchase(workspaceId, userId, input);
      await queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(purchase ? "Compra atualizada." : "Compra adicionada.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const imagePreview = image.trim() && isValidUrl(image.trim()) ? image.trim() : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{purchase ? "Editar desejo" : "Quero isso 👀"}</DialogTitle>
          <DialogDescription>
            {purchase ? "Atualize os detalhes desse desejo." : "Vamos guardar essa ideia por aqui."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              O que vocês querem?
            </p>
            <div className="space-y-2">
              <Label htmlFor="purchase-title">Nome</Label>
              <Input
                id="purchase-title"
                placeholder="Karaokê, air fryer, viagem..."
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-12 text-base"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-description">Descrição</Label>
              <Input
                id="purchase-description"
                placeholder="Um dia precisamos comprar um desses 😂"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Quanto custa?
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="purchase-budget">Orçamento</Label>
                <Input
                  id="purchase-budget"
                  inputMode="decimal"
                  placeholder="Quanto vocês pretendem gastar?"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  className="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-price">Melhor preço encontrado</Label>
                <Input
                  id="purchase-price"
                  inputMode="decimal"
                  placeholder="Encontraram por quanto?"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className="numeric"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Onde encontramos?
            </p>
            <div className="space-y-2">
              <Label htmlFor="purchase-url">Link da compra</Label>
              <div className="flex gap-2">
                <Input
                  id="purchase-url"
                  inputMode="url"
                  placeholder="Cole o link da loja aqui..."
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                {url.trim() && isValidUrl(url.trim()) ? (
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href={url.trim()} target="_blank" rel="noreferrer noopener">
                      Abrir
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-image">Imagem do produto</Label>
              <Input
                id="purchase-image"
                inputMode="url"
                placeholder="Cole o link da imagem..."
                value={image}
                onChange={(event) => setImage(event.target.value)}
              />
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Prévia do produto"
                  className="max-h-44 w-full rounded-xl border border-border object-cover animate-in fade-in duration-300"
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Como está essa compra?
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhuma" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Nenhuma</SelectItem>
                    {PURCHASE_CATEGORIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.emoji} {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={priority} onValueChange={(value) => setPriority(value as PurchasePriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURCHASE_PRIORITIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.emoji} {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as PurchaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.emoji} {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Mais detalhes
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Pessoa</Label>
                <Select value={person} onValueChange={(value) => setPerson(value as PersonScope)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSON_SCOPES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.emoji} {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchase-desired">Data desejada</Label>
                <Input
                  id="purchase-desired"
                  type="date"
                  value={desired}
                  onChange={(event) => setDesired(event.target.value)}
                />
              </div>
            </div>

            <ContextSelect value={contextId} onChange={setContextId} />

            <div className="space-y-2">
              <Label htmlFor="purchase-notes">Observações</Label>
              <Textarea
                id="purchase-notes"
                rows={3}
                placeholder="Detalhes, modelos, comparações..."
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </section>

          <Button className="h-12 w-full" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Salvando..." : purchase ? "Salvar alterações" : "Adicionar à wishlist"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

