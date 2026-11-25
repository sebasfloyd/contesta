import { abrirLocal, migrar, type Base } from "@/lib/db";
import { CanalSimulado } from "@/lib/canales/simulado";
import type { EventoEntrante } from "@/lib/canales/tipos";
import { crearMotor, type GeneradorIA } from "@/lib/motor/motor";
import type { Contacto, Disparador, Paso } from "@/lib/tipos";

/** Arma un motor completo sobre una base en memoria, con canal simulado y reloj manejable. */
export async function armar(opciones: { ia?: GeneradorIA | null } = {}) {
  const base: Base = await abrirLocal();
  await migrar(base);
  const canal = new CanalSimulado();
  let reloj = new Date("2026-03-02T12:00:00Z");
  const motor = crearMotor({ base, canal: () => canal, ahora: () => reloj, ia: opciones.ia ?? null });
  let n = 0;

  return {
    base,
    canal,
    motor,
    ahora: () => reloj,
    adelantar(minutos: number) {
      reloj = new Date(reloj.getTime() + minutos * 60000);
    },
    async automatizacion(nombre: string, disparador: Partial<Disparador> & { tipo: Disparador["tipo"] }, pasos: Paso[], activa = true) {
      const d: Disparador = { palabras: [], coincidencia: "contiene", postId: null, ...disparador };
      const filas = await base.q<{ id: string }>(
        "insert into automatizaciones (nombre, activa, disparador, pasos, creada) values ($1, $2, $3::jsonb, $4::jsonb, $5::timestamptz) returning id",
        [nombre, activa, JSON.stringify(d), JSON.stringify(pasos), reloj.toISOString()],
      );
      return filas[0].id;
    },
    evento(tipo: EventoEntrante["tipo"], usuario: string, texto: string, extra: Partial<EventoEntrante> = {}): EventoEntrante {
      n += 1;
      return { canal: "simulado", idExterno: `ev_${n}`, tipo, de: { idExterno: `sim_${usuario}`, usuario }, texto, ocurrido: reloj, ...extra };
    },
    comentar(usuario: string, texto: string, postId = "post_demo_1") {
      return motor.recibir(this.evento("comentario", usuario, texto, { postId }));
    },
    escribir(usuario: string, texto: string) {
      return motor.recibir(this.evento("mensaje", usuario, texto));
    },
    async contacto(usuario: string): Promise<Contacto> {
      return (await base.q<Contacto>("select * from contactos where usuario = $1", [usuario]))[0];
    },
    async registro(tipo: string) {
      return base.q<{ detalle: string }>("select detalle from registro where tipo = $1 order by creado", [tipo]);
    },
    privados() {
      return canal.enviados.filter((e) => e.clase === "privado");
    },
    publicas() {
      return canal.enviados.filter((e) => e.clase === "respuesta_comentario");
    },
  };
}
