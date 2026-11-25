import Link from "next/link";
import { estadisticas } from "@/lib/consultas";

export const metadata = { title: "Estadísticas" };

export default async function Estadisticas() {
  const filas = await estadisticas();
  const total = filas.reduce((t, f) => ({ disparos: t.disparos + f.disparos, enviados: t.enviados + f.enviados, capturados: t.capturados + f.capturados, errores: t.errores + f.errores }), { disparos: 0, enviados: 0, capturados: 0, errores: 0 });
  const maximo = Math.max(1, ...filas.map((f) => f.disparos));
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Estadísticas</h1>
          <p>Qué hizo cada automatización desde que la creaste.</p>
        </div>
      </div>
      <div className="numeros" style={{ marginBottom: 14 }}>
        <div className="numero"><b>{total.disparos}</b><span>disparos</span></div>
        <div className="numero"><b>{total.enviados}</b><span>mensajes enviados</span></div>
        <div className="numero"><b>{total.capturados}</b><span>datos capturados</span></div>
        <div className="numero"><b style={total.errores ? { color: "var(--rojo)" } : undefined}>{total.errores}</b><span>errores</span></div>
      </div>
      {filas.length === 0 ? <div className="vacio">Todavía no hay automatizaciones.</div> : (
        <div className="tabla">
          <table>
            <thead><tr><th>Automatización</th><th className="num">Disparos</th><th className="num">Enviados</th><th className="num">Datos</th><th className="num">Errores</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link href={`/automatizaciones/${f.id}`} style={{ fontWeight: 650, textDecoration: "none" }}>{f.nombre}</Link>
                    {!f.activa && <span className="etiqueta" style={{ marginLeft: 8 }}>Pausada</span>}
                    <div className="barra" style={{ maxWidth: 260 }}><i style={{ width: `${Math.round((f.disparos / maximo) * 100)}%` }} /></div>
                  </td>
                  <td className="num">{f.disparos}</td>
                  <td className="num">{f.enviados}</td>
                  <td className="num">{f.capturados}</td>
                  <td className="num" style={f.errores ? { color: "var(--rojo)", fontWeight: 650 } : undefined}>{f.errores}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ayuda" style={{ marginTop: 10 }}>Disparos: veces que arrancó. Enviados: respuestas públicas y privados que salieron. Datos: mails o teléfonos válidos guardados. El detalle de cada error está en el <Link href="/registro">registro</Link>.</p>
    </>
  );
}
