"use client";
import { demoStudents, type Elector } from "@/lib/roll/model";
import { createContext, useContext, useState, type ReactNode } from "react";
import { lists as originalLists } from "@/lib/demo";
import type { ElectionState, Slate } from "@/lib/electoral/types";
const symbols = ["Árbol", "Libro", "Sol"] as const;
const initial: Slate[] = originalLists.map((l, i) => ({
  id: l.id,
  number: i + 1,
  name: l.name,
  symbol: symbols[i],
  proposals: [...l.proposals],
  color: l.color,
  motto: l.motto,
  candidates: [
    {
      id: `${l.id}-mayor`,
      name: l.candidate,
      role: "alcalde",
      position: 0,
      title: "Alcaldía escolar",
      grade: i === 1 ? 5 : 4,
      section: "A",
      photo: l.photo,
    },
    {
      id: `${l.id}-council-1`,
      name: `Regidor ficticio ${i + 1}`,
      role: "regidor",
      position: 1,
      title: "Regiduría de educación y cultura",
      grade: 3,
      section: "B",
      photo: l.photo,
    },
  ],
}));
type ContextValue = {
  electors: Elector[];
  setElectors: (s: Elector[]) => void;
  rollLocked: boolean;
  setRollLocked: (s: boolean) => void;
  slates: Slate[];
  setSlates: (s: Slate[]) => void;
  state: ElectionState;
  setState: (s: ElectionState) => void;
};
const Context = createContext<ContextValue | null>(null);
export function ElectoralProvider({ children }: { children: ReactNode }) {
  const [electors, setElectors] = useState<Elector[]>(demoStudents);
  const [rollLocked, setRollLocked] = useState(false);
  const [slates, setSlates] = useState<Slate[]>(initial);
  const [state, setState] = useState<ElectionState>("draft");
  return (
    <Context.Provider
      value={{
        slates,
        setSlates,
        state,
        setState,
        electors,
        setElectors,
        rollLocked,
        setRollLocked,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useElectoralDemo() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Se requiere ElectoralProvider");
  return ctx;
}
