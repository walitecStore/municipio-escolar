import {
  BookUser,
  UsersRound,
  MonitorCheck,
  ShieldCheck,
  Settings2,
  ImagePlus,
  KeyRound,
  ClipboardCheck,
  Vote,
  FileText,
} from "lucide-react";
import type { ReactNode } from "react";
const icons = {
  roll: BookUser,
  team: UsersRound,
  stations: MonitorCheck,
  security: ShieldCheck,
  settings: Settings2,
  images: ImagePlus,
  access: KeyRound,
  preparation: ClipboardCheck,
  vote: Vote,
  documents: FileText,
};
export function WorkspaceHeading({
  icon,
  eyebrow,
  title,
  children,
  action,
}: {
  icon: keyof typeof icons;
  eyebrow: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = icons[icon];
  return (
    <header className={`workspace-heading workspace-heading-${icon}`}>
      <span className="workspace-heading-icon">
        <Icon size={29} aria-hidden="true" />
      </span>
      <div className="workspace-heading-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {action && <div className="workspace-heading-action">{action}</div>}
    </header>
  );
}
export function WorkspaceNote({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="workspace-note">
      <span>
        <ShieldCheck size={20} aria-hidden="true" />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </aside>
  );
}
export function WorkspaceMetric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  tone?: "blue" | "green" | "purple";
}) {
  return (
    <article className={`workspace-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
