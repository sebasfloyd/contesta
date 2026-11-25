import { Composio } from "@composio/core";
import type { Base } from "../db";
import { guardarConexion, guardarValor, leerAjustes, leerConexion, leerValor, borrarValor, type ConexionInstagram } from "../ajustes";
import type { Canal, ContenidoPrivado, Destino, EstadoCanal, EventoEntrante, Publicacion } from "./tipos";

/**
 * Instagram a través de Composio (https://docs.composio.dev/toolkits/instagram).
 *
 * Verificado en la documentación (versión 20261112_00 del toolkit):
 *  - No hay disparadores (triggers): lo nuevo se trae consultando cada tantos minutos.
 *  - Hay herramientas para listar publicaciones, comentarios, conversaciones y mensajes,
 *    responder comentarios y mandar texto por privado a quien ya escribió.
 *  - NO hay herramienta para la respuesta privada a un comentario ni para botones.
 *    Eso se manda con la llamada directa de Composio (proxy) a la API de Instagram,
 *    usando la misma cuenta conectada. Se apaga con COMPOSIO_PROXY=0.
 */

const USUARIO = process.env.COMPOSIO_USER_ID || "contesta";
const VERSION = process.env.COMPOSIO_TOOLKIT_VERSION_INSTAGRAM || "20261112_00";
const ENDPOINT_MENSAJES = process.env.COMPOSIO_IG_ENDPOINT_MENSAJES || "/me/messages";
export const LLAMADAS_GRATIS_POR_MES = 10000;

export const hayClaveComposio = () => !!process.env.COMPOSIO_API_KEY;
export const proxyActivo = () => process.env.COMPOSIO_PROXY !== "0";

let _cliente: Composio | null = null;
function cliente(): Composio {
  if (!process.env.COMPOSIO_API_KEY) throw new Error("Falta COMPOSIO_API_KEY en las variables de entorno.");
  if (!_cliente) _cliente = new Composio({ apiKey: process.env.COMPOSIO_API_KEY, toolkitVersions: { instagram: VERSION } });
  return _cliente;
}

// ─── Contador de uso (el plan gratis de Composio tiene un tope mensual) ────────

type Uso = { mes: string; llamadas: number };
const mesActual = () => new Date().toISOString().slice(0, 7);

export async function leerUso(base: Base): Promise<Uso> {
  const u = await leerValor<Uso>(base, "uso_composio");
  return u && u.mes === mesActual() ? u : { mes: mesActual(), llamadas: 0 };
}
async function contar(base: Base) {
  const u = await leerUso(base);
  await guardarValor(base, "uso_composio", { mes: u.mes, llamadas: u.llamadas + 1 });
}

// ─── Llamadas ────────────────────────────────────────────────────────────────

type Dato = Record<string, unknown>;

function mensajeDeError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const o = e as Dato;
    const interno = (o.error as Dato | undefined)?.message ?? o.message ?? o.error;
    if (typeof interno === "string") return interno;
    try { return JSON.stringify(e).slice(0, 400); } catch { /* sigue */ }
  }
  return "Error desconocido";
}

async function ejecutar(base: Base, cuentaId: string, herramienta: string, argumentos: Dato): Promise<Dato> {
  await contar(base);
  const r = (await cliente().tools.execute(herramienta, { userId: USUARIO, connectedAccountId: cuentaId, arguments: argumentos })) as unknown as { successful?: boolean; error?: unknown; data?: Dato };
  if (r?.successful === false || r?.error) throw new Error(mensajeDeError(r.error || r.data));
  return r?.data ?? {};
}

async function llamadaDirecta(base: Base, cuentaId: string, cuerpo: Dato): Promise<Dato> {
  await contar(base);
  const r = (await cliente().tools.proxyExecute({ endpoint: ENDPOINT_MENSAJES, method: "POST", connectedAccountId: cuentaId, userId: USUARIO, body: cuerpo })) as unknown as { status?: number; data?: Dato };
  if ((r?.status ?? 500) >= 400) throw new Error(mensajeDeError(r?.data));
  return r?.data ?? {};
}

/** Las respuestas de Composio a veces vienen como {data:[…]} y a veces un nivel más adentro. */
function lista(d: unknown): Dato[] {
  if (Array.isArray(d)) return d as Dato[];
  if (d && typeof d === "object") {
    const o = d as Dato;
    if (Array.isArray(o.data)) return o.data as Dato[];
    if (o.data && typeof o.data === "object") return lista(o.data);
    if (o.response_data) return lista(o.response_data);
  }
  return [];
}
const texto = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const idDe = (d: Dato) => texto(d.id ?? d.message_id ?? (d.data as Dato | undefined)?.id ?? (d.data as Dato | undefined)?.message_id);

// ─── Conexión ────────────────────────────────────────────────────────────────

async function configuracionDeAcceso(): Promise<string> {
  if (process.env.COMPOSIO_AUTH_CONFIG_INSTAGRAM) return process.env.COMPOSIO_AUTH_CONFIG_INSTAGRAM;
  const c = cliente();
  const existentes = (await c.authConfigs.list({ toolkit: "instagram" })) as unknown as { items?: { id: string; status?: string; isDisabled?: boolean }[] };
  const usable = (existentes.items || []).find((a) => !a.isDisabled && a.status !== "DISABLED");
  if (usable) return usable.id;
  const nueva = await c.authConfigs.create("instagram", { type: "use_composio_managed_auth", name: "Instagram Contesta" });
  return nueva.id;
}

/** Devuelve el link de Composio donde el dueño de la cuenta autoriza a Instagram. */
export async function iniciarConexion(base: Base, volverA: string): Promise<string> {
  const pedido = await cliente().connectedAccounts.link(USUARIO, await configuracionDeAcceso(), { callbackUrl: volverA });
  if (!pedido.redirectUrl) throw new Error("Composio no devolvió el link para autorizar.");
  await guardarConexion(base, { cuentaId: pedido.id, estado: "pendiente" });
  return pedido.redirectUrl;
}

/** Revisa en Composio si la cuenta quedó activa y guarda el @usuario. */
export async function revisarConexion(base: Base): Promise<ConexionInstagram | null> {
  const cx = await leerConexion(base);
  if (!cx) return null;
  const cuenta = (await cliente().connectedAccounts.get(cx.cuentaId)) as unknown as { status?: string };
  if (cuenta.status !== "ACTIVE") {
    const pendiente: ConexionInstagram = { ...cx, estado: "pendiente", ultimoError: `Composio informa el estado ${cuenta.status || "desconocido"}.` };
    await guardarConexion(base, pendiente);
    return pendiente;
  }
  const perfil = await ejecutar(base, cx.cuentaId, "INSTAGRAM_GET_USER_INFO", { ig_user_id: "me", fields: "id,user_id,username" });
  const p = (perfil.data && typeof perfil.data === "object" && !Array.isArray(perfil.data) ? perfil.data : perfil) as Dato;
  const activa: ConexionInstagram = {
    ...cx,
    estado: "activa",
    igUserId: texto(p.user_id || p.id),
    usuario: texto(p.username),
    conectadoEn: cx.conectadoEn || new Date().toISOString(),
    ultimoError: null,
  };
  await guardarConexion(base, activa);
  return activa;
}

export async function desconectar(base: Base): Promise<void> {
  const cx = await leerConexion(base);
  if (cx && hayClaveComposio()) {
    try { await cliente().connectedAccounts.delete(cx.cuentaId); } catch { /* ya no existía */ }
  }
  await borrarValor(base, "instagram");
}

/** Pruebas de solo lectura para la pantalla de conexión. No manda nada. */
export async function diagnostico(base: Base): Promise<{ prueba: string; ok: boolean; detalle: string }[]> {
  const cx = await leerConexion(base);
  if (!cx || cx.estado !== "activa") return [{ prueba: "Cuenta conectada", ok: false, detalle: "Todavía no hay una cuenta activa." }];
  const pruebas: [string, () => Promise<string>][] = [
    ["Leer el perfil", async () => `@${texto(lista([(await ejecutar(base, cx.cuentaId, "INSTAGRAM_GET_USER_INFO", { ig_user_id: "me", fields: "id,username" }))])[0]?.username || cx.usuario)}`],
    ["Leer publicaciones", async () => `${lista(await ejecutar(base, cx.cuentaId, "INSTAGRAM_GET_IG_USER_MEDIA", { ig_user_id: "me", limit: 3, fields: "id,comments_count" })).length} publicaciones leídas`],
    ["Leer mensajes privados", async () => `${lista(await ejecutar(base, cx.cuentaId, "INSTAGRAM_LIST_ALL_CONVERSATIONS", { platform: "instagram", limit: 3, fields: "id,updated_time" })).length} conversaciones leídas`],
  ];
  const salida = [];
  for (const [prueba, correr] of pruebas) {
    try { salida.push({ prueba, ok: true, detalle: await correr() }); }
    catch (e) { salida.push({ prueba, ok: false, detalle: mensajeDeError(e instanceof Error ? e.message : e) }); }
  }
  return salida;
}

// ─── El canal ────────────────────────────────────────────────────────────────

const CAMPOS_MENSAJE = "id,created_time,from,to,message,story";
const CAMPOS_COMENTARIO = "id,text,username,timestamp,from";

export class CanalInstagram implements Canal {
  nombre = "instagram";
  capacidades = { privadoPorComentario: proxyActivo(), botones: proxyActivo(), historias: true };

  constructor(private base: Base) {}

  private async conexion(): Promise<ConexionInstagram> {
    const cx = await leerConexion(this.base);
    if (!cx || cx.estado !== "activa") throw new Error("Instagram no está conectado.");
    return cx;
  }

  async estado(): Promise<EstadoCanal> {
    if (!hayClaveComposio()) return { conectado: false, detalle: "Falta la clave de Composio (COMPOSIO_API_KEY)." };
    const cx = await leerConexion(this.base);
    if (!cx) return { conectado: false, detalle: "Todavía no conectaste tu cuenta." };
    if (cx.estado !== "activa") return { conectado: false, detalle: cx.ultimoError || "Falta terminar la autorización en Instagram." };
    return { conectado: true, usuario: cx.usuario, detalle: cx.ultimoError || "Conectado." };
  }

  async publicaciones(): Promise<Publicacion[]> {
    const cx = await this.conexion();
    const d = await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_GET_IG_USER_MEDIA", { ig_user_id: "me", limit: 20, fields: "id,caption,permalink,timestamp" });
    return lista(d).map((m) => ({ id: texto(m.id), texto: texto(m.caption).slice(0, 80) || "(sin texto)", enlace: texto(m.permalink) || null, fecha: texto(m.timestamp) || null }));
  }

  async traerEventos(): Promise<EventoEntrante[]> {
    const cx = await this.conexion();
    const ajustes = await leerAjustes(this.base);
    const desde = new Date(cx.conectadoEn || Date.now()).getTime();
    const eventos: EventoEntrante[] = [];
    const propio = (de: Dato | undefined, usuario?: unknown) =>
      (!!de?.id && texto(de.id) === cx.igUserId) || (!!cx.usuario && (texto(de?.username) === cx.usuario || texto(usuario) === cx.usuario));

    // 1. Mensajes privados: una sola llamada trae las conversaciones con sus últimos mensajes.
    const convs = lista(await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_LIST_ALL_CONVERSATIONS", {
      platform: "instagram",
      limit: 25,
      fields: `id,updated_time,participants,messages.limit(10){${CAMPOS_MENSAJE}}`,
    }));
    for (const conv of convs) {
      let mensajes = conv.messages ? lista(conv.messages) : null;
      if (mensajes === null) {
        // La respuesta no trajo los mensajes adentro: se piden aparte, solo si hubo movimiento.
        if (new Date(texto(conv.updated_time)).getTime() < desde) continue;
        if (cx.ultimaConsulta && new Date(texto(conv.updated_time)).getTime() < new Date(cx.ultimaConsulta).getTime() - 60000) continue;
        mensajes = lista(await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_LIST_ALL_MESSAGES", { conversation_id: texto(conv.id), limit: 10, fields: CAMPOS_MENSAJE }));
      }
      for (const m of mensajes) {
        const de = m.from as Dato | undefined;
        const ocurrido = new Date(texto(m.created_time));
        if (!m.id || !de?.id || propio(de) || isNaN(ocurrido.getTime()) || ocurrido.getTime() < desde) continue;
        const historia = m.story as Dato | undefined;
        eventos.push({
          canal: "instagram",
          idExterno: texto(m.id),
          tipo: historia?.mention ? "mencion_historia" : historia?.reply_to ? "respuesta_historia" : "mensaje",
          de: { idExterno: texto(de.id), usuario: texto(de.username) || null },
          texto: texto(m.message) || (historia?.mention ? "" : "[adjunto]"),
          ocurrido,
        });
      }
    }

    // 2. Comentarios: solo si hay alguna automatización activa que los use.
    const usaComentarios = await this.base.q("select 1 from automatizaciones where activa = true and disparador->>'tipo' = 'comentario' limit 1");
    const vistos = { ...(cx.comentariosPorPost || {}) };
    if (usaComentarios.length) {
      const posts = lista(await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_GET_IG_USER_MEDIA", {
        ig_user_id: "me",
        limit: ajustes.postsARevisar,
        fields: `id,timestamp,comments_count,comments.limit(50){${CAMPOS_COMENTARIO}}`,
      }));
      for (const post of posts) {
        const postId = texto(post.id);
        const cantidad = Number(post.comments_count ?? 0);
        let comentarios = post.comments ? lista(post.comments) : null;
        if (comentarios === null && cantidad > 0 && cantidad !== vistos[postId]) {
          comentarios = lista(await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_GET_IG_MEDIA_COMMENTS", { ig_media_id: postId, limit: 50, fields: CAMPOS_COMENTARIO }));
        }
        vistos[postId] = cantidad;
        for (const c of comentarios || []) {
          const de = c.from as Dato | undefined;
          const usuario = texto(c.username || de?.username);
          const ocurrido = new Date(texto(c.timestamp));
          if (!c.id || propio(de, usuario) || isNaN(ocurrido.getTime()) || ocurrido.getTime() < desde) continue;
          eventos.push({
            canal: "instagram",
            idExterno: texto(c.id),
            tipo: "comentario",
            de: { idExterno: de?.id ? texto(de.id) : `u:${usuario}`, usuario: usuario || null },
            texto: texto(c.text),
            postId,
            ocurrido,
          });
        }
      }
    }

    await guardarConexion(this.base, { ...cx, comentariosPorPost: vistos, ultimaConsulta: new Date().toISOString(), ultimoError: null });
    return eventos.sort((a, b) => a.ocurrido.getTime() - b.ocurrido.getTime());
  }

  async responderComentario(comentarioId: string, mensaje: string) {
    const cx = await this.conexion();
    // Instagram: hasta 300 caracteres por respuesta.
    const d = await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_POST_IG_COMMENT_REPLIES", { ig_comment_id: comentarioId, message: mensaje.slice(0, 300) });
    return { idExterno: idDe(d) };
  }

  async enviarPrivado(destino: Destino, contenido: ContenidoPrivado) {
    const cx = await this.conexion();
    const opciones = contenido.opciones || [];

    // Caso simple y verificado: texto a alguien que ya escribió.
    if ("usuarioId" in destino && opciones.length === 0) {
      const d = await ejecutar(this.base, cx.cuentaId, "INSTAGRAM_SEND_TEXT_MESSAGE", { recipient_id: destino.usuarioId, text: contenido.texto.slice(0, 1000) });
      return { idExterno: idDe(d) };
    }

    if (!proxyActivo()) throw new Error("La respuesta privada a comentarios y los botones están apagados (COMPOSIO_PROXY=0).");
    const destinatario = "usuarioId" in destino ? { id: destino.usuarioId } : { comment_id: destino.comentarioId };
    const conEnlace = opciones.filter((o) => o.url);
    let mensaje: Dato;
    if (conEnlace.length) {
      // Botones que abren un link (hasta 3).
      mensaje = {
        attachment: {
          type: "template",
          payload: { template_type: "button", text: contenido.texto.slice(0, 640), buttons: conEnlace.slice(0, 3).map((o) => ({ type: "web_url", url: o.url, title: o.titulo.slice(0, 20) })) },
        },
      };
    } else if (opciones.length) {
      // Respuestas rápidas (hasta 13): al tocarlas, llega un mensaje con ese texto.
      mensaje = { text: contenido.texto.slice(0, 1000), quick_replies: opciones.slice(0, 13).map((o) => ({ content_type: "text", title: o.titulo.slice(0, 20), payload: o.titulo.slice(0, 20) })) };
    } else {
      mensaje = { text: contenido.texto.slice(0, 1000) };
    }
    const d = await llamadaDirecta(this.base, cx.cuentaId, { recipient: destinatario, message: mensaje });
    return { idExterno: idDe(d) };
  }
}
