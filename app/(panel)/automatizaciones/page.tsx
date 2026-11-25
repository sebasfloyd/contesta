import Link from "next/link";
import { estadisticas, automatizaciones } from "@/lib/consultas";
import { PLANTILLAS } from "@/lib/plantillas";
import { cambiarEstado, crearDesdePlantilla, duplicar } from "../../acciones";
import { Interruptor } from "../../_ui/piezas";
import { ResumenDisparador } from "../../_ui/resumen-regla";

export const metadata = { title: "Automatizaciones" };

export default async function Automatizaciones() {
  const [lista, numeros] = await Promise.all([automatizaciones(), estadisticas()]);
  const porId = new Map(numeros.map((n) => [n.id, n]));
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Automatizaciones</h1>
          <p>Cada una tiene un disparador y una lista de pasos que se cumplen en orden.</p>
        </div>
        <Link href="/automatizaciones/nueva" className="boton verde">Nueva automatización</Link>
      </div>

      {lista.length === 0 ? (
        <div className="vacio">Todavía no tenés ninguna. Empezá con una plantilla de acá abajo.</div>
      ) : (
        <div className="lista">
          {lista.map((a) => {
            const n = porId.get(a.id);
            return (
              <div key={a.id} className="item">
                <Interruptor activo={a.activa} nombre={`Activar ${a.nombre}`} alCambiar={cambiarEstado.bind(null, a.id)} />
                <div className="item-cuerpo">
                  <Link href={`/automatizaciones/${a.id}`} className="item-titulo">{a.nombre}</Link>
                  <ResumenDisparador d={a.disparador} />
                </div>
                <span className="chico tenue ocultar-movil" style={{ textAlign: "right" }}>
                  {a.pasos.length} {a.pasos.length === 1 ? "paso" : "pasos"} · {n?.disparos ?? 0} {n?.disparos === 1 ? "disparo" : "disparos"}
                </span>
                <form action={duplicar.bind(null, a.id)}><button className="boton claro mini">Duplicar</button></form>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ margin: "30px 0 12px" }}>Plantillas</h2>
      <div className="lista">
        {PLANTILLAS.map((p) => (
          <div key={p.clave} className="item">
            <div className="item-cuerpo">
              <span style={{ fontWeight: 650 }}>{p.nombre}</span>
              <span className="chico tenue">{p.descripcion}</span>
            </div>
            <form action={crearDesdePlantilla.bind(null, p.clave)}><button className="boton claro mini">Usar</button></form>
          </div>
        ))}
      </div>
      <p className="ayuda" style={{ marginTop: 10 }}>Las plantillas se crean pausadas: cambiá los textos y los links, probalas en el simulador y recién ahí activalas.</p>
    </>
  );
}
