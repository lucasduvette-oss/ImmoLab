import type { ZodError } from "zod";

/**
 * État renvoyé par les Server Actions de formulaire (utilisé avec useActionState).
 * - error : message général affiché en haut du formulaire
 * - fieldErrors : message par champ (clé = attribut name du champ)
 * - success : message de confirmation éventuel
 */
export type FormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** Transforme les erreurs de validation Zod en messages par champ. */
export function zodFieldErrors(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Merci de corriger les champs signalés.", fieldErrors };
}

/** Lit un champ texte : chaîne vide → null. */
export function str(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Lit un nombre saisi en français (« 350 000 », « 72,5 ») : vide → null. */
export function num(formData: FormData, name: string): number | null {
  const v = str(formData, name);
  if (v === null) return null;
  const n = Number(v.replace(/\s/g, "").replace(/\u00a0/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Case à cocher : cochée → true. */
export function bool(formData: FormData, name: string): boolean {
  const v = formData.get(name);
  return v === "on" || v === "true" || v === "1";
}

/** Valeurs multiples (cases à cocher portant le même name). */
export function list(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

/** Message d'erreur lisible à partir d'une erreur Supabase/Postgres. */
export function dbErrorMessage(error: { message?: string; code?: string } | null): string {
  if (!error) return "Une erreur inconnue est survenue.";
  if (error.code === "23503") return "Élément lié introuvable (il a peut-être été supprimé).";
  if (error.code === "23505") return "Cet élément existe déjà.";
  if (error.code === "42501") return "Accès refusé.";
  return `Erreur lors de l'enregistrement : ${error.message ?? "inconnue"}`;
}
