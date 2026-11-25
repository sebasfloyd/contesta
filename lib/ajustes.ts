import type { Base } from "./db";
import { AJUSTES_INICIALES, type Ajustes } from "./tipos";

export async function leerValor<T>(base: Base, clave: string): Promise<T | null> {
  const filas = await base.q<{ valor: T }>("select valor from ajustes where clave = $1", [clave]);
  return filas[0]?.valor ?? null;
}

export async function guardarValor(base: Base, clave: string, valor: unknown): Promise<void> {
  await base.q(
    `insert into ajustes (clave, valor) values ($1, $2::jsonb)
     on conflict (clave) do update set valor = excluded.valor, actualizado = now()`,
    [clave, JSON.stringify(valor)],
  );
}

export async function borrarValor(base: Base, clave: string): Promise<void> {
  await base.q("delete from ajustes where clave = $1", [clave]);
}

export async function leerAjustes(base: Base): Promise<Ajustes> {
  const guardados = (await leerValor<Partial<Ajustes>>(base, "general")) || {};
  return { ...AJUSTES_INICIALES, ...guardados };
}

export async function guardarAjustes(base: Base, cambios: Partial<Ajustes>): Promise<Ajustes> {
  const nuevos = { ...(await leerAjustes(base)), ...cambios };
  nuevos.topePorHora = Math.max(1, Math.min(500, Math.round(Number(nuevos.topePorHora) || AJUSTES_INICIALES.topePorHora)));
  nuevos.consultaCadaMinutos = Math.max(1, Math.min(60, Math.round(Number(nuevos.consultaCadaMinutos) || AJUSTES_INICIALES.consultaCadaMinutos)));
  nuevos.postsARevisar = Math.max(1, Math.min(25, Math.round(Number(nuevos.postsARevisar) || AJUSTES_INICIALES.postsARevisar)));
  nuevos.palabraBaja = (nuevos.palabraBaja || AJUSTES_INICIALES.palabraBaja).trim();
  nuevos.palabraAlta = (nuevos.palabraAlta || AJUSTES_INICIALES.palabraAlta).trim();
  await guardarValor(base, "general", nuevos);
  return nuevos;
}

/** Datos de la cuenta de Instagram conectada por Composio. */
export type ConexionInstagram = {
  cuentaId: string;
  estado: "pendiente" | "activa";
  igUserId?: string;
  usuario?: string;
  /** Solo se atiende lo que pasó después de este momento: lo viejo no se contesta. */
  conectadoEn?: string;
  /** Cantidad de comentarios ya vistos por publicación, para no pedirlos de más. */
  comentariosPorPost?: Record<string, number>;
  ultimaConsulta?: string;
  ultimoError?: string | null;
};

export const leerConexion = (base: Base) => leerValor<ConexionInstagram>(base, "instagram");
export const guardarConexion = (base: Base, c: ConexionInstagram) => guardarValor(base, "instagram", c);
