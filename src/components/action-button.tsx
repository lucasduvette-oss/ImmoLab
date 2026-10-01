"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Bouton qui exécute une Server Action simple et affiche un message de confirmation. */
export function ActionButton({
  action,
  success,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "action"> & {
  action: () => Promise<{ error?: string } | { ok?: boolean } | void>;
  success?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      {...props}
      disabled={pending || props.disabled}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result && "error" in result && result.error) toast.error(result.error);
          else if (success) toast.success(success);
        })
      }
    >
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}
