import { CalendarIcon, DoorOpenIcon, MailIcon, MessageSquareIcon, PhoneIcon, StickyNoteIcon } from "lucide-react";

import type { InteractionKind } from "@/lib/constants";

const ICONS = {
  appel: PhoneIcon,
  sms: MessageSquareIcon,
  email: MailIcon,
  rdv: CalendarIcon,
  visite: DoorOpenIcon,
  note: StickyNoteIcon,
} satisfies Record<InteractionKind, React.ComponentType<{ className?: string }>>;

/** Icône correspondant au type d'échange. */
export function InteractionIcon({ kind, className }: { kind: InteractionKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}
