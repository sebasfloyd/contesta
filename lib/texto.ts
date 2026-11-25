import type { Coincidencia, Contacto } from "./tipos";

/** Minúsculas, sin acentos, sin signos y con espacios simples: "¡GUÍA!" y "guia" quedan iguales. */
export function normalizar(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ@.+\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** ¿El texto dispara alguna de las palabras? Sin palabras, coincide siempre. */
export function coincide(texto: string, palabras: string[], modo: Coincidencia): boolean {
  const limpias = palabras.map(normalizar).filter(Boolean);
  if (limpias.length === 0) return true;
  const t = normalizar(texto);
  if (modo === "exacta") return limpias.includes(t);
  // "contiene" compara por palabra entera: "guia" coincide con "quiero la guia" pero no con "guiado".
  const conBordes = ` ${t} `;
  return limpias.some((p) => conBordes.includes(` ${p} `));
}

const MAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;

/** Devuelve el mail encontrado dentro del texto, en minúsculas, o null. */
export function extraerMail(texto: string): string | null {
  const m = (texto || "").match(MAIL);
  if (!m) return null;
  const mail = m[0].toLowerCase().replace(/\.+$/, "");
  if (mail.includes("..")) return null;
  return mail;
}

/** Devuelve el teléfono (solo dígitos, con + si vino) si tiene entre 8 y 15 dígitos, o null. */
export function extraerTelefono(texto: string): string | null {
  const m = (texto || "").match(/\+?[\d\s().-]{8,}/);
  if (!m) return null;
  const digitos = m[0].replace(/\D/g, "");
  if (digitos.length < 8 || digitos.length > 15) return null;
  return (m[0].trim().startsWith("+") ? "+" : "") + digitos;
}

/** Reemplaza {{usuario}}, {{nombre}}, {{mail}}, {{telefono}} con los datos del contacto. */
export function completar(texto: string, contacto: Pick<Contacto, "usuario" | "nombre" | "datos">): string {
  const valores: Record<string, string> = {
    usuario: contacto.usuario ? `@${contacto.usuario}` : "",
    nombre: contacto.nombre || contacto.usuario || "",
    ...contacto.datos,
  };
  return (texto || "")
    .replace(/\{\{\s*([a-zñ_]+)\s*\}\}/gi, (_, clave: string) => valores[clave.toLowerCase()] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function fechaCorta(d: Date | string | null | undefined): string {
  if (!d) return "";
  const f = new Date(d);
  return f.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
}
