import { MailIcon, MessageSquareIcon, PhoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { phoneHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Boutons « Appeler », « SMS » et « Mail ».
 * Sur téléphone, les liens tel: et sms: ouvrent directement l'application d'appel ou de messages.
 */
export function ContactActions({
  phone,
  email,
  compact = false,
  className,
}: {
  phone: string | null;
  email?: string | null;
  compact?: boolean;
  className?: string;
}) {
  if (!phone && !email) return null;
  const size = compact ? "icon" : "default";
  return (
    <div className={cn("flex gap-2", className)}>
      {phone && (
        <>
          <Button asChild size={size} variant={compact ? "outline" : "default"} className={compact ? "" : "flex-1"}>
            <a href={`tel:${phoneHref(phone)}`} aria-label="Appeler">
              <PhoneIcon />
              {!compact && "Appeler"}
            </a>
          </Button>
          <Button asChild size={size} variant="outline" className={compact ? "" : "flex-1"}>
            <a href={`sms:${phoneHref(phone)}`} aria-label="Envoyer un SMS">
              <MessageSquareIcon />
              {!compact && "SMS"}
            </a>
          </Button>
        </>
      )}
      {email && (
        <Button asChild size={size} variant="outline" className={compact ? "" : "flex-1"}>
          <a href={`mailto:${email}`} aria-label="Envoyer un mail">
            <MailIcon />
            {!compact && "Mail"}
          </a>
        </Button>
      )}
    </div>
  );
}
