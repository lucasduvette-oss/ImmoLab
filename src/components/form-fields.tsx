"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/form";

/** Bloc « libellé + champ + message d'erreur ». */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Bouton d'envoi qui affiche un indicateur pendant l'enregistrement. */
export function SubmitButton({
  children,
  pendingLabel = "Enregistrement…",
  className,
  pending: pendingProp,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || props.disabled} className={className} {...props}>
      {pending && <Loader2Icon className="animate-spin" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Message général d'erreur ou de succès d'un formulaire. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p role="status" className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">
        {state.success}
      </p>
    );
  return null;
}

/** Case à cocher native avec libellé (fonctionne directement dans les formulaires). */
export function CheckboxField({
  name,
  label,
  defaultChecked,
  value,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  value?: string;
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

/**
 * Relie un formulaire à une Server Action SANS vider les champs après l'envoi
 * (comportement par défaut de React 19 quand on utilise <form action={...}>).
 * Ainsi, en cas d'erreur, l'utilisateur ne perd pas sa saisie.
 *
 * Utilisation : const { state, onSubmit, pending } = useFormAction(monAction, { onSuccess });
 *               <form onSubmit={onSubmit}> … <SubmitButton pending={pending}> …
 * `onSuccess` est appelé quand l'action renvoie un message de succès (ex. fermer une fenêtre).
 */
export function useFormAction(
  action: (prev: FormState, formData: FormData) => Promise<FormState>,
  options: { onSuccess?: (state: FormState) => void } = {},
) {
  const [state, setState] = React.useState<FormState>({});
  const [pending, startTransition] = React.useTransition();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(async () => {
      // Si l'action redirige (redirect()), Next.js change de page et la suite n'est pas exécutée.
      const result = (await action(state, formData)) ?? {};
      startTransition(() => setState(result));
      if (result.success) options.onSuccess?.(result);
    });
  };

  return { state, onSubmit, pending, reset: () => setState({}) };
}
