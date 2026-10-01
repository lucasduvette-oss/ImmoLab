import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/** Page ouverte depuis le lien « mot de passe oublié » reçu par email (l'utilisateur est alors connecté). */
export default async function ResetPasswordPage() {
  await requireUser();
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-xl">Nouveau mot de passe</CardTitle>
        <CardDescription>Choisissez votre nouveau mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  );
}
