"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LOGOS_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { removeProfileLogo, setProfileLogo } from "./actions";

/** Réduit le logo (600 px max) et le convertit en PNG (transparence conservée), format accepté par le PDF. */
async function toPng(file: File, maxSize = 600): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), "image/png"));
}

/** Logo de l'agence affiché en tête du rapport d'estimation PDF. */
export function LogoUploader({ userId, logoUrl }: { userId: string; logoUrl: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, startRemove] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const storage = createClient().storage.from(LOGOS_BUCKET);
    const path = `${userId}/logo-${crypto.randomUUID()}.png`;
    try {
      const png = await toPng(file);
      const { error } = await storage.upload(path, png, { contentType: "image/png" });
      if (error) throw new Error("Échec de l'envoi du logo (image PNG ou JPEG de 2 Mo au plus).");
      const result = await setProfileLogo(path);
      if ("error" in result) {
        // Le fichier envoyé ne sera pas utilisé : on le supprime.
        await storage.remove([path]);
        throw new Error(result.error);
      }
      toast.success("Logo enregistré.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'envoi du logo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-20 w-40 items-center justify-center overflow-hidden rounded-lg border bg-white p-2">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo privé servi par un lien temporaire Supabase
          <img src={logoUrl} alt="Logo de l'agence" className="max-h-full max-w-full object-contain" />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          {logoUrl ? "Changer le logo" : "Ajouter un logo"}
        </Button>
        {logoUrl && (
          <Button
            type="button"
            variant="ghost"
            disabled={removing}
            onClick={() =>
              startRemove(async () => {
                const result = await removeProfileLogo();
                if ("error" in result) toast.error(result.error);
                else toast.success("Logo retiré.");
              })
            }
          >
            <Trash2Icon /> Retirer
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  );
}
