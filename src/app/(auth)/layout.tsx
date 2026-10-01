import { HouseIcon } from "lucide-react";

/** Mise en page des écrans de connexion : un formulaire centré sous le logo. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-2 text-primary">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <HouseIcon className="size-5" />
        </span>
        <span className="text-2xl font-bold tracking-tight">ImmoLab</span>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
