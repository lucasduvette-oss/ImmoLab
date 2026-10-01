import type { Metadata } from "next";

import { SignInForm } from "../auth-forms";

export const metadata: Metadata = { title: "Connexion" };

export default async function SignInPage({ searchParams }: PageProps<"/connexion">) {
  const { erreur } = await searchParams;
  return (
    <div className="grid gap-4">
      {erreur && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Le lien utilisé est invalide ou a expiré. Recommencez l&apos;opération.
        </p>
      )}
      <SignInForm />
    </div>
  );
}
