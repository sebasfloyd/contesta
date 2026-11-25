import { base } from "./db";
import { CanalSimulado } from "./canales/simulado";
import { CanalInstagram } from "./canales/composio";
import type { Canal } from "./canales/tipos";
import { crearMotor } from "./motor/motor";
import { generadorIA } from "./ia";
import { leerAjustes, leerConexion, guardarConexion } from "./ajustes";

const simulado = new CanalSimulado();

/** Cada contacto recuerda por qué canal llegó: los de prueba nunca salen a Instagram. */
export async function canalPorNombre(nombre: string): Promise<Canal> {
  if (nombre === "simulado") return simulado;
  if (nombre === "instagram") return new CanalInstagram(await base());
  throw new Error(`Canal desconocido: ${nombre}`);
}

export async function motor() {
  return crearMotor({ base: await base(), canal: canalPorNombre, ia: generadorIA() });
}

/**
 * Lo que corre cada minuto: reanuda esperas y, si ya pasó el intervalo configurado,
 * trae comentarios y mensajes nuevos de Instagram.
 */
export async function latido(opciones: { forzarConsulta?: boolean } = {}) {
  const b = await base();
  const m = await motor();
  const salida = { reanudadas: 0, consultado: false, nuevos: 0, error: null as string | null };
  salida.reanudadas = (await m.tic()).reanudadas;

  const cx = await leerConexion(b);
  if (!cx || cx.estado !== "activa" || !process.env.COMPOSIO_API_KEY) return salida;
  const ajustes = await leerAjustes(b);
  const ultima = cx.ultimaConsulta ? new Date(cx.ultimaConsulta).getTime() : 0;
  // 20 segundos de margen para que un cron que llega un poco antes no saltee la vuelta.
  if (!opciones.forzarConsulta && Date.now() - ultima < ajustes.consultaCadaMinutos * 60000 - 20000) return salida;

  try {
    const canal = await canalPorNombre("instagram");
    const eventos = await canal.traerEventos();
    salida.consultado = true;
    if (eventos.length) {
      // Se descartan de entrada los ya vistos, así no se toca la base por cada uno.
      const vistos = new Set(
        (await b.q<{ id_externo: string }>(
          "select id_externo from eventos where canal = 'instagram' and id_externo in (select jsonb_array_elements_text($1::jsonb))",
          [JSON.stringify(eventos.map((e) => e.idExterno))],
        )).map((f) => f.id_externo),
      );
      for (const ev of eventos) {
        if (vistos.has(ev.idExterno)) continue;
        const r = await m.recibir(ev);
        if (r.resultado !== "duplicado") salida.nuevos += 1;
      }
    }
  } catch (e) {
    salida.error = e instanceof Error ? e.message : String(e);
    await m.anotar("error", "consulta_fallida", `No se pudo consultar Instagram: ${salida.error}`);
    const actual = await leerConexion(b);
    if (actual) await guardarConexion(b, { ...actual, ultimaConsulta: new Date().toISOString(), ultimoError: salida.error });
  }
  return salida;
}
