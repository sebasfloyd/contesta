import type { Opcion, TipoEvento } from "../tipos";

/** Lo que entra desde una red: un comentario, un privado, algo de una historia. */
export type EventoEntrante = {
  canal: string;
  /** Id único del comentario o del mensaje en la red. Con esto se evita procesar dos veces lo mismo. */
  idExterno: string;
  tipo: TipoEvento;
  de: { idExterno: string; usuario?: string | null; nombre?: string | null };
  texto: string;
  /** Solo comentarios: id de la publicación. */
  postId?: string | null;
  ocurrido: Date;
};

export type Destino =
  /** Privado común: solo vale dentro de las 24 hs desde el último mensaje de la persona. */
  | { usuarioId: string }
  /** Respuesta privada a un comentario: una sola por comentario, hasta 7 días después. */
  | { comentarioId: string };

export type ContenidoPrivado = { texto: string; opciones?: Opcion[] };

export type Capacidades = {
  /** Mandar un privado a quien comentó, aunque nunca haya escrito. */
  privadoPorComentario: boolean;
  /** Botones y respuestas rápidas nativas. Si no, las opciones van como texto. */
  botones: boolean;
  /** Avisa de respuestas y menciones en historias. */
  historias: boolean;
};

export type EstadoCanal = {
  conectado: boolean;
  usuario?: string | null;
  detalle: string;
};

export type Publicacion = { id: string; texto: string; enlace?: string | null; fecha?: string | null };

/**
 * Un canal es una red por la que entran y salen mensajes. Las reglas no saben nada de
 * Instagram ni de Composio: solo hablan con esta interfaz. Para sumar otro canal
 * (token directo de Meta, WhatsApp) alcanza con escribir otra implementación.
 */
export interface Canal {
  nombre: string;
  capacidades: Capacidades;
  /** Trae lo nuevo desde la red (consulta periódica). Puede repetir eventos: el motor descarta los ya vistos. */
  traerEventos(): Promise<EventoEntrante[]>;
  responderComentario(comentarioId: string, texto: string): Promise<{ idExterno: string }>;
  enviarPrivado(destino: Destino, contenido: ContenidoPrivado): Promise<{ idExterno: string }>;
  estado(): Promise<EstadoCanal>;
  publicaciones(): Promise<Publicacion[]>;
}

/** Texto de respaldo cuando el canal no tiene botones: las opciones van numeradas. */
export function opcionesComoTexto(contenido: ContenidoPrivado): string {
  if (!contenido.opciones?.length) return contenido.texto;
  const lineas = contenido.opciones.map((o) => (o.url ? `${o.titulo}: ${o.url}` : `• ${o.titulo}`));
  return `${contenido.texto}\n\n${lineas.join("\n")}`;
}
