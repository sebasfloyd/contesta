import Link from "next/link";
import { contactos, etiquetasEnUso } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";

export const metadata = { title: "Contactos" };

export default async function Contactos({ searchParams }: { searchParams: Promise<{ buscar?: string; etiqueta?: string }> }) {
  const filtro = await searchParams;
  const [lista, etiquetas] = await Promise.all([contactos(filtro), etiquetasEnUso()]);
  const consulta = new URLSearchParams(Object.entries(filtro).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Contactos</h1>
          <p>Todas las personas que comentaron o escribieron, con sus etiquetas y los datos que dejaron.</p>
        </div>
        <a href={`/api/contactos.csv${consulta ? "?" + consulta : ""}`} className="boton claro">Exportar CSV</a>
      </div>

      <form className="fila" style={{ marginBottom: 14 }}>
        <input type="search" name="buscar" defaultValue={filtro.buscar || ""} placeholder="Buscar por usuario, nombre, mail o teléfono" aria-label="Buscar" style={{ flex: 1, minWidth: 200 }} />
        <select name="etiqueta" defaultValue={filtro.etiqueta || ""} aria-label="Filtrar por etiqueta" style={{ width: "auto", minWidth: 160 }}>
          <option value="">Todas las etiquetas</option>
          {etiquetas.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button className="boton">Filtrar</button>
        {consulta && <Link href="/contactos" className="chico">Limpiar</Link>}
      </form>

      {lista.length === 0 ? (
        <div className="vacio">{consulta ? "Nadie coincide con ese filtro." : "Todavía no hay contactos."}</div>
      ) : (
        <div className="tabla">
          <table>
            <thead>
              <tr><th>Usuario</th><th>Etiquetas</th><th>Datos</th><th className="ocultar-movil">Llegó por</th><th className="ocultar-movil">Último movimiento</th></tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/contactos/${c.id}`} style={{ fontWeight: 650, textDecoration: "none" }}>@{c.usuario || c.id_externo}</Link>
                    <div className="fila" style={{ gap: 4, marginTop: 3 }}>
                      {c.canal === "simulado" && <span className="etiqueta">Prueba</span>}
                      {c.baja && <span className="etiqueta roja">Baja</span>}
                    </div>
                  </td>
                  <td><div className="fila" style={{ gap: 4 }}>{c.etiquetas.map((e) => <span key={e} className="etiqueta verde">{e}</span>)}</div></td>
                  <td className="chico">{Object.entries(c.datos).map(([k, v]) => <div key={k}><span className="tenue">{k}:</span> {v}</div>)}</td>
                  <td className="chico tenue ocultar-movil">{c.origen_nombre || ""}</td>
                  <td className="chico tenue ocultar-movil">{fechaCorta(c.ultimo_movimiento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="ayuda" style={{ marginTop: 10 }}>{lista.length} {lista.length === 1 ? "contacto" : "contactos"}{lista.length === 500 ? " (se muestran los primeros 500; el CSV trae todos)" : ""}.</p>
    </>
  );
}
