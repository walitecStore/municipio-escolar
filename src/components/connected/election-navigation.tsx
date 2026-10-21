"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { moduleIcons } from "@/components/module-card";
import type { ElectionModule } from "@/lib/election-navigation";
export function ElectionNavigation({
  id,
  modules,
}: {
  id: string;
  modules: ElectionModule[];
}) {
  const path = usePathname();
  const base = `/sistema/${id}`;
  if (path === base) return null;
  return (
    <nav className="election-tabs" aria-label="Navegación de la elección">
      <Link href={base} className="election-tab">
        <LayoutDashboard size={17} aria-hidden="true" />
        <span>Resumen</span>
      </Link>
      {modules.map((m) => {
        const Icon = moduleIcons[m.icon];
        return (
          <Link
            key={m.key}
            href={m.href}
            className={`election-tab ${path === m.href ? "selected" : ""}`}
            aria-current={path === m.href ? "page" : undefined}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{m.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
