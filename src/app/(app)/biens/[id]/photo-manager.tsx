"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CameraIcon, Loader2Icon, MoreVerticalIcon, StarIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PHOTOS_BUCKET } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { addPropertyPhoto, deletePropertyPhoto, setCoverPhoto } from "../actions";

export type PhotoItem = { id: string; url: string | null };

/**
 * Réduit une photo (max 1600 px, JPEG) avant l'envoi : plus rapide sur le réseau mobile
 * et économe en espace de stockage. L'orientation des photos de téléphone est respectée.
 */
async function resizeImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Conversion impossible"))), "image/jpeg", quality),
  );
}

/** Galerie de photos d'un bien : ajout (appareil photo ou galerie), photo principale, suppression. */
export function PhotoManager({ propertyId, userId, photos }: { propertyId: string; userId: string; photos: PhotoItem[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [, startTransition] = useTransition();

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const supabase = createClient();
    setUploading(files.length);
    let ok = 0;
    for (const file of Array.from(files)) {
      try {
        let blob: Blob;
        try {
          blob = await resizeImage(file);
        } catch {
          // Format non lisible par le navigateur : on envoie l'original s'il est accepté.
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Format de photo non pris en charge.");
          blob = file;
        }
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${userId}/${propertyId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg" });
        if (error) throw new Error(error.message);
        const result = await addPropertyPhoto(propertyId, path);
        if ("error" in result) throw new Error(result.error);
        ok++;
      } catch (e) {
        toast.error(`${file.name} : ${e instanceof Error ? e.message : "échec de l'envoi"}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
    if (ok) toast.success(ok > 1 ? `${ok} photos ajoutées.` : "Photo ajoutée.");
    router.refresh();
  }

  function run(action: () => Promise<{ error?: string } | { ok?: boolean }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result && result.error) toast.error(result.error);
      else toast.success(success);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {photos.map((photo, index) => (
          <div key={photo.id} className="relative aspect-[4/3] w-64 shrink-0 snap-start overflow-hidden rounded-lg bg-muted sm:w-72">
            {photo.url && (
              // eslint-disable-next-line @next/next/no-img-element -- photo privée servie par un lien temporaire Supabase
              <img src={photo.url} alt={`Photo ${index + 1}`} className="size-full object-cover" />
            )}
            {index === 0 && (
              <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">Principale</span>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="secondary" className="absolute top-2 right-2 bg-white/90" aria-label="Options de la photo">
                  <MoreVerticalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {index > 0 && (
                  <DropdownMenuItem onSelect={() => run(() => setCoverPhoto(photo.id), "Photo principale modifiée.")}>
                    <StarIcon /> Photo principale
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem variant="destructive" onSelect={() => run(() => deletePropertyPhoto(photo.id), "Photo supprimée.")}>
                  <Trash2Icon /> Supprimer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading > 0}
          className="flex aspect-[4/3] w-40 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-2 text-center text-sm text-muted-foreground hover:bg-accent"
        >
          {uploading > 0 ? <Loader2Icon className="size-6 animate-spin" /> : <CameraIcon className="size-6" />}
          {uploading > 0 ? `Envoi (${uploading})…` : "Ajouter des photos"}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
    </div>
  );
}
