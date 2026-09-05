import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/features/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no Life OS" },
      { name: "description", content: "Acesse sua conta do Life OS." },
      { property: "og:title", content: "Entrar no Life OS" },
      { property: "og:description", content: "Acesse sua conta do Life OS." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [loading, user, navigate]);

  async function signIn() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp() {
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin, data: { name } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      setAwaitingConfirm(true);
      toast.success("Confira seu e-mail para confirmar a conta.");
    }
  }

  async function signInWithGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return toast.error("Não foi possível entrar com o Google.");
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  async function resetPassword() {
    if (!email) return toast.error("Informe seu e-mail primeiro.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success("Enviamos um link de recuperação.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
            L
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Life OS</h1>
          <p className="text-sm text-muted-foreground">Sua vida, organizada em um só lugar.</p>
        </div>

        {awaitingConfirm ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>
            . Confirme para começar a usar o Life OS.
          </div>
        ) : (
          <Tabs defaultValue="signin">
            <TabsList className="w-full">
              <TabsTrigger className="flex-1" value="signin">
                Entrar
              </TabsTrigger>
              <TabsTrigger className="flex-1" value="signup">
                Criar conta
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={signIn}>
                Entrar
              </Button>
              <button
                type="button"
                onClick={resetPassword}
                className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-up">E-mail</Label>
                <Input
                  id="email-up"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password-up">Senha</Label>
                <Input
                  id="password-up"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <Button className="w-full" disabled={busy} onClick={signUp}>
                Criar conta
              </Button>
            </TabsContent>
          </Tabs>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            ou
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
            Continuar com Google
          </Button>
        </div>
      </div>
    </div>
  );
}
