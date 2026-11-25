// Tipos compartidos por el motor, los canales y el panel.

export type TipoEvento = "comentario" | "mensaje" | "respuesta_historia" | "mencion_historia";
export type TipoDisparador = TipoEvento | "primer_mensaje";
export type Coincidencia = "contiene" | "exacta";

export type Disparador = {
  tipo: TipoDisparador;
  /** Palabras clave. Vacío = cualquier texto. */
  palabras: string[];
  coincidencia: Coincidencia;
  /** Solo para comentarios: id de la publicación. Vacío = todas. */
  postId?: string | null;
};

export type Opcion = { titulo: string; url?: string };

export type Paso =
  | { tipo: "responder_comentario"; variantes: string[] }
  | { tipo: "enviar_privado"; texto: string }
  | { tipo: "mensaje_botones"; texto: string; opciones: Opcion[] }
  | { tipo: "pedir_dato"; campo: "mail" | "telefono"; pregunta: string; mensajeError: string; reintentos: number }
  | { tipo: "etiqueta"; accion: "poner" | "sacar"; etiqueta: string }
  | { tipo: "esperar"; minutos: number }
  | { tipo: "responder_ia"; instrucciones: string }
  | { tipo: "avisar_humano"; nota: string; pausarBot: boolean };

export type TipoPaso = Paso["tipo"];

export type Automatizacion = {
  id: string;
  nombre: string;
  activa: boolean;
  disparador: Disparador;
  pasos: Paso[];
  creada: Date;
  actualizada: Date;
};

export type Contacto = {
  id: string;
  canal: string;
  id_externo: string;
  usuario: string | null;
  nombre: string | null;
  etiquetas: string[];
  datos: Record<string, string>;
  origen_automatizacion_id: string | null;
  bot_pausado: boolean;
  baja: boolean;
  pide_humano: boolean;
  ultimo_entrante: Date | null;
  ultimo_movimiento: Date;
  creado: Date;
};

export type EventoGuardado = {
  id: string;
  canal: string;
  id_externo: string;
  tipo: TipoEvento;
  contacto_id: string;
  texto: string;
  post_id: string | null;
  ocurrido: Date;
  privado_enviado: boolean;
};

export type EstadoEjecucion =
  | "activa"
  | "esperando_tiempo"
  | "esperando_dato"
  | "esperando_respuesta"
  | "terminada"
  | "bloqueada"
  | "cancelada"
  | "error";

export type Ejecucion = {
  id: string;
  automatizacion_id: string;
  contacto_id: string;
  evento_id: string;
  estado: EstadoEjecucion;
  paso_actual: number;
  reanudar_en: Date | null;
  contexto: { pasos: Paso[]; intentosDato?: number; reintentosTope?: number };
};

export type Mensaje = {
  id: string;
  contacto_id: string;
  direccion: "entrante" | "saliente";
  tipo: "privado" | "comentario" | "respuesta_comentario" | "historia";
  texto: string;
  opciones: Opcion[] | null;
  origen: "contacto" | "bot" | "humano";
  automatizacion_id: string | null;
  estado: "recibido" | "enviado" | "error";
  error: string | null;
  creado: Date;
};

export type Ajustes = {
  palabraBaja: string;
  palabraAlta: string;
  mensajeBaja: string;
  topePorHora: number;
  instruccionesNegocio: string;
  consultaCadaMinutos: number;
  postsARevisar: number;
};

export const AJUSTES_INICIALES: Ajustes = {
  palabraBaja: "BASTA",
  palabraAlta: "VOLVER",
  mensajeBaja: "Listo, no te escribimos más. Si querés volver, mandá VOLVER.",
  topePorHora: 60,
  instruccionesNegocio: "",
  consultaCadaMinutos: 10,
  postsARevisar: 10,
};

export const NOMBRES_DISPARADOR: Record<TipoDisparador, string> = {
  comentario: "Comentario en una publicación",
  mensaje: "Mensaje privado",
  respuesta_historia: "Respuesta a una historia",
  mencion_historia: "Mención en una historia",
  primer_mensaje: "Primer mensaje de alguien nuevo",
};

export const NOMBRES_PASO: Record<TipoPaso, string> = {
  responder_comentario: "Responder el comentario en público",
  enviar_privado: "Mandar mensaje privado",
  mensaje_botones: "Mandar mensaje con botones",
  pedir_dato: "Pedir un dato y guardarlo",
  etiqueta: "Poner o sacar etiqueta",
  esperar: "Esperar",
  responder_ia: "Responder con IA",
  avisar_humano: "Avisar a una persona",
};
