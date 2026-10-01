import type { Metadata } from "next";

import { SignUpForm } from "../auth-forms";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignUpPage() {
  return <SignUpForm />;
}
