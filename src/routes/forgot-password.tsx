import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Recuperar senha — TotalControle ERP" },
      { name: "description", content: "Recupere o acesso à sua conta do TotalControle ERP." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail", { description: error.message });
    } else {
      setSent(true);
      toast.success("E-mail enviado", { description: "Verifique sua caixa de entrada." });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-hero p-3 shadow-elegant">
            <BrandLogo className="h-full w-full object-contain" />
          </div>
          <CardTitle>Recuperar senha</CardTitle>
          <CardDescription>
            {sent
              ? "Enviamos um link de redefinição para seu e-mail."
              : "Informe seu e-mail e enviaremos um link para redefinir sua senha."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!sent && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </form>
          )}
          <div className="text-center text-sm">
            <Link to="/auth" className="text-primary hover:underline">
              Voltar para o login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
