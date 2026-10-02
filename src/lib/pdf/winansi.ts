/**
 * Préparation du texte pour la police Helvetica du PDF.
 *
 * Helvetica (police standard des PDF) n'affiche que les caractères du jeu « WinAnsi » (Windows-1252) :
 * tout le français y est (é, è, ç, œ, «, », €, …), mais pas les flèches, les emoji, certaines lettres
 * d'Europe de l'Est, etc. Un caractère absent serait remplacé par un autre sans prévenir
 * (« → » devient « ’ », « ≥ » devient « e »). On remplace donc ces caractères par un équivalent
 * lisible, ou on les retire.
 */

/** Caractères de Windows-1252 situés hors de l'intervalle Latin-1 (0x80 à 0x9F). */
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function isWinAnsi(char: string): boolean {
  const code = char.codePointAt(0)!;
  return code === 0x0a || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.includes(char);
}

/** Équivalents lisibles des caractères courants absents de WinAnsi. */
const REPLACEMENTS: Record<string, string> = {
  " ": " ", // espace fine insécable (séparateur des milliers en français)
  " ": " ", // espace numérique
  " ": " ", // espace fine
  " ": " ",
  " ": " ",
  " ": " ",
  "\t": " ",
  "‐": "-",
  "‑": "-", // trait d'union insécable
  "‒": "–",
  "―": "—",
  "−": "-", // signe moins
  "⁄": "/",
  "′": "'",
  "″": '"',
  "‛": "’",
  "‟": "”",
  "→": "->",
  "←": "<-",
  "↔": "<->",
  "⇒": "=>",
  "➔": "->",
  "➜": "->",
  "➡": "->",
  "≤": "<=",
  "≥": ">=",
  "≈": "~",
  "≠": "!=",
  "✓": "•", // coches utilisées comme puces
  "✔": "•",
  "✅": "•",
  "☑": "•",
  "●": "•",
  "▪": "•",
  "■": "•",
  "◦": "•",
  "‣": "•",
  "⁃": "•",
  "▸": "•",
  "►": "•",
  "➢": "•",
  "✗": "x",
  "✘": "x",
  "❌": "x",
  "№": "N°",
  "Ł": "L",
  "ł": "l",
  "Đ": "D",
  "đ": "d",
  "ı": "i",
  "Ħ": "H",
  "ħ": "h",
};

/** Texte prêt pour Helvetica : caractères remplacés par un équivalent, ou retirés s'ils n'en ont pas (emoji…). */
export function toWinAnsi(value: string): string {
  let out = "";
  let removed = false;
  for (const char of value.replace(/\r\n?/g, "\n")) {
    if (isWinAnsi(char)) {
      out += char;
      continue;
    }
    const replacement = REPLACEMENTS[char];
    if (replacement !== undefined) {
      out += replacement;
      continue;
    }
    // Lettres accentuées d'autres langues (ř, ő, ș…) : lettre de base sans l'accent.
    const base = [...char.normalize("NFKD").replace(/[̀-ͯ]/g, "")].filter(isWinAnsi).join("");
    if (base) out += base;
    else removed = true;
  }
  // Un emoji retiré entre deux mots laisserait un double espace.
  return removed ? out.replace(/ {2,}/g, " ") : out;
}
