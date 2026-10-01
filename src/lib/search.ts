/**
 * Prépare un texte de recherche saisi par l'utilisateur pour le comparer à la colonne
 * search_text de la base (minuscules, sans accents). Les numéros de téléphone sont
 * comparés sans espaces ni points.
 */
export function normalizeSearch(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  // « 06 12 34 » → « 061234 » si la saisie ne contient que des chiffres et séparateurs
  if (/^[\d\s.+-]+$/.test(base)) return base.replace(/[^\d]/g, "");
  // Les caractères spéciaux du filtre « like » sont neutralisés.
  return base.replace(/[%_\\]/g, " ").replace(/\s+/g, " ");
}
