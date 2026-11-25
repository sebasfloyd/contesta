"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { simular } from "../../acciones";

export function FormularioSimulador({ usuario }: { usuario: string }) {
  const router = useRouter();
  const [estado, accion, enviando] = useActionState(simular, null);
  const [tipo, setTipo] = useState("comentario");
  useEffect(() => {
    if (estado?.ok && estado.id) router.replace(`/simulador?c=${estado.id}`);
  }, [estado, router]);
  return (
    <form action={accion} className="tarjeta pila" style={{ gap: 12 }}>
      <label className="campo">
        Qué pasa
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="comentario">Alguien comenta una publicación</option>
          <option value="mensaje">Alguien manda un mensaje privado</option>
          <option value="respuesta_historia">Alguien responde una historia</option>
          <option value="mencion_historia">Alguien te menciona en su historia</option>
        </select>
      </label>
      <div className="dos">
        <label className="campo">
          Usuario
          <input type="text" name="usuario" defaultValue={usuario} key={usuario} maxLength={30} />
        </label>
        {tipo === "comentario" && (
          <label className="campo">
            Publicación
            <select name="post">
              <option value="post_demo_1">Publicación de prueba 1</option>
              <option value="post_demo_2">Publicación de prueba 2</option>
            </select>
          </label>
        )}
      </div>
      {tipo !== "mencion_historia" && (
        <label className="campo">
          Texto
          <input type="text" name="texto" placeholder={tipo === "comentario" ? "GUÍA" : "Hola, ¿precio?"} maxLength={500} autoComplete="off" />
        </label>
      )}
      <div className="fila">
        <button className="boton verde" disabled={enviando}>{enviando ? "Simulando…" : "Simular"}</button>
        {estado?.mensaje && <span role="status" className="chico" style={{ color: estado.ok ? "var(--tinta-2)" : "var(--rojo)" }}>{estado.mensaje}</span>}
      </div>
    </form>
  );
}
