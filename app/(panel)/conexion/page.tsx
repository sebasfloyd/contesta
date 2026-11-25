import { base } from "@/lib/db";
import { leerAjustes, leerConexion } from "@/lib/ajustes";
import { hayClaveComposio, leerUso, LLAMADAS_GRATIS_POR_MES, proxyActivo, revisarConexion } from "@/lib/canales/composio";
import { fechaCorta } from "@/lib/texto";
import { PanelConexion } from "./panel";

export const metadata = { title: "Conectar Instagram" };

export default async function Conexion({ searchParams }: { searchParams: Promise<{ vuelta?: string }> }) {
  const b = await base();
  let errorVuelta: string | null = null;
  if ((await searchParams).vuelta && hayClaveComposio()) {
    // Volvemos de autorizar en Composio: revisamos si la cuenta quedó activa.
    try { await revisarConexion(b); } catch (e) { errorVuelta = e instanceof Error ? e.message : String(e); }
  }
  const [cx, ajustes, uso] = await Promise.all([leerConexion(b), leerAjustes(b), leerUso(b)]);
  const activa = cx?.estado === "activa";
  const porMes = Math.round((60 / ajustes.consultaCadaMinutos) * 24 * 30 * 2);
  return (
    <>
      <div className="cabecera">
        <div>
          <h1>Conectar Instagram</h1>
          <p>La conexión se hace con tu cuenta de Composio. Necesitás una cuenta de Instagram profesional (de empresa o de creador).</p>
        </div>
      </div>

      <div className="pila">
        <section className="tarjeta">
          <div className={`estado ${activa ? "si" : ""}`} style={{ fontSize: 17, fontWeight: 650 }}>
            <i />
            {activa ? `Conectado como @${cx?.usuario}` : cx ? "Falta terminar la autorización" : "Sin conectar"}
          </div>
          {activa && <p className="chico tenue" style={{ marginTop: 6 }}>Desde el {fechaCorta(cx?.conectadoEn)}. Solo se atiende lo que pasó después de conectar. Última consulta: {cx?.ultimaConsulta ? fechaCorta(cx.ultimaConsulta) : "todavía ninguna"}.</p>}
          {(errorVuelta || cx?.ultimoError) && <p className="aviso rojo" style={{ marginTop: 10 }}>{errorVuelta || cx?.ultimoError}</p>}
          {!hayClaveComposio() && (
            <p className="aviso" style={{ marginTop: 10 }}>
              Falta la clave de Composio. Creá una cuenta gratis en composio.dev, copiá tu clave y cargala como <span className="mono">COMPOSIO_API_KEY</span> en las variables de entorno. Después reiniciá (o volvé a desplegar).
            </p>
          )}
          <div style={{ marginTop: 14 }}><PanelConexion hayClave={hayClaveComposio()} hayConexion={!!cx} activa={activa} /></div>
        </section>

        <section className="tarjeta">
          <h2 style={{ marginBottom: 8 }}>Uso de Composio este mes</h2>
          <p><b>{uso.llamadas.toLocaleString("es-AR")}</b> de {LLAMADAS_GRATIS_POR_MES.toLocaleString("es-AR")} llamadas del plan gratis.</p>
          <div className="barra" style={{ maxWidth: 360 }}><i style={{ width: `${Math.min(100, (uso.llamadas / LLAMADAS_GRATIS_POR_MES) * 100)}%` }} /></div>
          <p className="chico tenue" style={{ marginTop: 8 }}>
            Consultando cada {ajustes.consultaCadaMinutos} minutos se gastan unas {porMes.toLocaleString("es-AR")} llamadas por mes solo en revisar si hay algo nuevo, más una por cada respuesta enviada. La frecuencia se cambia en Ajustes.
          </p>
        </section>

        <section className="tarjeta">
          <h2 style={{ marginBottom: 8 }}>Qué puede hacer esta conexión</h2>
          <div className="pila chico" style={{ gap: 6 }}>
            <div>Leer comentarios y mensajes nuevos: por consulta periódica (Composio no avisa al instante de lo que pasa en Instagram).</div>
            <div>Responder comentarios en público y mandar texto por privado a quien ya te escribió: sí.</div>
            <div>Respuesta privada a quien solo comentó, botones y respuestas rápidas: {proxyActivo() ? "sí, por la llamada directa de Composio a Instagram. Probalo con tu cuenta antes de confiar: depende de los permisos que Instagram le dio a la conexión." : "apagado (COMPOSIO_PROXY=0)."}</div>
            <div>Respuestas y menciones en historias: se detectan si Instagram las incluye en los mensajes que devuelve. Probalo con tu cuenta.</div>
          </div>
        </section>
      </div>
    </>
  );
}
