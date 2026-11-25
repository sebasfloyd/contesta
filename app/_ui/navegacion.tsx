"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const PRINCIPAL = [
  { href: "/", nombre: "Inicio" },
  { href: "/automatizaciones", nombre: "Automatizaciones" },
  { href: "/bandeja", nombre: "Bandeja" },
  { href: "/contactos", nombre: "Contactos" },
  { href: "/estadisticas", nombre: "Estadísticas" },
];
const HERRAMIENTAS = [
  { href: "/simulador", nombre: "Simulador" },
  { href: "/registro", nombre: "Registro" },
  { href: "/conexion", nombre: "Conectar Instagram" },
  { href: "/ajustes", nombre: "Ajustes" },
];

const activo = (ruta: string, href: string) => (href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(href + "/"));

export function Navegacion({ pidenHumano }: { pidenHumano: number }) {
  const ruta = usePathname();
  const item = (l: { href: string; nombre: string }) => (
    <Link key={l.href} href={l.href} aria-current={activo(ruta, l.href) ? "page" : undefined}>
      {l.nombre}
      {l.href === "/bandeja" && pidenHumano > 0 && <span className="punto" title="Piden hablar con una persona">{pidenHumano}</span>}
    </Link>
  );
  return (
    <nav className="nav" aria-label="Secciones">
      {PRINCIPAL.map(item)}
      <div className="grupo">Herramientas</div>
      {HERRAMIENTAS.map(item)}
    </nav>
  );
}

const trazo = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const ICONOS: Record<string, React.ReactNode> = {
  "/": <path {...trazo} d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z" />,
  "/automatizaciones": <path {...trazo} d="M13 3 5 13.5h6L10 21l8.5-11H12z" />,
  "/bandeja": <path {...trazo} d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />,
  "/contactos": <path {...trazo} d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9c0-3.3 2.7-6 6-6s6 2.700 6 6M16 4.500a3.500 3.500 0 0 1 0 6.500m2 3.500c1.800.900 3 2.800 3 5" />,
  "/mas": <path {...trazo} d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />,
};

export function TabsMovil({ pidenHumano }: { pidenHumano: number }) {
  const ruta = usePathname();
  const tabs = [
    { href: "/", nombre: "Inicio" },
    { href: "/automatizaciones", nombre: "Reglas" },
    { href: "/bandeja", nombre: pidenHumano > 0 ? `Bandeja (${pidenHumano})` : "Bandeja" },
    { href: "/contactos", nombre: "Contactos" },
    { href: "/mas", nombre: "Más" },
  ];
  const enMas = ["/mas", "/estadisticas", "/simulador", "/registro", "/conexion", "/ajustes"].some((h) => activo(ruta, h));
  return (
    <nav className="tabs-movil" aria-label="Secciones">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={(t.href === "/mas" ? enMas : activo(ruta, t.href)) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{ICONOS[t.href]}</svg>
          {t.nombre}
        </Link>
      ))}
    </nav>
  );
}
