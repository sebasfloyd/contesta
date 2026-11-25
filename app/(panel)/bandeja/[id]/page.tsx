import Link from "next/link";
import { notFound } from "next/navigation";
import { contacto, mensajesDe } from "@/lib/consultas";
import { ventanaAbierta } from "@/lib/texto";
import { marcarAtendido, pausarBot, responderAMano } from "../../../acciones";
import { Charla } from "../../../_ui/charla";
import { Redactar } from "./redactar";

export const metadata = { title: "Conversación" };

export default async function Conversacion({ params }: { params: Promise<{ id: string }> }) {
  const c = await contacto((await params).id);
  if (!c) notFound();
  const mensajes = await mensajesDe(c.id);
  const abierta = ventanaAbierta(c.ultimo_entrante);
  return (
    <>
      <Link href="/bandeja" className="volver">← Bandeja</Link>
      <div className="cabecera">
        <div>
          <h1>@{c.usuario || c.id_externo}</h1>
          <p className="fila" style={{ gap: 6 }}>
            {c.canal === "simulado" && <span className="etiqueta">Contacto de prueba</span>}
            {c.baja && <span className="etiqueta roja">Pidió la baja</span>}
            {c.etiquetas.map((e) => <span key={e} className="etiqueta verde">{e}</span>)}
            <Link href={`/contactos/${c.id}`} className="chico">Ver ficha</Link>
          </p>
        </div>
        <div className="fila">
          {c.pide_humano && <form action={marcarAtendido.bind(null, c.id)}><button className="boton claro mini">Marcar como atendido</button></form>}
          <form action={pausarBot.bind(null, c.id, !c.bot_pausado)}>
            <button className={`boton mini ${c.bot_pausado ? "verde" : "claro"}`}>{c.bot_pausado ? "Reactivar el bot" : "Pausar el bot"}</button>
          </form>
        </div>
      </div>

      {c.bot_pausado && <p className="aviso" style={{ marginBottom: 12 }}>El bot está pausado para esta persona: lo que escriba no dispara automatizaciones hasta que lo reactives.</p>}
      <Charla mensajes={mensajes} />

      {c.baja ? (
        <p className="aviso rojo" style={{ marginTop: 12 }}>Esta persona pidió no recibir más mensajes.</p>
      ) : abierta ? (
        <Redactar accion={responderAMano.bind(null, c.id)} />
      ) : (
        <p className="aviso" style={{ marginTop: 12 }}>No se le puede escribir: Instagram solo permite mensajes dentro de las 24 hs desde el último mensaje de la persona.</p>
      )}
    </>
  );
}
