"use client";

import { useActionState } from "react";
import type { Ajustes } from "@/lib/tipos";
import { guardarAjustesGenerales } from "../../acciones";

export function FormularioAjustes({ ajustes, ia, modelo }: { ajustes: Ajustes; ia: boolean; modelo: string }) {
  const [estado, accion, guardando] = useActionState(guardarAjustesGenerales, null);
  return (
    <form action={accion} className="pila">
      <section className="tarjeta pila" style={{ gap: 12 }}>
        <h2>Baja</h2>
        <div className="dos">
          <label className="campo">
            Palabra de baja
            <input type="text" name="palabraBaja" defaultValue={ajustes.palabraBaja} maxLength={30} required />
            <small>Si alguien la manda por privado, no recibe nada más.</small>
          </label>
          <label className="campo">
            Palabra para volver
            <input type="text" name="palabraAlta" defaultValue={ajustes.palabraAlta} maxLength={30} required />
          </label>
        </div>
        <label className="campo">
          Mensaje de confirmación de la baja
          <input type="text" name="mensajeBaja" defaultValue={ajustes.mensajeBaja} maxLength={500} />
        </label>
      </section>

      <section className="tarjeta pila" style={{ gap: 12 }}>
        <h2>Ritmo</h2>
        <div className="dos">
          <label className="campo">
            Tope de envíos del bot por hora
            <input type="number" name="topePorHora" defaultValue={ajustes.topePorHora} min={1} max={500} required />
            <small>Al llegar al tope, lo que falta espera y sale cuando se libera.</small>
          </label>
          <label className="campo">
            Consultar Instagram cada (minutos)
            <input type="number" name="consultaCadaMinutos" defaultValue={ajustes.consultaCadaMinutos} min={1} max={60} required />
            <small>Más seguido responde más rápido pero gasta más llamadas de Composio.</small>
          </label>
        </div>
        <label className="campo" style={{ maxWidth: 320 }}>
          Publicaciones recientes a revisar
          <input type="number" name="postsARevisar" defaultValue={ajustes.postsARevisar} min={1} max={25} required />
          <small>Se miran los comentarios de tus últimas publicaciones.</small>
        </label>
      </section>

      <section className="tarjeta pila" style={{ gap: 12 }}>
        <h2>Instrucciones del negocio para la IA</h2>
        <p className="chico tenue">{ia ? `IA prendida. Modelo: ${modelo}.` : "IA apagada: falta la clave del AI Gateway (AI_GATEWAY_API_KEY). Todo lo demás funciona igual."}</p>
        <label className="campo">
          Qué tiene que saber la IA de tu negocio
          <textarea name="instruccionesNegocio" defaultValue={ajustes.instruccionesNegocio} maxLength={4000} style={{ minHeight: 140 }} placeholder="Qué vendés, precios, horarios, tono, qué no tiene que prometer." />
        </label>
      </section>

      <div className="fila">
        <button className="boton" disabled={guardando}>{guardando ? "Guardando…" : "Guardar ajustes"}</button>
        {estado?.mensaje && <span role="status" className="chico" style={{ color: "var(--verde-oscuro)", fontWeight: 600 }}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
