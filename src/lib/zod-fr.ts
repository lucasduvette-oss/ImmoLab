import { z } from "zod";

/**
 * Messages d'erreur par défaut de zod en français (pour les règles sans message personnalisé).
 * Importé une fois par les modules de validation (form.ts, estimation-schema.ts).
 */
z.config(z.locales.fr());
