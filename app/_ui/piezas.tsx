"use client";

import { useState, useTransition } from "react";
import type { Respuesta } from "../acciones";

/** Interruptor que llama a una acción del servidor al cambiar. */
export function Interruptor({ activo, alCambiar, nombre }: { activo: boolean; alCambiar: (valor: boolean) => Promise<void>; nombre: string }) {
  const [valor, setValor] = useState(activo);
  const [pendiente, iniciar] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={valor}
      aria-label={nombre}
      title={valor ? "Activa: tocá para pausar" : "Pausada: tocá para activar"}
      className="interruptor"
      disabled={pendiente}
      onClick={() => {
        const nuevo = !valor;
        setValor(nuevo);
        iniciar(() => alCambiar(nuevo));
      }}
    />
  );
}

/** Botón que corre una acción y muestra lo que devolvió. */
export function BotonAccion({ accion, children, clase = "boton claro", confirmar }: { accion: () => Promise<Respuesta | void>; children: React.ReactNode; clase?: string; confirmar?: string }) {
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<Respuesta | null>(null);
  return (
    <>
      <button
        type="button"
        className={clase}
        disabled={pendiente}
        onClick={() => {
          if (confirmar && !window.confirm(confirmar)) return;
          iniciar(async () => setResultado((await accion()) || null));
        }}
      >
        {pendiente ? "Un momento…" : children}
      </button>
      {resultado?.mensaje && <span className={`chico ${resultado.ok ? "tenue" : ""}`} style={resultado.ok ? undefined : { color: "var(--rojo)" }} role="status">{resultado.mensaje}</span>}
    </>
  );
}
