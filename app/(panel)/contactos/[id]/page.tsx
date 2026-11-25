import Link from "next/link";
import { notFound } from "next/navigation";
import { contacto, mensajesDe } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";
import { agregarEtiqueta, borrarContacto, cambiarEtiqueta, pausarBot } from "../../../acciones";
import { Charla } from "../../../_ui/charla";
import { BotonAccion } from "../../../_ui/piezas";

export const metadata = { title: "Contacto" };

export default async function Ficha({ params }: { params: Promise<{ id: string }> }) {
  const c = await contacto((await params).id);
  if (!c) notFound();
  const mensajes = await mensajesDe(c.id);
  const datos = Object.entries(c.datos);
  return (
    <>
      <Link href="/contactos" className="volver">← Contactos</Link>
      <div className="cabecera">
        <div>
          <h1>@{c.usuario || c.id_externo}</h1>
          <p>{c.canal === "simulado" ? "Contacto de prueba del simulador" : "Instagram"} · desde el {fechaCorta(c.creado)}{c.origen_nombre ? ` · llegó por «${c.origen_nombre}»` : ""}</p>
        </div>
        <Link href={`/bandeja/${c.id}`} className="boton">Abrir conversación</Link>
      </div>

      <div className="pila">
        <section className="tarjeta">
          <h2 style={{ marginBottom: 10 }}>Datos</h2>
          {datos.length === 0 ? <p className="tenue">Todavía no dejó ningún dato.</p> : (
            <div className="pila" style={{ gap: 4 }}>
              {datos.map(([k, v]) => <div key={k}><span className="tenue">{k}:</span> <b>{v}</b></div>)}
            </div>
          )}
          <div className="fila" style={{ marginTop: 12, gap: 6 }}>
            {c.baja && <span className="etiqueta roja">Pidió la baja</span>}
            {c.bot_pausado && <span className="etiqueta">Bot pausado</span>}
            {c.pide_humano && <span className="etiqueta ambar">Pide una persona</span>}
          </div>
        </section>

        <section className="tarjeta">
          <h2 style={{ marginBottom: 10 }}>Etiquetas</h2>
          <div className="fila" style={{ gap: 6 }}>
            {c.etiquetas.length === 0 && <span className="tenue">Sin etiquetas.</span>}
            {c.etiquetas.map((e) => (
              <form key={e} action={cambiarEtiqueta.bind(null, c.id, e, false)}>
                <span className="etiqueta verde">{e}<button aria-label={`Sacar la etiqueta ${e}`}>✕</button></span>
              </form>
            ))}
          </div>
          <form action={agregarEtiqueta.bind(null, c.id)} className="fila" style={{ marginTop: 12 }}>
            <input type="text" name="etiqueta" placeholder="Nueva etiqueta" aria-label="Nueva etiqueta" maxLength={40} style={{ maxWidth: 220 }} required />
            <button className="boton claro">Agregar</button>
          </form>
        </section>

        <section>
          <h2 style={{ margin: "8px 0 10px" }}>Historial</h2>
          <Charla mensajes={mensajes} />
        </section>

        <div className="fila">
          <form action={pausarBot.bind(null, c.id, !c.bot_pausado)}><button className="boton claro">{c.bot_pausado ? "Reactivar el bot" : "Pausar el bot"}</button></form>
          <BotonAccion clase="boton peligro" confirmar="¿Borrar este contacto y toda su conversación?" accion={borrarContacto.bind(null, c.id)}>Borrar contacto</BotonAccion>
        </div>
      </div>
    </>
  );
}
