import { NOMBRES_DISPARADOR, type Disparador } from "@/lib/tipos";

/** Una línea que describe cuándo se dispara una automatización. */
export function ResumenDisparador({ d }: { d: Disparador }) {
  const palabras = (d.palabras || []).filter(Boolean);
  return (
    <span className="fila chico tenue" style={{ gap: 6 }}>
      {NOMBRES_DISPARADOR[d.tipo]}
      {palabras.length > 0 && <>{d.coincidencia === "exacta" ? " que dice exactamente" : " que contiene"}{palabras.map((p) => <span key={p} className="palabra">{p}</span>)}</>}
      {d.tipo === "comentario" && (d.postId ? " · en una publicación" : " · en cualquier publicación")}
    </span>
  );
}
