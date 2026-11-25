import type { Metadata, Viewport } from "next";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Contesta", template: "%s · Contesta" },
  description: "Respuestas automáticas para los comentarios y mensajes de tu Instagram.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f1ea" };

// El panel siempre muestra datos al momento: nada se guarda en caché.
export const dynamic = "force-dynamic";

export default function Raiz({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
