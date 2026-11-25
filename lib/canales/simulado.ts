import type { Canal, ContenidoPrivado, Destino, EventoEntrante } from "./tipos";

export type EnvioSimulado =
  | { clase: "respuesta_comentario"; comentarioId: string; texto: string }
  | { clase: "privado"; destino: Destino; contenido: ContenidoPrivado };

/**
 * Canal de mentira: no manda nada a ningún lado. Anota lo que "saldría" para poder
 * probar las automatizaciones sin Instagram. Los eventos entran por el simulador del panel.
 */
export class CanalSimulado implements Canal {
  nombre = "simulado";
  capacidades = { privadoPorComentario: true, botones: true, historias: true };
  /** Lo que el motor mandó, en orden (para tests). */
  enviados: EnvioSimulado[] = [];
  /** Si se define, el próximo envío falla con este error (para probar el registro de errores). */
  fallarCon: string | null = null;
  private n = 0;

  private salir(envio: EnvioSimulado) {
    if (this.fallarCon) {
      const error = this.fallarCon;
      this.fallarCon = null;
      throw new Error(error);
    }
    this.enviados.push(envio);
    this.n += 1;
    return { idExterno: `sim_salida_${Date.now()}_${this.n}` };
  }

  async traerEventos(): Promise<EventoEntrante[]> {
    return [];
  }
  async responderComentario(comentarioId: string, texto: string) {
    return this.salir({ clase: "respuesta_comentario", comentarioId, texto });
  }
  async enviarPrivado(destino: Destino, contenido: ContenidoPrivado) {
    return this.salir({ clase: "privado", destino, contenido });
  }
  async estado() {
    return { conectado: true, usuario: "cuenta_de_prueba", detalle: "Canal simulado: nada sale a Instagram." };
  }
  async publicaciones() {
    return [
      { id: "post_demo_1", texto: "Publicación de prueba 1: la guía" },
      { id: "post_demo_2", texto: "Publicación de prueba 2: el taller" },
    ];
  }
}
