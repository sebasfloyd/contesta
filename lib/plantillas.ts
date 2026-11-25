import type { Disparador, Paso } from "./tipos";

export type Plantilla = { clave: string; nombre: string; descripcion: string; disparador: Disparador; pasos: Paso[] };

/** Automatizaciones listas para usar. Se crean pausadas: revisá los textos y los links antes de activarlas. */
export const PLANTILLAS: Plantilla[] = [
  {
    clave: "guia",
    nombre: "Comentá GUÍA y te la mando",
    descripcion: "Alguien comenta la palabra, le respondés en público y le llega el link por privado.",
    disparador: { tipo: "comentario", palabras: ["guía"], coincidencia: "contiene", postId: null },
    pasos: [
      { tipo: "responder_comentario", variantes: ["¡Listo! Te la mandé por privado.", "Ya la tenés en tus mensajes.", "Mirá tus mensajes, ahí te la dejé."] },
      { tipo: "enviar_privado", texto: "¡Hola {{nombre}}! Acá tenés la guía: https://tusitio.com/guia" },
      { tipo: "etiqueta", accion: "poner", etiqueta: "guía" },
    ],
  },
  {
    clave: "mail",
    nombre: "Pedir mail para el recurso",
    descripcion: "Antes de mandar el recurso pide el mail, lo valida y lo guarda en el contacto.",
    disparador: { tipo: "comentario", palabras: ["recurso"], coincidencia: "contiene", postId: null },
    pasos: [
      { tipo: "responder_comentario", variantes: ["¡Genial! Te escribí por privado.", "Te mandé un mensaje para pasártelo."] },
      { tipo: "pedir_dato", campo: "mail", pregunta: "¡Hola {{nombre}}! ¿A qué mail te mando el recurso?", mensajeError: "Ese mail no me cierra. ¿Me lo escribís de nuevo?", reintentos: 1 },
      { tipo: "etiqueta", accion: "poner", etiqueta: "recurso" },
      { tipo: "enviar_privado", texto: "Gracias. Te lo mando a {{mail}}. También lo podés bajar acá: https://tusitio.com/recurso" },
    ],
  },
  {
    clave: "bienvenida",
    nombre: "Bienvenida",
    descripcion: "La primera vez que alguien escribe, saluda y ofrece opciones.",
    disparador: { tipo: "primer_mensaje", palabras: [], coincidencia: "contiene", postId: null },
    pasos: [
      { tipo: "mensaje_botones", texto: "¡Hola {{nombre}}! Gracias por escribir. ¿Qué necesitás?", opciones: [{ titulo: "Precios" }, { titulo: "Hablar con alguien" }] },
      { tipo: "etiqueta", accion: "poner", etiqueta: "nuevo" },
    ],
  },
  {
    clave: "precios",
    nombre: "Precios por privado",
    descripcion: "Responde cuando preguntan el precio y hace un seguimiento una hora después.",
    disparador: { tipo: "mensaje", palabras: ["precio", "precios", "cuánto sale"], coincidencia: "contiene", postId: null },
    pasos: [
      { tipo: "enviar_privado", texto: "Te paso los precios: https://tusitio.com/precios" },
      { tipo: "etiqueta", accion: "poner", etiqueta: "pidió precios" },
      { tipo: "esperar", minutos: 60 },
      { tipo: "enviar_privado", texto: "¿Te quedó alguna duda con los precios?" },
    ],
  },
  {
    clave: "persona",
    nombre: "Hablar con una persona",
    descripcion: "Avisa al equipo y pausa el bot para que alguien siga la charla a mano.",
    disparador: { tipo: "mensaje", palabras: ["hablar con alguien", "humano", "asesor"], coincidencia: "contiene", postId: null },
    pasos: [
      { tipo: "enviar_privado", texto: "Dale, ya le avisé al equipo. En un rato te contestan por acá." },
      { tipo: "avisar_humano", nota: "pidió hablar con una persona.", pausarBot: true },
    ],
  },
];
