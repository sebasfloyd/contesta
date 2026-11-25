import { describe, expect, it } from "vitest";
import { abrirPostgres } from "@/lib/db";
import { migrar } from "@/lib/migraciones";
import { CanalSimulado } from "@/lib/canales/simulado";
import { crearMotor } from "@/lib/motor/motor";
import { PLANTILLAS } from "@/lib/plantillas";

// Opcional: corre el mismo flujo contra un Postgres de verdad (el driver que se usa con Supabase).
// Solo se ejecuta si definís PRUEBA_DATABASE_URL apuntando a una base VACÍA y descartable.
// Ejemplo: PRUEBA_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres npm test
const url = process.env.PRUEBA_DATABASE_URL;

describe.skipIf(!url)("contra Postgres real", () => {
  it("comentario → pedido de mail → contacto etiquetado, sin duplicar", async () => {
    const base = await abrirPostgres(url!);
    try {
      await migrar(base);
      const canal = new CanalSimulado();
      const motor = crearMotor({ base, canal: () => canal });
      const p = PLANTILLAS.find((x) => x.clave === "mail")!;
      await base.q("insert into automatizaciones (nombre, activa, disparador, pasos) values ($1, true, $2::jsonb, $3::jsonb)", [p.nombre, JSON.stringify(p.disparador), JSON.stringify(p.pasos)]);
      const id = `prueba_${Date.now()}`;
      const ev = { canal: "simulado", idExterno: id, tipo: "comentario" as const, de: { idExterno: `sim_${id}`, usuario: id }, texto: "RECURSO", postId: "post_demo_1", ocurrido: new Date() };
      expect((await motor.recibir(ev)).resultado).toBe("automatizacion");
      expect((await motor.recibir(ev)).resultado).toBe("duplicado");
      expect((await motor.recibir({ ...ev, idExterno: id + "_m", tipo: "mensaje", texto: "prueba@ejemplo.com", postId: null })).resultado).toBe("dato_recibido");
      const c = (await base.q<{ etiquetas: string[]; datos: Record<string, string> }>("select etiquetas, datos from contactos where usuario = $1", [id]))[0];
      expect(c.etiquetas).toEqual(["recurso"]);
      expect(c.datos.mail).toBe("prueba@ejemplo.com");
      expect(canal.enviados).toHaveLength(3);
    } finally {
      await base.cerrar();
    }
  });
});
