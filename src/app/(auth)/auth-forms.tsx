"use client";

import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormMessage, SubmitButton, useFormAction } from "@/components/form-fields";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./actions";

export function SignInForm() {
  const { state, onSubmit, pending } = useFormAction(signIn);
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-xl">Connexion</CardTitle>
        <CardDescription>Accédez à votre espace personnel.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormMessage state={state} />
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
          <Field label="Mot de passe" htmlFor="password" error={state.fieldErrors?.password}>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton pending={pending} pendingLabel="Connexion…">Se connecter</SubmitButton>
          <div className="flex flex-col items-center gap-2 text-sm">
            <Link href="/mot-de-passe-oublie" className="text-primary hover:underline">
              Mot de passe oublié ?
            </Link>
            <span className="text-muted-foreground">
              Pas encore de compte ?{" "}
              <Link href="/inscription" className="text-primary hover:underline">
                Créer un compte
              </Link>
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function SignUpForm() {
  const { state, onSubmit, pending } = useFormAction(signUp);
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-xl">Créer un compte</CardTitle>
        <CardDescription>Vos données ne seront visibles que par vous.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormMessage state={state} />
          <Field label="Prénom et nom" htmlFor="fullName" error={state.fieldErrors?.fullName}>
            <Input id="fullName" name="fullName" autoComplete="name" required />
          </Field>
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
          <Field
            label="Mot de passe"
            htmlFor="password"
            error={state.fieldErrors?.password}
            hint="8 caractères minimum."
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <SubmitButton pending={pending} pendingLabel="Création…">Créer mon compte</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href="/connexion" className="text-primary hover:underline">
              Se connecter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm() {
  const { state, onSubmit, pending } = useFormAction(requestPasswordReset);
  return (
    <Card>
      <CardHeader className="flex-col">
        <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
        <CardDescription>Recevez un lien pour choisir un nouveau mot de passe.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <FormMessage state={state} />
          <Field label="Email" htmlFor="email" error={state.fieldErrors?.email}>
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
          </Field>
          <SubmitButton pending={pending} pendingLabel="Envoi…">Envoyer le lien</SubmitButton>
          <Link href="/connexion" className="text-center text-sm text-primary hover:underline">
            Retour à la connexion
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}

export function UpdatePasswordForm({ backHref = "/" }: { backHref?: string }) {
  const { state, onSubmit, pending } = useFormAction(updatePassword);
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <FormMessage state={state} />
      <Field label="Nouveau mot de passe" htmlFor="password" error={state.fieldErrors?.password} hint="8 caractères minimum.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirmez le mot de passe" htmlFor="confirm" error={state.fieldErrors?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pending={pending}>Enregistrer le mot de passe</SubmitButton>
      {state.success && (
        <Link href={backHref} className="text-center text-sm text-primary hover:underline">
          Continuer
        </Link>
      )}
    </form>
  );
}
