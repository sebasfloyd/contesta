"use client";

import { useState, useTransition } from "react";
import { actualizarConexion, conectarInstagram, consultarAhora, desconectarInstagram, probarConexion, type Diagnostico } from "../../acciones";
import { BotonAccion } from "../../_ui/piezas";

export function PanelConexion({ hayClave, hayConexion, activa }: { hayClave: boolean; hayConexion: boolean; activa: boolean }) {
  const [pruebas, setPruebas] = useState<Diagnostico | null>(null);
  const [probando, iniciar] = useTransition();
  return (
    <div className="pila" style={{ gap: 12 }}>
      <div className="fila">
        {!activa && <BotonAccion clase="boton verde" accion={conectarInstagram}>{hayConexion ? "Volver a autorizar" : "Conectar Instagram"}</BotonAccion>}
        {hayConexion && hayClave && <BotonAccion accion={actualizarConexion}>Revisar estado</BotonAccion>}
        {activa && <BotonAccion accion={consultarAhora}>Consultar ahora</BotonAccion>}
        {activa && <button type="button" className="boton claro" disabled={probando} onClick={() => iniciar(async () => setPruebas(await probarConexion()))}>{probando ? "Probando…" : "Probar la conexión"}</button>}
        {hayConexion && <BotonAccion clase="boton peligro" confirmar="¿Desconectar la cuenta de Instagram?" accion={desconectarInstagram}>Desconectar</BotonAccion>}
      </div>
      {pruebas && (
        <div className="pila chico" style={{ gap: 6 }}>
          {pruebas.map((p) => (
            <div key={p.prueba} className="fila" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span className={`etiqueta ${p.ok ? "verde" : "roja"}`}>{p.ok ? "Anda" : "Falla"}</span>
              <span><b>{p.prueba}:</b> {p.detalle}</span>
            </div>
          ))}
          <span className="ayuda">Estas pruebas solo leen: no mandan nada a nadie.</span>
        </div>
      )}
    </div>
  );
}
