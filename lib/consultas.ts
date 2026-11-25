import { base } from "./db";
import type { Automatizacion, Contacto, Mensaje } from "./tipos";

export type FilaEstadistica = { id: string; nombre: string; activa: boolean; disparos: number; enviados: number; capturados: number; errores: number };

export async function estadisticas(): Promise<FilaEstadistica[]> {
  return (await base()).q<FilaEstadistica>(`
    select a.id, a.nombre, a.activa,
      (select count(*)::int from ejecuciones e where e.automatizacion_id = a.id) as disparos,
      (select count(*)::int from mensajes m where m.automatizacion_id = a.id and m.direccion = 'saliente' and m.estado = 'enviado') as enviados,
      (select count(*)::int from registro r where r.automatizacion_id = a.id and r.tipo = 'dato_capturado') as capturados,
      (select count(*)::int from registro r where r.automatizacion_id = a.id and r.nivel = 'error') as errores
    from automatizaciones a order by a.creada desc`);
}

export async function automatizaciones(): Promise<Automatizacion[]> {
  return (await base()).q<Automatizacion>("select * from automatizaciones order by creada desc");
}

export async function automatizacion(id: string): Promise<Automatizacion | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return (await (await base()).q<Automatizacion>("select * from automatizaciones where id = $1", [id]))[0] ?? null;
}

export type ContactoConOrigen = Contacto & { origen_nombre: string | null };

export async function contactos(filtro: { buscar?: string; etiqueta?: string } = {}): Promise<ContactoConOrigen[]> {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.buscar?.trim()) {
    params.push(`%${filtro.buscar.trim().replace(/^@/, "").toLowerCase()}%`);
    condiciones.push(`(lower(coalesce(c.usuario,'')) like $${params.length} or lower(coalesce(c.nombre,'')) like $${params.length} or lower(c.datos::text) like $${params.length})`);
  }
  if (filtro.etiqueta?.trim()) {
    params.push(filtro.etiqueta.trim());
    condiciones.push(`c.etiquetas ? $${params.length}`);
  }
  return (await base()).q<ContactoConOrigen>(
    `select c.*, a.nombre as origen_nombre from contactos c
     left join automatizaciones a on a.id = c.origen_automatizacion_id
     ${condiciones.length ? "where " + condiciones.join(" and ") : ""}
     order by c.ultimo_movimiento desc limit 500`,
    params,
  );
}

export async function etiquetasEnUso(): Promise<string[]> {
  const filas = await (await base()).q<{ e: string }>("select distinct jsonb_array_elements_text(etiquetas) as e from contactos order by 1");
  return filas.map((f) => f.e);
}

export async function contacto(id: string): Promise<ContactoConOrigen | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const filas = await (await base()).q<ContactoConOrigen>(
    "select c.*, a.nombre as origen_nombre from contactos c left join automatizaciones a on a.id = c.origen_automatizacion_id where c.id = $1",
    [id],
  );
  return filas[0] ?? null;
}

export type MensajeConOrigen = Mensaje & { automatizacion_nombre: string | null };

export async function mensajesDe(contactoId: string): Promise<MensajeConOrigen[]> {
  return (await base()).q<MensajeConOrigen>(
    `select m.*, a.nombre as automatizacion_nombre from mensajes m
     left join automatizaciones a on a.id = m.automatizacion_id
     where m.contacto_id = $1 order by m.creado, m.id limit 300`,
    [contactoId],
  );
}

export type Conversacion = ContactoConOrigen & { ultimo_texto: string | null; ultimo_direccion: string | null };

export async function conversaciones(): Promise<Conversacion[]> {
  return (await base()).q<Conversacion>(`
    select c.*, null::text as origen_nombre, u.texto as ultimo_texto, u.direccion as ultimo_direccion
    from contactos c
    join lateral (select texto, direccion from mensajes m where m.contacto_id = c.id order by m.creado desc, m.id desc limit 1) u on true
    order by c.pide_humano desc, c.ultimo_movimiento desc limit 200`);
}

export type FilaRegistro = { id: string; nivel: string; tipo: string; detalle: string; creado: Date; automatizacion_nombre: string | null; usuario: string | null; contacto_id: string | null };

export async function registro(opciones: { soloProblemas?: boolean; limite?: number } = {}): Promise<FilaRegistro[]> {
  return (await base()).q<FilaRegistro>(
    `select r.id, r.nivel, r.tipo, r.detalle, r.creado, r.contacto_id, a.nombre as automatizacion_nombre, c.usuario
     from registro r
     left join automatizaciones a on a.id = r.automatizacion_id
     left join contactos c on c.id = r.contacto_id
     ${opciones.soloProblemas ? "where r.nivel in ('error','aviso')" : ""}
     order by r.creado desc limit ${Math.min(500, opciones.limite ?? 100)}`,
  );
}

export type Resumen = { automatizaciones_activas: number; contactos: number; enviados_hora: number; enviados_hoy: number; piden_humano: number; errores_hoy: number; en_espera: number };

export async function resumen(): Promise<Resumen> {
  return (await (await base()).q<Resumen>(`
    select
      (select count(*)::int from automatizaciones where activa) as automatizaciones_activas,
      (select count(*)::int from contactos) as contactos,
      (select count(*)::int from mensajes where direccion = 'saliente' and origen = 'bot' and estado = 'enviado' and creado > now() - interval '1 hour') as enviados_hora,
      (select count(*)::int from mensajes where direccion = 'saliente' and estado = 'enviado' and creado > now() - interval '24 hours') as enviados_hoy,
      (select count(*)::int from contactos where pide_humano) as piden_humano,
      (select count(*)::int from registro where nivel = 'error' and creado > now() - interval '24 hours') as errores_hoy,
      (select count(*)::int from ejecuciones where estado in ('esperando_tiempo','esperando_dato','esperando_respuesta')) as en_espera`))[0];
}
