import { base } from "@/lib/db";
import type { ContactoConOrigen } from "@/lib/consultas";

export const dynamic = "force-dynamic";

// Comillas dobles y, si empieza con = + - @, un apóstrofo adelante para que Excel no lo tome como fórmula.
const celda = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(pedido: Request) {
  const url = new URL(pedido.url);
  const buscar = url.searchParams.get("buscar")?.trim().replace(/^@/, "").toLowerCase();
  const etiqueta = url.searchParams.get("etiqueta")?.trim();
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (buscar) {
    params.push(`%${buscar}%`);
    condiciones.push(`(lower(coalesce(c.usuario,'')) like $${params.length} or lower(coalesce(c.nombre,'')) like $${params.length} or lower(c.datos::text) like $${params.length})`);
  }
  if (etiqueta) {
    params.push(etiqueta);
    condiciones.push(`c.etiquetas ? $${params.length}`);
  }
  const filas = await (await base()).q<ContactoConOrigen>(
    `select c.*, a.nombre as origen_nombre from contactos c left join automatizaciones a on a.id = c.origen_automatizacion_id
     ${condiciones.length ? "where " + condiciones.join(" and ") : ""} order by c.creado`,
    params,
  );
  const lineas = [
    ["usuario", "nombre", "canal", "etiquetas", "mail", "telefono", "llego_por", "baja", "primer_contacto", "ultimo_movimiento"].join(","),
    ...filas.map((c) =>
      [c.usuario, c.nombre, c.canal, c.etiquetas.join(" | "), c.datos.mail, c.datos.telefono, c.origen_nombre, c.baja ? "si" : "no", new Date(c.creado).toISOString(), new Date(c.ultimo_movimiento).toISOString()].map(celda).join(","),
    ),
  ];
  // El BOM del principio hace que Excel abra bien los acentos.
  return new Response("﻿" + lineas.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="contactos-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
