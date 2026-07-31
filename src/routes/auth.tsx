import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";



const searchSchema = z.object({
  redirect: z.string().optional(),
  invite: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Entrar — TotalControle ERP" },
      { name: "description", content: "Acesse sua conta no TotalControle ERP." },
    ],
  }),
  component: AuthPage,
});

/** No app nativo (APK) o OAuth abre o navegador externo e não volta para o app,
 *  então usamos apenas login por e-mail/senha dentro do próprio aplicativo. */
function detectNativeApp() {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  if (w.Capacitor?.isNativePlatform?.()) return true;
  return /(Median|Capacitor|TotalControleApp)/i.test(navigator.userAgent || "");
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(detectNativeApp());
  }, []);


  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      if (sess) {
        const target = search.invite ? `/onboarding?invite=${search.invite}` : (search.redirect ?? "/app");
        navigate({ to: target, replace: true });
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        const target = search.invite ? `/onboarding?invite=${search.invite}` : (search.redirect ?? "/app");
        navigate({ to: target, replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, search.redirect, search.invite]);

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google", { description: String(result.error.message ?? result.error) });
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error("Não foi possível entrar", { description: error.message });
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/auth" },
    });
    setLoading(false);
    if (error) toast.error("Não foi possível criar a conta", { description: error.message });
    else toast.success("Conta criada", { description: "Verifique seu e-mail se a confirmação estiver ativa." });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <ThemeToggle floating />
      <Card className="w-full max-w-md">

        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-hero p-3 shadow-elegant">
            <BrandLogo className="h-full w-full object-contain" />
          </div>
          <CardTitle className="text-2xl">TotalControle ERP</CardTitle>
          <CardDescription>Acesse sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleGoogle} disabled={loading} variant="outline" className="w-full">
            Entrar com Google
          </Button>
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <form onSubmit={handleEmailSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Entrar</Button>
                <div className="text-center text-sm">
                  <Link to="/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
                    Esqueci minha senha
                  </Link>
                </div>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleEmailSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email2">E-mail</Label>
                  <Input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password2">Senha</Label>
                  <Input id="password2" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full">Criar conta</Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
