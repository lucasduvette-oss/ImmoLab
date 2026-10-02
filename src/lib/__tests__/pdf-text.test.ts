import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { imageSize, isUsableImage } from "@/lib/pdf/image-size";
import { toWinAnsi } from "@/lib/pdf/winansi";

describe("texte du PDF (police Helvetica)", () => {
  it("garde tout le français, l'euro et la ponctuation typographique", () => {
    const text = "Œuvre « ancienne » à 2 € : très lumineux, rez-de-chaussée… — 75 m² — l’été, ça « va »";
    expect(toWinAnsi(text)).toBe(text);
    expect(toWinAnsi("ligne 1\nligne 2")).toBe("ligne 1\nligne 2");
  });

  it("remplace les caractères courants absents de la police", () => {
    expect(toWinAnsi("350 000 €")).toBe("350 000 €");
    expect(toWinAnsi("Prix ≥ marché → justifié ≤ 5 %")).toBe("Prix >= marché -> justifié <= 5 %");
    expect(toWinAnsi("−5 %")).toBe("-5 %");
    expect(toWinAnsi("✓ Lumineux ✅ Calme")).toBe("• Lumineux • Calme");
    expect(toWinAnsi("Łukasz Dvořák, Ștefan")).toBe("Lukasz Dvorák, Stefan") // « á » existe dans la police, « ř » non;
    expect(toWinAnsi("a\r\nb\tc")).toBe("a\nb c");
  });

  it("retire les emoji sans laisser de double espace", () => {
    expect(toWinAnsi("Très lumineux 👍 vue dégagée")).toBe("Très lumineux vue dégagée");
    expect(toWinAnsi("Top 👍🏽❤️")).toBe("Top ");
  });
});

/** PNG minimal (en-tête + IHDR) aux dimensions voulues. */
function png(width: number, height: number) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    return Buffer.concat([len, Buffer.from(type, "ascii"), data, Buffer.alloc(4)]);
  };
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.alloc(16))),
  ]);
}

/** JPEG minimal : SOI, un segment APP0, puis SOF0 avec les dimensions. */
function jpeg(width: number, height: number) {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

describe("images du PDF", () => {
  it("lit les dimensions d'un PNG et d'un JPEG sans les décoder", () => {
    expect(imageSize(png(600, 200))).toEqual({ type: "png", width: 600, height: 200 });
    expect(imageSize(jpeg(1600, 1200))).toEqual({ type: "jpeg", width: 1600, height: 1200 });
    expect(imageSize(Buffer.from("GIF89a..........................."))).toBeNull();
  });

  it("refuse les images démesurées (risque de saturation mémoire)", () => {
    expect(isUsableImage(png(600, 200))).toBe(true);
    expect(isUsableImage(jpeg(4000, 3000))).toBe(true);
    expect(isUsableImage(png(22000, 22000))).toBe(false);
    expect(isUsableImage(png(0, 10))).toBe(false);
  });
});
