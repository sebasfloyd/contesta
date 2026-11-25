import type { MensajeConOrigen } from "@/lib/consultas";
import { fechaCorta } from "@/lib/texto";

const QUIEN: Record<string, string> = { bot: "Bot", humano: "Vos", contacto: "" };

/** La conversación con un contacto: lo que escribió, lo que respondió el bot y lo que respondiste vos. */
export function Charla({ mensajes }: { mensajes: MensajeConOrigen[] }) {
  if (!mensajes.length) return <div className="vacio">Todavía no hay mensajes.</div>;
  return (
    <div className="charla">
      {mensajes.map((m) => {
        const sale = m.direccion === "saliente";
        const publico = m.tipo === "comentario" || m.tipo === "respuesta_comentario";
        const clases = ["globo", sale ? "sale" : "", m.origen === "humano" ? "humano" : "", publico ? "publico" : "", m.estado === "error" ? "fallo" : ""].filter(Boolean).join(" ");
        const pie = [
          publico ? (sale ? "Respuesta pública" : "Comentario") : m.tipo === "historia" ? "Historia" : null,
          QUIEN[m.origen] || null,
          m.automatizacion_nombre,
          fechaCorta(m.creado),
          m.estado === "error" ? `No salió: ${m.error}` : null,
        ].filter(Boolean).join(" · ");
        return (
          <div key={m.id} className={clases}>
            {m.texto || <em>(sin texto)</em>}
            {m.opciones && m.opciones.length > 0 && (
              <div className="opciones">{m.opciones.map((o, i) => <span key={i}>{o.titulo}{o.url ? " ↗" : ""}</span>)}</div>
            )}
            <small>{pie}</small>
          </div>
        );
      })}
    </div>
  );
}
