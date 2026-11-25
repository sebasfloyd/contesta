"use client";

import { useActionState, useEffect, useRef } from "react";
import type { Respuesta } from "../../../acciones";

export function Redactar({ accion }: { accion: (previo: Respuesta | null, datos: FormData) => Promise<Respuesta> }) {
  const [estado, enviar, enviando] = useActionState(accion, null);
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) formulario.current?.reset();
  }, [estado]);
  return (
    <form action={enviar} ref={formulario}>
      <div className="redactar">
        <textarea name="texto" placeholder="Escribí tu respuesta…" aria-label="Tu respuesta" maxLength={1000} required />
        <button className="boton" disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</button>
      </div>
      {estado && !estado.ok && <p className="aviso rojo" role="alert" style={{ marginTop: 8 }}>{estado.mensaje}</p>}
      <p className="ayuda" style={{ marginTop: 6 }}>Al responder a mano el bot se pausa para esta persona.</p>
    </form>
  );
}
