import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ImmoLab",
    template: "%s · ImmoLab",
  },
  description: "L'assistant personnel de l'agent immobilier : contacts, biens, relances et estimations DVF.",
  applicationName: "ImmoLab",
  appleWebApp: {
    capable: true,
    title: "ImmoLab",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2f4fd8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
