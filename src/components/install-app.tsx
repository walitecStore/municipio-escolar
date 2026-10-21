"use client";
import { useEffect, useState } from "react";
type InstallPrompt = Event & { prompt: () => Promise<void> };
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {});
    const listener = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", listener);
    return () => window.removeEventListener("beforeinstallprompt", listener);
  }, []);
  return (
    <>
      <button
        className="button secondary"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            setPrompt(null);
          } else setHelp(!help);
        }}
      >
        Instalar aplicación
      </button>
      {help && (
        <p role="status">
          En Chrome o Edge, abre el menú y elige «Instalar aplicación». En
          iPhone o iPad, usa Safari → Compartir → Añadir a pantalla de inicio.
          La votación requiere internet.
        </p>
      )}
    </>
  );
}
