"use client";

import { useActionState } from "react";
import { entrar } from "../acciones";

export function FormularioEntrar({ faltaClave }: { faltaClave: boolean }) {
  const [estado, accion, enviando] = useActionState(entrar, null);
  return (
    <form action={accion}>
      <div className="marca" style={{ padding: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icono.svg" alt="" />
        <span>Contesta</span>
      </div>
      {faltaClave ? (
        <p className="aviso">
          Falta la clave del panel. Definí <span className="mono">CLAVE_PANEL</span> en tu archivo <span className="mono">.env.local</span> (o corré <span className="mono">npm run preparar</span>) y reiniciá.
        </p>
      ) : (
        <>
          <label className="campo">
            Clave del panel
            <input type="password" name="clave" autoComplete="current-password" autoFocus required />
          </label>
          {estado?.mensaje && <p className="aviso rojo" role="alert">{estado.mensaje}</p>}
          <button className="boton" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        </>
      )}
    </form>
  );
}
