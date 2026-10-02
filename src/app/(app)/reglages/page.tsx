import type { Metadata } from "next";
import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { LOGOS_BUCKET } from "@/lib/constants";
import { requireUser } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { signOut } from "@/app/(auth)/actions";
import { UpdatePasswordForm } from "@/app/(auth)/auth-forms";
import { LogoUploader } from "./logo-uploader";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const { supabase, userId, email } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle<Profile>();
  const { data: logo } = profile?.logo_path
    ? await supabase.storage.from(LOGOS_BUCKET).createSignedUrl(profile.logo_path, 3600)
    : { data: null };

  return (
    <>
      <PageHeader title="Réglages" description={`Connecté avec ${email}`} />
      <div className="grid gap-6">
        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Mon profil</CardTitle>
            <CardDescription>Ces informations apparaissent sur vos rapports d&apos;estimation.</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm profile={profile} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Logo de l&apos;agence</CardTitle>
            <CardDescription>Affiché en tête des rapports d&apos;estimation (PNG ou JPEG).</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoUploader userId={userId} logoUrl={logo?.signedUrl ?? null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col">
            <CardTitle>Mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <UpdatePasswordForm backHref="/reglages" />
          </CardContent>
        </Card>

        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full text-destructive sm:w-fit">
            <LogOutIcon />
            Se déconnecter
          </Button>
        </form>
      </div>
    </>
  );
}
