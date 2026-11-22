import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { Ornament, useWeddingTheme } from "@/components/wedding/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeCode } from "@/features/wedding/guest-contracts";

export const Route = createFileRoute("/convite/")({
  head: () => ({
    meta: [
      { title: "Seu convite de casamento" },
      { name: "description", content: "Digite o código do seu convite para responder." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Seu convite de casamento" },
      { property: "og:description", content: "Responda ao convite com o seu código." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CodeEntry,
});

function CodeEntry() {
  useWeddingTheme(undefined);
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const clean = normalizeCode(code);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4 text-foreground">
      <form
        className="wed-card w-full max-w-sm space-y-5 p-6 text-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (clean.length >= 6) void navigate({ to: "/convite/$token", params: { token: clean } });
        }}
      >
        <div className="flex items-center justify-center gap-2 text-primary">
          <Ornament />
          <Heart className="size-5" aria-hidden />
          <Ornament />
        </div>
        <h1 className="wed-display text-3xl">Seu convite</h1>
        <div className="space-y-1.5 text-left">
          <Label htmlFor="code">Código do convite</Label>
          <Input
            id="code"
            className="h-12 text-center text-lg uppercase tracking-[0.2em]"
            autoComplete="off"
            placeholder="XXXX-XXXX"
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-12 w-full" disabled={clean.length < 6}>
          Abrir convite
        </Button>
      </form>
    </main>
  );
}
