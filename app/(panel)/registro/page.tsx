import Link from "next/link";
import { registro } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";

export const metadata = { title: "Registro" };

const NOMBRES: Record<string, string> = {
  dato_capturado: "Dato capturado",
  dato_no_capturado: "Dato sin capturar",
  envio_fallido: "Envío fallido",
  fuera_de_ventana: "Fuera de ventana",
  tope_por_hora: "Tope por hora",
  baja: "Baja",
  alta: "Alta",
  aviso_humano: "Pide una persona",
  ia_apagada: "IA apagada",
  ia_fallida: "IA con error",
  paso_fallido: "Paso con error",
  consulta_fallida: "Consulta fallida",
};

export default async function Registro({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const soloProblemas = (await searchParams).ver === "problemas";
  const filas = await registro({ soloProblemas, limite: 200 });
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Registro</h1>
          <p>Lo que fue pasando: datos capturados, bajas, bloqueos y errores. Los mensajes enviados están en cada conversación.</p>
        </div>
        <div className="fila">
          <Link href="/registro" className={`boton mini ${soloProblemas ? "claro" : ""}`}>Todo</Link>
          <Link href="/registro?ver=problemas" className={`boton mini ${soloProblemas ? "" : "claro"}`}>Avisos y errores</Link>
        </div>
      </div>
      {filas.length === 0 ? <div className="vacio">Nada por acá todavía.</div> : (
        <div className="tabla">
          <table>
            <thead><tr><th>Cuándo</th><th>Qué</th><th>Detalle</th><th className="ocultar-movil">Automatización</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td className="chico tenue" style={{ whiteSpace: "nowrap" }}>{fechaCorta(f.creado)}</td>
                  <td><span className={`etiqueta ${f.nivel === "error" ? "roja" : f.nivel === "aviso" ? "ambar" : "verde"}`}>{NOMBRES[f.tipo] || f.tipo}</span></td>
                  <td>{f.detalle}{f.contacto_id && f.usuario && <> · <Link href={`/bandeja/${f.contacto_id}`} className="chico">@{f.usuario}</Link></>}</td>
                  <td className="chico tenue ocultar-movil">{f.automatizacion_nombre || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
