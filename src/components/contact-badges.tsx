import { Badge } from "@/components/ui/badge";
import { BUYER_STAGES, CONTACT_ROLES, PARTNER_TYPES, SELLER_STAGES } from "@/lib/constants";
import type { Contact } from "@/lib/types";

const ROLE_STYLES: Record<string, string> = {
  vendeur: "bg-amber-100 text-amber-900",
  acquereur: "bg-sky-100 text-sky-900",
  prospect: "bg-violet-100 text-violet-900",
  partenaire: "bg-emerald-100 text-emerald-900",
};

/** Pastilles des rôles d'un contact (Vendeur, Acquéreur…). */
export function RoleBadges({ contact }: { contact: Pick<Contact, "roles" | "partner_type"> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {contact.roles.map((role) => (
        <Badge key={role} variant="secondary" className={ROLE_STYLES[role]}>
          {role === "partenaire" && contact.partner_type ? PARTNER_TYPES[contact.partner_type] : CONTACT_ROLES[role]}
        </Badge>
      ))}
    </span>
  );
}

/** Étapes des pipelines, affichées sous forme de texte court. */
export function StageBadges({ contact }: { contact: Pick<Contact, "seller_stage" | "buyer_stage"> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {contact.seller_stage && <Badge variant="outline">Vente : {SELLER_STAGES[contact.seller_stage]}</Badge>}
      {contact.buyer_stage && <Badge variant="outline">Achat : {BUYER_STAGES[contact.buyer_stage]}</Badge>}
    </span>
  );
}
