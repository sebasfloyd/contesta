import Link from "next/link";
import { base } from "@/lib/db";
import { contacto, mensajesDe } from "@/lib/consultas";
import type { Contacto } from "@/lib/tipos";
import { borrarPruebas, cerrarVentana, saltarEsperas } from "../../acciones";
import { Charla } from "../../_ui/charla";
import { BotonAccion } from "../../_ui/piezas";
import { FormularioSimulador } from "./formulario";

export const metadata = { title: "Simulador" };

const ESTADOS: Record<string, string> = {
  esperando_tiempo: "Esperando que pase el tiempo",
  esperando_dato: "Esperando que mande el dato",
  esperando_respuesta: "Esperando que conteste para poder seguir",
};

export default async function Simulador({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const b = await base();
  const elegido = (await searchParams).c;
  const pruebas = await b.q<Contacto>("select * from contactos where canal = 'simulado' order by ultimo_movimiento desc limit 30");
  const actual = elegido ? await contacto(elegido) : pruebas[0] ? await contacto(pruebas[0].id) : null;
  const mensajes = actual ? await mensajesDe(actual.id) : [];
  const esperas = actual
    ? await b.q<{ estado: string; nombre: string }>(
        "select e.estado, a.nombre from ejecuciones e join automatizaciones a on a.id = e.automatizacion_id where e.contacto_id = $1 and e.estado in ('esperando_tiempo','esperando_dato','esperando_respuesta')",
        [actual.id],
      )
    : [];
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Simulador</h1>
          <p>Hacé de cuenta que alguien comenta o te escribe y mirá qué haría Contesta. Nada de esto sale a Instagram.</p>
        </div>
      </div>

      <div className="dos" style={{ alignItems: "start" }}>
        <div className="pila">
          <FormularioSimulador usuario={actual?.usuario || "lector_demo"} />
          {pruebas.length > 0 && (
            <section className="tarjeta">
              <div className="fila entre" style={{ marginBottom: 8 }}>
                <h2>Contactos de prueba</h2>
                <BotonAccion clase="boton peligro mini" confirmar="¿Borrar todos los contactos de prueba y sus conversaciones?" accion={borrarPruebas}>Borrar pruebas</BotonAccion>
              </div>
              <div className="fila" style={{ gap: 6 }}>
                {pruebas.map((p) => (
                  <Link key={p.id} href={`/simulador?c=${p.id}`} className={`etiqueta ${actual?.id === p.id ? "verde" : ""}`} style={{ textDecoration: "none" }}>@{p.usuario}</Link>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="pila">
          {actual ? (
            <>
              <div className="fila entre">
                <h2>Conversación con @{actual.usuario}</h2>
                <Link href={`/contactos/${actual.id}`} className="chico">Ver ficha</Link>
              </div>
              <Charla mensajes={mensajes} />
              {esperas.map((e, i) => <p key={i} className="aviso">{ESTADOS[e.estado]} · {e.nombre}</p>)}
              <div className="fila">
                <BotonAccion accion={saltarEsperas.bind(null, actual.id)} clase="boton claro mini">Saltar las esperas</BotonAccion>
                <BotonAccion accion={cerrarVentana.bind(null, actual.id)} clase="boton claro mini">Simular que pasaron 25 hs</BotonAccion>
              </div>
              <p className="ayuda">Las líneas punteadas son comentarios públicos. Lo verde es lo que mandó el bot.</p>
            </>
          ) : (
            <div className="vacio">Mandá el primer comentario o mensaje de prueba y acá vas a ver la conversación.</div>
          )}
        </div>
      </div>
    </>
  );
}
