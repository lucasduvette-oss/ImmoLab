"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BellIcon,
  BuildingIcon,
  CalculatorIcon,
  CheckSquareIcon,
  HouseIcon,
  KanbanIcon,
  MenuIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badgeKey?: "matches" };

/** Entrées de la barre basse (téléphone). « Plus » donne accès au reste. */
const MOBILE_ITEMS: NavItem[] = [
  { href: "/", label: "Ma journée", icon: SunIcon },
  { href: "/contacts", label: "Contacts", icon: UsersIcon },
  { href: "/biens", label: "Biens", icon: BuildingIcon },
  { href: "/taches", label: "Tâches", icon: CheckSquareIcon },
  { href: "/plus", label: "Plus", icon: MenuIcon, badgeKey: "matches" },
];

/** Entrées du menu latéral (ordinateur). */
const DESKTOP_ITEMS: NavItem[] = [
  { href: "/", label: "Ma journée", icon: SunIcon },
  { href: "/contacts", label: "Contacts", icon: UsersIcon },
  { href: "/contacts/pipeline", label: "Pipelines", icon: KanbanIcon },
  { href: "/biens", label: "Biens", icon: BuildingIcon },
  { href: "/taches", label: "Tâches", icon: CheckSquareIcon },
  { href: "/correspondances", label: "Correspondances", icon: BellIcon, badgeKey: "matches" },
  { href: "/estimations", label: "Estimations", icon: CalculatorIcon },
  { href: "/reglages", label: "Réglages", icon: SettingsIcon },
];

/** Indique si un lien correspond à la page affichée. */
function isActive(pathname: string, href: string, items: NavItem[]) {
  if (href === "/") return pathname === "/";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  // Si une entrée plus précise correspond (ex. /contacts/pipeline), c'est elle qui est active.
  return !items.some((i) => i.href !== href && i.href.startsWith(href) && pathname.startsWith(i.href));
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="min-w-5 rounded-full bg-destructive px-1.5 text-center text-[11px] leading-5 font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function DesktopSidebar({ newMatches }: { newMatches: number }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-card md:flex">
      <Link href="/" className="flex items-center gap-2 px-5 py-5 text-primary">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <HouseIcon className="size-4" />
        </span>
        <span className="text-lg font-bold tracking-tight">ImmoLab</span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {DESKTOP_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, DESKTOP_ITEMS);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                active && "bg-accent text-primary",
              )}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.badgeKey === "matches" && <Badge count={newMatches} />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileBottomNav({ newMatches }: { newMatches: number }) {
  const pathname = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {MOBILE_ITEMS.map((item) => {
          const active =
            item.href === "/plus"
              ? ["/plus", "/correspondances", "/estimations", "/reglages"].some((p) => pathname.startsWith(p))
              : isActive(pathname, item.href, MOBILE_ITEMS);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
                {item.badgeKey === "matches" && newMatches > 0 && (
                  <span className="absolute top-2 right-[calc(50%-18px)] size-2.5 rounded-full bg-destructive" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
