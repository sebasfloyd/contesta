import Link from "next/link";
import { base } from "@/lib/db";
import { leerAjustes, leerConexion } from "@/lib/ajustes";
import { registro, resumen } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";
import { iaDisponible } from "@/lib/ia";

export default async function Inicio() {
  const b = await base();
  const [r, ajustes, cx, problemas] = await Promise.all([resumen(), leerAjustes(b), leerConexion(b), registro({ soloProblemas: true, limite: 6 })]);
  const conectado = cx?.estado === "activa";
  const usoTope = Math.min(100, Math.round((r.enviados_hora / ajustes.topePorHora) * 100));
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Inicio</h1>
          <p>Cómo viene tu cuenta ahora.</p>
        </div>
        <Link href="/automatizaciones/nueva" className="boton verde">Nueva automatización</Link>
      </div>

      <div className="pila">
        {!conectado && (
          <div className="aviso">
            Instagram todavía no está conectado. Podés armar y probar todo con el <Link href="/simulador">simulador</Link>, y cuando quieras <Link href="/conexion">conectás tu cuenta</Link>.
          </div>
        )}
        {r.piden_humano > 0 && (
          <div className="aviso">
            {r.piden_humano === 1 ? "Una persona pide" : `${r.piden_humano} personas piden`} hablar con alguien. <Link href="/bandeja">Abrir la bandeja</Link>
          </div>
        )}

        <div className="numeros">
          <div className="numero"><b>{r.automatizaciones_activas}</b><span>automatizaciones activas</span></div>
          <div className="numero"><b>{r.contactos}</b><span>contactos</span></div>
          <div className="numero"><b>{r.enviados_hoy}</b><span>mensajes enviados en 24 hs</span></div>
          <div className="numero">
            <b>{r.enviados_hora}<span style={{ fontSize: 15 }}> / {ajustes.topePorHora}</span></b>
            <span>envíos del bot en la última hora</span>
            <div className="barra"><i style={{ width: `${usoTope}%` }} /></div>
          </div>
        </div>

        <section className="tarjeta">
          <div className="fila entre" style={{ marginBottom: 10 }}>
            <h2>Avisos y errores recientes</h2>
            <Link href="/registro" className="chico tenue">Ver todo el registro</Link>
          </div>
          {problemas.length === 0 ? (
            <p className="tenue">Nada para revisar.</p>
          ) : (
            <div className="pila" style={{ gap: 8 }}>
              {problemas.map((p) => (
                <div key={p.id} className="fila" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                  <span className={`etiqueta ${p.nivel === "error" ? "roja" : "ambar"}`}>{p.nivel === "error" ? "Error" : "Aviso"}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    {p.detalle}
                    <span className="tenue chico"> · {[p.automatizacion_nombre, fechaCorta(p.creado)].filter(Boolean).join(" · ")}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="tarjeta">
          <h2 style={{ marginBottom: 10 }}>Protecciones activas</h2>
          <div className="pila chico" style={{ gap: 6 }}>
            <div>Palabra de baja: <span className="palabra">{ajustes.palabraBaja}</span> frena todos los mensajes para quien la escriba.</div>
            <div>Tope: hasta {ajustes.topePorHora} envíos del bot por hora. Lo que sobra espera.</div>
            <div>Ventana de Instagram: solo se escribe por privado dentro de las 24 hs del último mensaje de la persona, y un único privado por comentario.</div>
            <div>Respuestas con IA: {iaDisponible() ? "prendidas." : "apagadas (falta la clave del AI Gateway)."}</div>
            <div>{r.en_espera} {r.en_espera === 1 ? "conversación en espera" : "conversaciones en espera"} de tiempo o de una respuesta.</div>
          </div>
          <div style={{ marginTop: 12 }}><Link href="/ajustes" className="boton claro mini">Cambiar ajustes</Link></div>
        </section>
      </div>
    </>
  );
}
