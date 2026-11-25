import Link from "next/link";
import { conversaciones } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";

export const metadata = { title: "Bandeja" };

export default async function Bandeja() {
  const lista = await conversaciones();
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Bandeja</h1>
          <p>Todas las conversaciones. Si respondés a mano, el bot se pausa para esa persona.</p>
        </div>
      </div>
      {lista.length === 0 ? (
        <div className="vacio">Todavía no hay conversaciones. Probá mandar un mensaje desde el <Link href="/simulador">simulador</Link>.</div>
      ) : (
        <div className="lista">
          {lista.map((c) => (
            <Link key={c.id} href={`/bandeja/${c.id}`} className="item">
              <div className="item-cuerpo">
                <span className="fila" style={{ gap: 6 }}>
                  <b>@{c.usuario || c.id_externo}</b>
                  {c.pide_humano && <span className="etiqueta ambar">Pide una persona</span>}
                  {c.bot_pausado && <span className="etiqueta">Bot pausado</span>}
                  {c.baja && <span className="etiqueta roja">Baja</span>}
                  {c.canal === "simulado" && <span className="etiqueta">Prueba</span>}
                </span>
                <span className="chico tenue corte">{c.ultimo_direccion === "saliente" ? "Vos: " : ""}{c.ultimo_texto || "(sin texto)"}</span>
              </div>
              <span className="chico tenue">{fechaCorta(c.ultimo_movimiento)}</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
