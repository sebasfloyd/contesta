"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { base } from "@/lib/db";
import { COOKIE_SESION, claveCorrecta, clavePanel, fichaDeSesion, sesionValida } from "@/lib/auth";
import { guardarAjustes } from "@/lib/ajustes";
import { PLANTILLAS } from "@/lib/plantillas";
import { esquemaAutomatizacion } from "@/lib/validar";
import { latido, motor } from "@/lib/servicio";
import { desconectar, diagnostico, hayClaveComposio, iniciarConexion, revisarConexion } from "@/lib/canales/composio";
import type { TipoEvento } from "@/lib/tipos";

export type Respuesta = { ok: boolean; mensaje?: string; id?: string };

/** Cada acción vuelve a revisar la sesión: no alcanza con el proxy. */
async function exigirSesion() {
  const galleta = (await cookies()).get(COOKIE_SESION)?.value;
  if (!(await sesionValida(galleta))) redirect("/entrar");
}

// ─── Entrada ─────────────────────────────────────────────────────────────────

export async function entrar(_: Respuesta | null, datos: FormData): Promise<Respuesta> {
  if (!clavePanel()) return { ok: false, mensaje: "Falta definir CLAVE_PANEL en las variables de entorno." };
  if (!(await claveCorrecta(String(datos.get("clave") || "")))) {
    await new Promise((r) => setTimeout(r, 600));
    return { ok: false, mensaje: "Esa no es la clave." };
  }
  (await cookies()).set(COOKIE_SESION, (await fichaDeSesion())!, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/");
}

export async function salir() {
  (await cookies()).delete(COOKIE_SESION);
  redirect("/entrar");
}

// ─── Automatizaciones ────────────────────────────────────────────────────────

export async function guardarAutomatizacion(id: string | null, datos: unknown): Promise<Respuesta> {
  await exigirSesion();
  const r = esquemaAutomatizacion.safeParse(datos);
  if (!r.success) return { ok: false, mensaje: r.error.issues[0]?.message || "Revisá los datos." };
  const { nombre, disparador, pasos } = r.data;
  const b = await base();
  if (id) {
    await b.q("update automatizaciones set nombre = $2, disparador = $3::jsonb, pasos = $4::jsonb, actualizada = now() where id = $1", [id, nombre, JSON.stringify(disparador), JSON.stringify(pasos)]);
  } else {
    id = (await b.q<{ id: string }>("insert into automatizaciones (nombre, disparador, pasos) values ($1, $2::jsonb, $3::jsonb) returning id", [nombre, JSON.stringify(disparador), JSON.stringify(pasos)]))[0].id;
  }
  revalidatePath("/automatizaciones");
  return { ok: true, id, mensaje: "Guardado." };
}

export async function cambiarEstado(id: string, activa: boolean) {
  await exigirSesion();
  await (await base()).q("update automatizaciones set activa = $2, actualizada = now() where id = $1", [id, activa]);
  revalidatePath("/automatizaciones");
}

export async function duplicar(id: string) {
  await exigirSesion();
  await (await base()).q("insert into automatizaciones (nombre, activa, disparador, pasos) select nombre || ' (copia)', false, disparador, pasos from automatizaciones where id = $1", [id]);
  revalidatePath("/automatizaciones");
}

export async function borrarAutomatizacion(id: string) {
  await exigirSesion();
  await (await base()).q("delete from automatizaciones where id = $1", [id]);
  revalidatePath("/automatizaciones");
  redirect("/automatizaciones");
}

export async function crearDesdePlantilla(clave: string) {
  await exigirSesion();
  const p = PLANTILLAS.find((x) => x.clave === clave);
  if (!p) return;
  const filas = await (await base()).q<{ id: string }>("insert into automatizaciones (nombre, activa, disparador, pasos) values ($1, false, $2::jsonb, $3::jsonb) returning id", [p.nombre, JSON.stringify(p.disparador), JSON.stringify(p.pasos)]);
  redirect(`/automatizaciones/${filas[0].id}`);
}

// ─── Contactos y bandeja ─────────────────────────────────────────────────────

export async function responderAMano(contactoId: string, _: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirSesion();
  const r = await (await motor()).enviarManual(contactoId, String(datos.get("texto") || ""));
  revalidatePath(`/bandeja/${contactoId}`);
  return r.ok ? { ok: true } : { ok: false, mensaje: r.motivo };
}

export async function pausarBot(contactoId: string, pausado: boolean) {
  await exigirSesion();
  await (await base()).q("update contactos set bot_pausado = $2, pide_humano = case when $2 then pide_humano else false end where id = $1", [contactoId, pausado]);
  revalidatePath(`/bandeja/${contactoId}`);
  revalidatePath("/bandeja");
}

export async function marcarAtendido(contactoId: string) {
  await exigirSesion();
  await (await base()).q("update contactos set pide_humano = false where id = $1", [contactoId]);
  revalidatePath("/bandeja");
  revalidatePath(`/bandeja/${contactoId}`);
}

export async function cambiarEtiqueta(contactoId: string, etiqueta: string, poner: boolean) {
  await exigirSesion();
  const e = etiqueta.trim().slice(0, 40);
  if (!e) return;
  const b = await base();
  if (poner) await b.q("update contactos set etiquetas = etiquetas || $2::jsonb where id = $1 and not (etiquetas ? $3)", [contactoId, JSON.stringify([e]), e]);
  else await b.q("update contactos set etiquetas = etiquetas - $2 where id = $1", [contactoId, e]);
  revalidatePath(`/contactos/${contactoId}`);
}

export async function agregarEtiqueta(contactoId: string, datos: FormData) {
  await cambiarEtiqueta(contactoId, String(datos.get("etiqueta") || ""), true);
}

export async function borrarContacto(contactoId: string) {
  await exigirSesion();
  await (await base()).q("delete from contactos where id = $1", [contactoId]);
  redirect("/contactos");
}

// ─── Simulador ───────────────────────────────────────────────────────────────

const TEXTO_RESULTADO: Record<string, string> = {
  duplicado: "Ese evento ya se había procesado.",
  baja: "La persona pidió la baja: no recibe más mensajes.",
  alta: "La persona volvió a aceptar mensajes.",
  ignorado_baja: "No pasó nada: esa persona está dada de baja.",
  bot_pausado: "No pasó nada: el bot está pausado para esa persona.",
  dato_recibido: "Se tomó como respuesta al dato que se le había pedido.",
  reanudada: "La persona contestó y la automatización siguió.",
  sin_coincidencia: "Ninguna automatización activa coincide con ese texto.",
  automatizacion: "Se disparó una automatización.",
};

export async function simular(_: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirSesion();
  const tipo = String(datos.get("tipo") || "comentario") as TipoEvento;
  const usuario = String(datos.get("usuario") || "").trim().replace(/^@/, "").replace(/[^a-z0-9._]/gi, "").slice(0, 30).toLowerCase() || "lector_demo";
  const texto = String(datos.get("texto") || "").trim().slice(0, 500);
  if (!texto && tipo !== "mencion_historia") return { ok: false, mensaje: "Escribí el texto del comentario o del mensaje." };
  const m = await motor();
  const r = await m.recibir({
    canal: "simulado",
    idExterno: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tipo,
    de: { idExterno: `sim_${usuario}`, usuario },
    texto,
    postId: tipo === "comentario" ? String(datos.get("post") || "post_demo_1") : null,
    ocurrido: new Date(),
  });
  revalidatePath("/simulador");
  return { ok: true, id: r.contactoId, mensaje: TEXTO_RESULTADO[r.resultado] || r.resultado };
}

/** Hace de cuenta que ya pasó el tiempo de las esperas de este contacto de prueba. */
export async function saltarEsperas(contactoId: string) {
  await exigirSesion();
  await (await base()).q("update ejecuciones set reanudar_en = now() - interval '1 second' where contacto_id = $1 and estado = 'esperando_tiempo'", [contactoId]);
  await (await motor()).tic();
  revalidatePath("/simulador");
}

/** Hace de cuenta que el último mensaje de este contacto de prueba fue hace 25 hs (ventana cerrada). */
export async function cerrarVentana(contactoId: string) {
  await exigirSesion();
  await (await base()).q("update contactos set ultimo_entrante = now() - interval '25 hours' where id = $1 and canal = 'simulado'", [contactoId]);
  revalidatePath("/simulador");
}

export async function borrarPruebas() {
  await exigirSesion();
  await (await base()).q("delete from contactos where canal = 'simulado'");
  revalidatePath("/simulador");
}

// ─── Ajustes y conexión ──────────────────────────────────────────────────────

export async function guardarAjustesGenerales(_: Respuesta | null, datos: FormData): Promise<Respuesta> {
  await exigirSesion();
  await guardarAjustes(await base(), {
    palabraBaja: String(datos.get("palabraBaja") || ""),
    palabraAlta: String(datos.get("palabraAlta") || ""),
    mensajeBaja: String(datos.get("mensajeBaja") || "").slice(0, 500),
    topePorHora: Number(datos.get("topePorHora")),
    consultaCadaMinutos: Number(datos.get("consultaCadaMinutos")),
    postsARevisar: Number(datos.get("postsARevisar")),
    instruccionesNegocio: String(datos.get("instruccionesNegocio") || "").slice(0, 4000),
  });
  revalidatePath("/ajustes");
  return { ok: true, mensaje: "Guardado." };
}

async function origen(): Promise<string> {
  if (process.env.URL_PUBLICA) return process.env.URL_PUBLICA.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function conectarInstagram(): Promise<Respuesta> {
  await exigirSesion();
  if (!hayClaveComposio()) return { ok: false, mensaje: "Primero cargá COMPOSIO_API_KEY en las variables de entorno." };
  let url: string;
  try {
    url = await iniciarConexion(await base(), `${await origen()}/conexion?vuelta=1`);
  } catch (e) {
    return { ok: false, mensaje: `Composio no pudo empezar la conexión: ${e instanceof Error ? e.message : String(e)}` };
  }
  redirect(url);
}

export async function actualizarConexion(): Promise<Respuesta> {
  await exigirSesion();
  try {
    const cx = await revisarConexion(await base());
    revalidatePath("/conexion");
    if (!cx) return { ok: false, mensaje: "No hay ninguna conexión empezada." };
    return cx.estado === "activa" ? { ok: true, mensaje: `Conectado como @${cx.usuario}.` } : { ok: false, mensaje: cx.ultimoError || "Todavía falta autorizar en Instagram." };
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : String(e) };
  }
}

export async function desconectarInstagram() {
  await exigirSesion();
  await desconectar(await base());
  revalidatePath("/conexion");
}

export type Diagnostico = { prueba: string; ok: boolean; detalle: string }[];

export async function probarConexion(): Promise<Diagnostico> {
  await exigirSesion();
  try {
    return await diagnostico(await base());
  } catch (e) {
    return [{ prueba: "Conexión con Composio", ok: false, detalle: e instanceof Error ? e.message : String(e) }];
  }
}

export async function consultarAhora(): Promise<Respuesta> {
  await exigirSesion();
  const r = await latido({ forzarConsulta: true });
  revalidatePath("/", "layout");
  if (r.error) return { ok: false, mensaje: r.error };
  return { ok: true, mensaje: r.consultado ? `Consulta hecha: ${r.nuevos} eventos nuevos, ${r.reanudadas} esperas reanudadas.` : `${r.reanudadas} esperas reanudadas. Instagram no está conectado, así que no hubo consulta.` };
}
