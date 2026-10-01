import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ContactForm } from "../contact-form";

export const metadata: Metadata = { title: "Nouveau contact" };

export default function NewContactPage() {
  return (
    <>
      <PageHeader title="Nouveau contact" backHref="/contacts" />
      <ContactForm />
    </>
  );
}
