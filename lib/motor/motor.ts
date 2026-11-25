import type { Base } from "../db";
import { leerAjustes } from "../ajustes";
import { opcionesComoTexto, type Canal, type ContenidoPrivado, type Destino, type EventoEntrante } from "../canales/tipos";
import { coincide, completar, extraerMail, extraerTelefono, normalizar } from "../texto";
import type { Ajustes, Automatizacion, Contacto, Ejecucion, EstadoEjecucion, EventoGuardado, Paso } from "../tipos";

/**
 * El motor de reglas. Recibe eventos (comentarios, mensajes), decide qué automatización
 * corresponde y corre sus pasos respetando las protecciones:
 *  - nunca procesa dos veces el mismo evento,
 *  - un solo privado por comentario,
 *  - ventana de 24 hs para mensajes,
 *  - tope de envíos por hora,
 *  - palabra de baja.
 * No sabe nada de Instagram: habla con un Canal.
 */

export type GeneradorIA = (entrada: {
  instruccionesNegocio: string;
  instruccionesPaso: string;
  historial: { de: "contacto" | "negocio"; texto: string }[];
}) => Promise<string>;

export type Dependencias = {
  base: Base;
  /** Devuelve el canal por nombre ("simulado", "instagram"). */
  canal: (nombre: string) => Canal | Promise<Canal>;
  /** Reloj inyectable: los tests lo adelantan. */
  ahora?: () => Date;
  /** Sin generador, el paso de IA se saltea y queda anotado. */
  ia?: GeneradorIA | null;
};

export type ResultadoEvento =
  | "duplicado"
  | "baja"
  | "alta"
  | "ignorado_baja"
  | "bot_pausado"
  | "dato_recibido"
  | "reanudada"
  | "sin_coincidencia"
  | "automatizacion";

const HORA = 60 * 60 * 1000;
const VENTANA_MENSAJES = 24 * HORA;
const VENTANA_COMENTARIO = 7 * 24 * HORA;
const ESPERA_POR_TOPE_MIN = 10;
const MAX_REINTENTOS_TOPE = 12;

type ResultadoEnvio = "enviado" | "tope" | "ventana" | "esperar_respuesta" | "baja" | "error";
type ResultadoPaso = "seguir" | { pausa: EstadoEjecucion; reanudarEn?: Date; mismoPaso?: boolean } | { fin: EstadoEjecucion };

const iso = (d: Date) => d.toISOString();

export function crearMotor(deps: Dependencias) {
  const { base } = deps;
  const ahora = () => (deps.ahora ? deps.ahora() : new Date());

  // ─── Registro ────────────────────────────────────────────────────────────────

  async function anotar(nivel: "info" | "aviso" | "error", tipo: string, detalle: string, ids: { automatizacionId?: string | null; contactoId?: string | null } = {}) {
    await base.q(
      "insert into registro (nivel, tipo, detalle, automatizacion_id, contacto_id, creado) values ($1, $2, $3, $4, $5, $6::timestamptz)",
      [nivel, tipo, detalle.slice(0, 1000), ids.automatizacionId ?? null, ids.contactoId ?? null, iso(ahora())],
    );
  }

  async function guardarMensaje(m: {
    contactoId: string;
    direccion: "entrante" | "saliente";
    tipo: "privado" | "comentario" | "respuesta_comentario" | "historia";
    texto: string;
    opciones?: unknown;
    origen: "contacto" | "bot" | "humano";
    automatizacionId?: string | null;
    ejecucionId?: string | null;
    idExterno?: string | null;
    estado: "recibido" | "enviado" | "error";
    error?: string | null;
    creado?: Date;
  }) {
    const cuando = iso(m.creado ?? ahora());
    await base.q(
      `insert into mensajes (contacto_id, direccion, tipo, texto, opciones, origen, automatizacion_id, ejecucion_id, id_externo, estado, error, creado)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::timestamptz)`,
      [m.contactoId, m.direccion, m.tipo, m.texto, m.opciones ? JSON.stringify(m.opciones) : null, m.origen, m.automatizacionId ?? null, m.ejecucionId ?? null, m.idExterno ?? null, m.estado, m.error ?? null, cuando],
    );
    await base.q("update contactos set ultimo_movimiento = $2::timestamptz where id = $1", [m.contactoId, cuando]);
  }

  // ─── Contactos ───────────────────────────────────────────────────────────────

  async function contactoPorId(id: string): Promise<Contacto> {
    const filas = await base.q<Contacto>("select * from contactos where id = $1", [id]);
    if (!filas[0]) throw new Error("El contacto ya no existe");
    return filas[0];
  }

  /** Busca el contacto por id de la red; si no, por @usuario (un comentario puede venir sin id). Si no existe, lo crea. */
  async function resolverContacto(ev: EventoEntrante): Promise<Contacto> {
    const usuario = ev.de.usuario?.replace(/^@/, "").trim() || null;
    let filas = await base.q<Contacto>("select * from contactos where canal = $1 and id_externo = $2", [ev.canal, ev.de.idExterno]);
    if (!filas[0] && usuario) {
      filas = await base.q<Contacto>("select * from contactos where canal = $1 and lower(usuario) = lower($2) order by creado limit 1", [ev.canal, usuario]);
      // Lo conocíamos solo por el @usuario y ahora llegó su id real: lo guardamos.
      if (filas[0] && filas[0].id_externo.startsWith("u:") && !ev.de.idExterno.startsWith("u:")) {
        await base.q("update contactos set id_externo = $2 where id = $1", [filas[0].id, ev.de.idExterno]);
        filas[0].id_externo = ev.de.idExterno;
      }
    }
    if (filas[0]) {
      if ((usuario && usuario !== filas[0].usuario) || (ev.de.nombre && ev.de.nombre !== filas[0].nombre)) {
        await base.q("update contactos set usuario = coalesce($2, usuario), nombre = coalesce($3, nombre) where id = $1", [filas[0].id, usuario, ev.de.nombre ?? null]);
      }
      return filas[0];
    }
    const creadas = await base.q<Contacto>(
      `insert into contactos (canal, id_externo, usuario, nombre, creado, ultimo_movimiento)
       values ($1, $2, $3, $4, $5::timestamptz, $5::timestamptz)
       on conflict (canal, id_externo) do update set usuario = coalesce(excluded.usuario, contactos.usuario)
       returning *`,
      [ev.canal, ev.de.idExterno, usuario, ev.de.nombre ?? null, iso(ahora())],
    );
    return creadas[0];
  }

  // ─── Envíos protegidos ───────────────────────────────────────────────────────

  async function enviadosUltimaHora(): Promise<number> {
    const filas = await base.q<{ n: number }>(
      `select count(*)::int as n from mensajes
       where direccion = 'saliente' and origen = 'bot' and estado = 'enviado' and creado > $1::timestamptz`,
      [iso(new Date(ahora().getTime() - HORA))],
    );
    return filas[0].n;
  }

  /**
   * Único lugar por donde el bot manda privados. Aplica baja, tope por hora y ventanas de Instagram.
   */
  async function enviarPrivadoProtegido(
    ajustes: Ajustes,
    contactoId: string,
    evento: EventoGuardado,
    contenido: ContenidoPrivado,
    ref: { automatizacionId: string; ejecucionId: string },
  ): Promise<ResultadoEnvio> {
    const contacto = await contactoPorId(contactoId);
    if (contacto.baja) return "baja";

    if ((await enviadosUltimaHora()) >= ajustes.topePorHora) {
      await anotar("aviso", "tope_por_hora", `Se llegó al tope de ${ajustes.topePorHora} envíos por hora. El mensaje queda en espera.`, { automatizacionId: ref.automatizacionId, contactoId });
      return "tope";
    }

    const t = ahora().getTime();
    const ventanaAbierta = !!contacto.ultimo_entrante && t - new Date(contacto.ultimo_entrante).getTime() < VENTANA_MENSAJES;
    const canal = await deps.canal(contacto.canal);
    let destino: Destino;

    if (ventanaAbierta) {
      destino = { usuarioId: contacto.id_externo };
    } else if (evento.tipo === "comentario") {
      const frescos = await base.q<{ privado_enviado: boolean }>("select privado_enviado from eventos where id = $1", [evento.id]);
      if (frescos[0]?.privado_enviado) {
        // Ya salió el único privado que Instagram permite por comentario: hay que esperar a que la persona conteste.
        return "esperar_respuesta";
      }
      if (!canal.capacidades.privadoPorComentario) {
        await anotar("aviso", "fuera_de_ventana", "Este canal no puede escribirle por privado a quien solo comentó.", { automatizacionId: ref.automatizacionId, contactoId });
        return "ventana";
      }
      if (t - new Date(evento.ocurrido).getTime() > VENTANA_COMENTARIO) {
        await anotar("aviso", "fuera_de_ventana", "El comentario tiene más de 7 días: Instagram ya no deja responderlo por privado.", { automatizacionId: ref.automatizacionId, contactoId });
        return "ventana";
      }
      // Marca atómica: si dos procesos llegan juntos, solo uno manda.
      const tomado = await base.q("update eventos set privado_enviado = true where id = $1 and privado_enviado = false returning id", [evento.id]);
      if (!tomado[0]) return "esperar_respuesta";
      destino = { comentarioId: evento.id_externo };
    } else {
      await anotar("aviso", "fuera_de_ventana", "Pasaron más de 24 hs desde el último mensaje de la persona: Instagram no deja escribirle.", { automatizacionId: ref.automatizacionId, contactoId });
      return "ventana";
    }

    const paraMandar = canal.capacidades.botones ? contenido : { texto: opcionesComoTexto(contenido) };
    try {
      const r = await canal.enviarPrivado(destino, paraMandar);
      await guardarMensaje({ contactoId, direccion: "saliente", tipo: "privado", texto: contenido.texto, opciones: contenido.opciones, origen: "bot", automatizacionId: ref.automatizacionId, ejecucionId: ref.ejecucionId, idExterno: r.idExterno, estado: "enviado" });
      return "enviado";
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      if ("comentarioId" in destino) await base.q("update eventos set privado_enviado = false where id = $1", [evento.id]);
      await guardarMensaje({ contactoId, direccion: "saliente", tipo: "privado", texto: contenido.texto, opciones: contenido.opciones, origen: "bot", automatizacionId: ref.automatizacionId, ejecucionId: ref.ejecucionId, estado: "error", error });
      await anotar("error", "envio_fallido", `No se pudo mandar el privado: ${error}`, { automatizacionId: ref.automatizacionId, contactoId });
      return "error";
    }
  }

  function desdeEnvio(r: ResultadoEnvio, ej: Ejecucion): ResultadoPaso | null {
    if (r === "enviado") return null;
    if (r === "esperar_respuesta") return { pausa: "esperando_respuesta", mismoPaso: true };
    if (r === "tope") {
      const intentos = (ej.contexto.reintentosTope ?? 0) + 1;
      if (intentos > MAX_REINTENTOS_TOPE) return { fin: "bloqueada" };
      ej.contexto.reintentosTope = intentos;
      return { pausa: "esperando_tiempo", reanudarEn: new Date(ahora().getTime() + ESPERA_POR_TOPE_MIN * 60000), mismoPaso: true };
    }
    if (r === "baja") return { fin: "cancelada" };
    if (r === "ventana") return { fin: "bloqueada" };
    return { fin: "error" };
  }

  // ─── Pasos ───────────────────────────────────────────────────────────────────

  async function correrPaso(paso: Paso, ej: Ejecucion, evento: EventoGuardado, ajustes: Ajustes): Promise<ResultadoPaso> {
    const ref = { automatizacionId: ej.automatizacion_id, ejecucionId: ej.id };
    const contacto = await contactoPorId(ej.contacto_id);

    switch (paso.tipo) {
      case "responder_comentario": {
        if (evento.tipo !== "comentario") return "seguir";
        const variantes = paso.variantes.map((v) => v.trim()).filter(Boolean);
        if (!variantes.length) return "seguir";
        // Rota las variantes según cuántas respuestas públicas lleva esta automatización.
        const previas = await base.q<{ n: number }>("select count(*)::int as n from mensajes where automatizacion_id = $1 and tipo = 'respuesta_comentario'", [ej.automatizacion_id]);
        const texto = completar(variantes[previas[0].n % variantes.length], contacto);
        try {
          const canal = await deps.canal(contacto.canal);
          const r = await canal.responderComentario(evento.id_externo, texto);
          await guardarMensaje({ contactoId: contacto.id, direccion: "saliente", tipo: "respuesta_comentario", texto, origen: "bot", ...refMensaje(ref), idExterno: r.idExterno, estado: "enviado" });
        } catch (e) {
          const error = e instanceof Error ? e.message : String(e);
          await guardarMensaje({ contactoId: contacto.id, direccion: "saliente", tipo: "respuesta_comentario", texto, origen: "bot", ...refMensaje(ref), estado: "error", error });
          await anotar("error", "envio_fallido", `No se pudo responder el comentario: ${error}`, { automatizacionId: ej.automatizacion_id, contactoId: contacto.id });
        }
        // Si la respuesta pública falla, igual seguimos: el privado es lo importante.
        return "seguir";
      }

      case "enviar_privado":
      case "mensaje_botones": {
        const contenido: ContenidoPrivado = { texto: completar(paso.texto, contacto) };
        if (paso.tipo === "mensaje_botones") contenido.opciones = paso.opciones.filter((o) => o.titulo.trim());
        if (!contenido.texto) return "seguir";
        return desdeEnvio(await enviarPrivadoProtegido(ajustes, contacto.id, evento, contenido, ref), ej) ?? "seguir";
      }

      case "pedir_dato": {
        // Si ya lo tenemos, no lo pedimos de nuevo.
        if (contacto.datos?.[paso.campo]) return "seguir";
        const r = await enviarPrivadoProtegido(ajustes, contacto.id, evento, { texto: completar(paso.pregunta, contacto) }, ref);
        const corte = desdeEnvio(r, ej);
        if (corte) return corte;
        ej.contexto.intentosDato = 0;
        return { pausa: "esperando_dato", mismoPaso: true };
      }

      case "etiqueta": {
        const etiqueta = paso.etiqueta.trim();
        if (!etiqueta) return "seguir";
        if (paso.accion === "poner") {
          await base.q("update contactos set etiquetas = etiquetas || $2::jsonb where id = $1 and not (etiquetas ? $3)", [contacto.id, JSON.stringify([etiqueta]), etiqueta]);
        } else {
          await base.q("update contactos set etiquetas = etiquetas - $2 where id = $1", [contacto.id, etiqueta]);
        }
        return "seguir";
      }

      case "esperar": {
        const minutos = Math.max(1, Math.round(paso.minutos || 1));
        return { pausa: "esperando_tiempo", reanudarEn: new Date(ahora().getTime() + minutos * 60000) };
      }

      case "responder_ia": {
        if (!deps.ia) {
          await anotar("aviso", "ia_apagada", "El paso de IA se salteó: falta la clave del AI Gateway.", { automatizacionId: ej.automatizacion_id, contactoId: contacto.id });
          return "seguir";
        }
        const ultimos = await base.q<{ direccion: string; texto: string }>(
          "select direccion, texto from mensajes where contacto_id = $1 and estado <> 'error' order by creado desc limit 12",
          [contacto.id],
        );
        let texto: string;
        try {
          texto = (await deps.ia({
            instruccionesNegocio: ajustes.instruccionesNegocio,
            instruccionesPaso: paso.instrucciones,
            historial: ultimos.reverse().map((m) => ({ de: m.direccion === "entrante" ? "contacto" : "negocio", texto: m.texto })),
          })).trim();
        } catch (e) {
          await anotar("error", "ia_fallida", `La IA no pudo responder: ${e instanceof Error ? e.message : String(e)}`, { automatizacionId: ej.automatizacion_id, contactoId: contacto.id });
          return "seguir";
        }
        if (!texto) return "seguir";
        return desdeEnvio(await enviarPrivadoProtegido(ajustes, contacto.id, evento, { texto: texto.slice(0, 950) }, ref), ej) ?? "seguir";
      }

      case "avisar_humano": {
        await base.q("update contactos set pide_humano = true, bot_pausado = bot_pausado or $2 where id = $1", [contacto.id, !!paso.pausarBot]);
        const quien = contacto.usuario ? `@${contacto.usuario}` : "Un contacto";
        await anotar("aviso", "aviso_humano", `${quien}: ${paso.nota || "necesita que lo atienda una persona."}`, { automatizacionId: ej.automatizacion_id, contactoId: contacto.id });
        return "seguir";
      }
    }
  }

  const refMensaje = (ref: { automatizacionId: string; ejecucionId: string }) => ({ automatizacionId: ref.automatizacionId, ejecucionId: ref.ejecucionId });

  async function guardarEjecucion(ej: Ejecucion) {
    await base.q(
      "update ejecuciones set estado = $2, paso_actual = $3, reanudar_en = $4::timestamptz, contexto = $5::jsonb, actualizada = $6::timestamptz where id = $1",
      [ej.id, ej.estado, ej.paso_actual, ej.reanudar_en ? iso(ej.reanudar_en) : null, JSON.stringify(ej.contexto), iso(ahora())],
    );
  }

  /** Corre los pasos desde donde quedó hasta terminar o hasta una pausa. */
  async function correr(ej: Ejecucion): Promise<void> {
    const ajustes = await leerAjustes(base);
    const eventos = await base.q<EventoGuardado>("select * from eventos where id = $1", [ej.evento_id]);
    const evento = eventos[0];
    const pasos = ej.contexto.pasos || [];
    ej.estado = "activa";
    ej.reanudar_en = null;

    while (ej.paso_actual < pasos.length) {
      let r: ResultadoPaso;
      try {
        r = await correrPaso(pasos[ej.paso_actual], ej, evento, ajustes);
      } catch (e) {
        await anotar("error", "paso_fallido", `Falló el paso ${ej.paso_actual + 1}: ${e instanceof Error ? e.message : String(e)}`, { automatizacionId: ej.automatizacion_id, contactoId: ej.contacto_id });
        r = { fin: "error" };
      }
      if (r === "seguir") {
        ej.paso_actual += 1;
        await guardarEjecucion(ej);
        continue;
      }
      if ("fin" in r) {
        ej.estado = r.fin;
        await guardarEjecucion(ej);
        return;
      }
      ej.estado = r.pausa;
      ej.reanudar_en = r.reanudarEn ?? null;
      if (!r.mismoPaso) ej.paso_actual += 1;
      await guardarEjecucion(ej);
      return;
    }
    ej.estado = "terminada";
    await guardarEjecucion(ej);
  }

  /** La persona contestó mientras esperábamos un dato: validar y guardar, o volver a pedir. */
  async function recibirDato(ej: Ejecucion, texto: string): Promise<void> {
    const paso = ej.contexto.pasos[ej.paso_actual];
    if (!paso || paso.tipo !== "pedir_dato") {
      await correr(ej);
      return;
    }
    const valor = paso.campo === "mail" ? extraerMail(texto) : extraerTelefono(texto);
    if (valor) {
      await base.q("update contactos set datos = datos || $2::jsonb where id = $1", [ej.contacto_id, JSON.stringify({ [paso.campo]: valor })]);
      await anotar("info", "dato_capturado", `${paso.campo}: ${valor}`, { automatizacionId: ej.automatizacion_id, contactoId: ej.contacto_id });
      ej.paso_actual += 1;
      await correr(ej);
      return;
    }
    const intentos = (ej.contexto.intentosDato ?? 0) + 1;
    ej.contexto.intentosDato = intentos;
    if (intentos > Math.max(0, paso.reintentos ?? 1)) {
      await anotar("aviso", "dato_no_capturado", `No se pudo obtener un ${paso.campo} válido después de ${intentos} respuestas.`, { automatizacionId: ej.automatizacion_id, contactoId: ej.contacto_id });
      ej.estado = "terminada";
      await guardarEjecucion(ej);
      return;
    }
    const ajustes = await leerAjustes(base);
    const eventos = await base.q<EventoGuardado>("select * from eventos where id = $1", [ej.evento_id]);
    const contacto = await contactoPorId(ej.contacto_id);
    const aviso = completar(paso.mensajeError || "No me llegó bien. ¿Me lo pasás de nuevo?", contacto);
    await enviarPrivadoProtegido(ajustes, ej.contacto_id, eventos[0], { texto: aviso }, { automatizacionId: ej.automatizacion_id, ejecucionId: ej.id });
    await guardarEjecucion(ej);
  }

  // ─── Elegir automatización ───────────────────────────────────────────────────

  function peso(a: Automatizacion): number {
    // Lo más específico gana: palabra exacta > contiene > sin palabras; publicación puntual suma.
    let p = 0;
    if (a.disparador.palabras.filter((x) => x.trim()).length) p += a.disparador.coincidencia === "exacta" ? 30 : 20;
    if (a.disparador.postId) p += 5;
    if (a.disparador.tipo === "primer_mensaje") p -= 10;
    return p;
  }

  async function elegir(ev: EventoEntrante, esPrimerMensaje: boolean): Promise<Automatizacion | null> {
    const activas = await base.q<Automatizacion>("select * from automatizaciones where activa = true order by creada");
    const candidatas = activas.filter((a) => {
      const d = a.disparador;
      if (d.tipo === "primer_mensaje") return ev.tipo === "mensaje" && esPrimerMensaje;
      if (d.tipo !== ev.tipo) return false;
      if (d.tipo === "mencion_historia") return true;
      if (d.tipo === "comentario" && d.postId && d.postId !== ev.postId) return false;
      return coincide(ev.texto, d.palabras || [], d.coincidencia || "contiene");
    });
    if (!candidatas.length) return null;
    return candidatas.sort((a, b) => peso(b) - peso(a))[0];
  }

  // ─── Entrada ─────────────────────────────────────────────────────────────────

  /** Punto de entrada único para todo lo que llega de una red o del simulador. */
  async function recibir(ev: EventoEntrante): Promise<{ resultado: ResultadoEvento; eventoId?: string; contactoId?: string; automatizacionId?: string }> {
    const contacto = await resolverContacto(ev);

    // Idempotencia: si el evento ya está guardado, no se hace nada más.
    const nuevos = await base.q<{ id: string }>(
      `insert into eventos (canal, id_externo, tipo, contacto_id, texto, post_id, ocurrido, recibido)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz)
       on conflict (canal, id_externo) do nothing returning id`,
      [ev.canal, ev.idExterno, ev.tipo, contacto.id, ev.texto, ev.postId ?? null, iso(ev.ocurrido), iso(ahora())],
    );
    if (!nuevos[0]) return { resultado: "duplicado" };
    const eventoId = nuevos[0].id;
    const fin = async (resultado: ResultadoEvento, automatizacionId?: string) => {
      await base.q("update eventos set resultado = $2 where id = $1", [eventoId, resultado]);
      return { resultado, eventoId, contactoId: contacto.id, automatizacionId };
    };

    const esPrivado = ev.tipo !== "comentario";
    const esPrimerMensaje = esPrivado && !contacto.ultimo_entrante;
    await guardarMensaje({
      contactoId: contacto.id,
      direccion: "entrante",
      tipo: ev.tipo === "comentario" ? "comentario" : ev.tipo === "mensaje" ? "privado" : "historia",
      texto: ev.texto,
      origen: "contacto",
      idExterno: ev.idExterno,
      estado: "recibido",
      creado: ev.ocurrido,
    });
    if (esPrivado) {
      // Cada mensaje de la persona reabre la ventana de 24 hs.
      await base.q("update contactos set ultimo_entrante = greatest(coalesce(ultimo_entrante, $2::timestamptz), $2::timestamptz) where id = $1", [contacto.id, iso(ev.ocurrido)]);
    }

    const ajustes = await leerAjustes(base);
    const texto = normalizar(ev.texto);

    if (esPrivado && texto && texto === normalizar(ajustes.palabraBaja)) {
      await base.q("update contactos set baja = true where id = $1", [contacto.id]);
      await base.q("update ejecuciones set estado = 'cancelada', actualizada = $2::timestamptz where contacto_id = $1 and estado in ('activa','esperando_tiempo','esperando_dato','esperando_respuesta')", [contacto.id, iso(ahora())]);
      await anotar("info", "baja", "Pidió no recibir más mensajes.", { contactoId: contacto.id });
      await confirmar(contacto, ajustes.mensajeBaja);
      return fin("baja");
    }
    if (esPrivado && contacto.baja && texto === normalizar(ajustes.palabraAlta)) {
      await base.q("update contactos set baja = false where id = $1", [contacto.id]);
      await anotar("info", "alta", "Volvió a aceptar mensajes.", { contactoId: contacto.id });
      await confirmar(contacto, "Listo, volvés a recibir nuestros mensajes.");
      return fin("alta");
    }
    if (contacto.baja) return fin("ignorado_baja");
    if (contacto.bot_pausado) return fin("bot_pausado");

    if (esPrivado) {
      const pendientes = await base.q<Ejecucion>(
        "select * from ejecuciones where contacto_id = $1 and estado in ('esperando_dato','esperando_respuesta') order by actualizada desc limit 1",
        [contacto.id],
      );
      const pendiente = pendientes[0];
      if (pendiente) {
        // Reclamo atómico para que dos avisos del mismo mensaje no la corran dos veces.
        const mia = await base.q("update ejecuciones set estado = 'activa' where id = $1 and estado = $2 returning id", [pendiente.id, pendiente.estado]);
        if (mia[0]) {
          if (pendiente.estado === "esperando_dato") {
            await recibirDato(pendiente, ev.texto);
            return fin("dato_recibido", pendiente.automatizacion_id);
          }
          await correr(pendiente);
          return fin("reanudada", pendiente.automatizacion_id);
        }
      }
    }

    const auto = await elegir(ev, esPrimerMensaje);
    if (!auto) return fin("sin_coincidencia");

    const creadas = await base.q<Ejecucion>(
      `insert into ejecuciones (automatizacion_id, contacto_id, evento_id, estado, contexto, creada, actualizada)
       values ($1, $2, $3, 'activa', $4::jsonb, $5::timestamptz, $5::timestamptz)
       on conflict (automatizacion_id, evento_id) do nothing returning *`,
      [auto.id, contacto.id, eventoId, JSON.stringify({ pasos: auto.pasos }), iso(ahora())],
    );
    if (!creadas[0]) return fin("duplicado");
    await base.q("update contactos set origen_automatizacion_id = coalesce(origen_automatizacion_id, $2) where id = $1", [contacto.id, auto.id]);
    await correr(creadas[0]);
    return fin("automatizacion", auto.id);
  }

  /** Mensajes del sistema (confirmación de baja): no cuentan como automatización. */
  async function confirmar(contacto: Contacto, texto: string) {
    if (!texto.trim()) return;
    try {
      const canal = await deps.canal(contacto.canal);
      const r = await canal.enviarPrivado({ usuarioId: contacto.id_externo }, { texto });
      await guardarMensaje({ contactoId: contacto.id, direccion: "saliente", tipo: "privado", texto, origen: "bot", idExterno: r.idExterno, estado: "enviado" });
    } catch (e) {
      await anotar("error", "envio_fallido", `No se pudo confirmar: ${e instanceof Error ? e.message : String(e)}`, { contactoId: contacto.id });
    }
  }

  /** Reanuda las esperas vencidas. Lo llama el cron cada minuto (o el botón del panel). */
  async function tic(): Promise<{ reanudadas: number; vencidas: number }> {
    const t = iso(ahora());
    // Reclamo atómico: si dos tics se pisan, cada ejecución la toma uno solo.
    const listas = await base.q<Ejecucion>(
      "update ejecuciones set estado = 'activa' where estado = 'esperando_tiempo' and reanudar_en <= $1::timestamptz returning *",
      [t],
    );
    for (const ej of listas) {
      const contacto = await contactoPorId(ej.contacto_id);
      if (contacto.baja || contacto.bot_pausado) {
        ej.estado = "cancelada";
        await guardarEjecucion(ej);
        continue;
      }
      await correr(ej);
    }
    // Quien no contestó en 7 días ya no va a contestar: se cierra.
    const vencidas = await base.q(
      "update ejecuciones set estado = 'cancelada', actualizada = $1::timestamptz where estado in ('esperando_dato','esperando_respuesta') and actualizada < $2::timestamptz returning id",
      [t, iso(new Date(ahora().getTime() - VENTANA_COMENTARIO))],
    );
    return { reanudadas: listas.length, vencidas: vencidas.length };
  }

  /** Respuesta escrita a mano desde la bandeja. Respeta la ventana de 24 hs y la baja. */
  async function enviarManual(contactoId: string, texto: string, opciones: { pausarBot?: boolean } = {}): Promise<{ ok: true } | { ok: false; motivo: string }> {
    const limpio = texto.trim();
    if (!limpio) return { ok: false, motivo: "El mensaje está vacío." };
    const contacto = await contactoPorId(contactoId);
    if (contacto.baja) return { ok: false, motivo: "Esta persona pidió no recibir más mensajes." };
    const abierta = !!contacto.ultimo_entrante && ahora().getTime() - new Date(contacto.ultimo_entrante).getTime() < VENTANA_MENSAJES;
    if (!abierta) return { ok: false, motivo: "Pasaron más de 24 hs desde su último mensaje: Instagram no deja escribirle hasta que vuelva a escribir." };
    try {
      const canal = await deps.canal(contacto.canal);
      const r = await canal.enviarPrivado({ usuarioId: contacto.id_externo }, { texto: limpio });
      await guardarMensaje({ contactoId, direccion: "saliente", tipo: "privado", texto: limpio, origen: "humano", idExterno: r.idExterno, estado: "enviado" });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await guardarMensaje({ contactoId, direccion: "saliente", tipo: "privado", texto: limpio, origen: "humano", estado: "error", error });
      await anotar("error", "envio_fallido", `No se pudo mandar la respuesta manual: ${error}`, { contactoId });
      return { ok: false, motivo: `Instagram rechazó el envío: ${error}` };
    }
    // Cuando una persona toma la charla, el bot se calla para ese contacto.
    await base.q("update contactos set pide_humano = false, bot_pausado = bot_pausado or $2 where id = $1", [contactoId, opciones.pausarBot !== false]);
    return { ok: true };
  }

  return { recibir, tic, enviarManual, anotar };
}

export type Motor = ReturnType<typeof crearMotor>;
