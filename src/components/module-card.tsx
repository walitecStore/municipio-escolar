import Link from "next/link";
import {
  Users,
  ClipboardList,
  Vote,
  ChartNoAxesCombined,
  FileText,
  Settings2,
  Image,
  KeyRound,
  School,
  ShieldCheck,
  CircleHelp,
  Plus,
  ChevronRight,
  LockKeyhole,
} from "lucide-react";
import type { ElectionModule, ModuleIcon } from "@/lib/election-navigation";
export const moduleIcons = {
  users: Users,
  roll: ClipboardList,
  vote: Vote,
  chart: ChartNoAxesCombined,
  document: FileText,
  settings: Settings2,
  image: Image,
  key: KeyRound,
  school: School,
  shield: ShieldCheck,
  help: CircleHelp,
  plus: Plus,
} satisfies Record<ModuleIcon, typeof Users>;
export function ModuleCard({ module }: { module: ElectionModule }) {
  const Icon = moduleIcons[module.icon];
  return (
    <Link className={`module-card tone-${module.tone}`} href={module.href}>
      <span className="module-symbol">
        <Icon size={34} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span className="module-copy">
        <strong>{module.title}</strong>
        <span>{module.description}</span>
        {module.locked && (
          <small>
            <LockKeyhole size={12} aria-hidden="true" />
            Disponible al cierre
          </small>
        )}
      </span>
      <span className="module-arrow">
        <ChevronRight size={22} aria-hidden="true" />
      </span>
    </Link>
  );
}
