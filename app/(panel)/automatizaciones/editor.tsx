"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NOMBRES_DISPARADOR, NOMBRES_PASO, type Disparador, type Paso, type TipoDisparador, type TipoPaso } from "@/lib/tipos";
import { borrarAutomatizacion, cambiarEstado, guardarAutomatizacion } from "../../acciones";

type Datos = { nombre: string; disparador: Disparador; pasos: Paso[] };
type Publicacion = { id: string; texto: string };

const PASO_NUEVO: Record<TipoPaso, () => Paso> = {
  responder_comentario: () => ({ tipo: "responder_comentario", variantes: [""] }),
  enviar_privado: () => ({ tipo: "enviar_privado", texto: "" }),
  mensaje_botones: () => ({ tipo: "mensaje_botones", texto: "", opciones: [{ titulo: "" }] }),
  pedir_dato: () => ({ tipo: "pedir_dato", campo: "mail", pregunta: "¿A qué mail te lo mando?", mensajeError: "Ese mail no me cierra. ¿Me lo escribís de nuevo?", reintentos: 1 }),
  etiqueta: () => ({ tipo: "etiqueta", accion: "poner", etiqueta: "" }),
  esperar: () => ({ tipo: "esperar", minutos: 10 }),
  responder_ia: () => ({ tipo: "responder_ia", instrucciones: "" }),
  avisar_humano: () => ({ tipo: "avisar_humano", nota: "pidió hablar con una persona.", pausarBot: true }),
};

const CON_PALABRAS: TipoDisparador[] = ["comentario", "mensaje", "respuesta_historia"];

export function Editor({ id, activa, inicial, iaDisponible }: { id: string | null; activa: boolean; inicial: Datos; iaDisponible: boolean }) {
  const router = useRouter();
  const [datos, setDatos] = useState<Datos>(inicial);
  const [palabras, setPalabras] = useState(inicial.disparador.palabras.join(", "));
  const [estaActiva, setEstaActiva] = useState(activa);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, iniciar] = useTransition();
  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);

  useEffect(() => {
    fetch("/api/publicaciones").then((r) => (r.ok ? r.json() : [])).then((p) => setPublicaciones(Array.isArray(p) ? p : [])).catch(() => {});
  }, []);

  const d = datos.disparador;
  const cambiarDisparador = (cambio: Partial<Disparador>) => setDatos((x) => ({ ...x, disparador: { ...x.disparador, ...cambio } }));
  const cambiarPaso = (i: number, cambio: Partial<Paso>) => setDatos((x) => ({ ...x, pasos: x.pasos.map((p, j) => (j === i ? ({ ...p, ...cambio } as Paso) : p)) }));
  const mover = (i: number, hacia: number) =>
    setDatos((x) => {
      const pasos = [...x.pasos];
      const [p] = pasos.splice(i, 1);
      pasos.splice(i + hacia, 0, p);
      return { ...x, pasos };
    });
  const quitar = (i: number) => setDatos((x) => ({ ...x, pasos: x.pasos.filter((_, j) => j !== i) }));
  const agregar = (tipo: TipoPaso) => setDatos((x) => ({ ...x, pasos: [...x.pasos, PASO_NUEVO[tipo]()] }));

  function guardar(activar?: boolean) {
    setAviso(null);
    const listo: Datos = { ...datos, disparador: { ...d, palabras: CON_PALABRAS.includes(d.tipo) ? palabras.split(",").map((p) => p.trim()).filter(Boolean) : [], postId: d.tipo === "comentario" ? d.postId : null } };
    iniciar(async () => {
      const r = await guardarAutomatizacion(id, listo);
      if (!r.ok || !r.id) {
        setAviso({ ok: false, texto: r.mensaje || "No se pudo guardar." });
        return;
      }
      if (activar !== undefined) {
        await cambiarEstado(r.id, activar);
        setEstaActiva(activar);
      }
      setAviso({ ok: true, texto: activar === true ? "Guardada y activa." : activar === false ? "Guardada y pausada." : "Guardada." });
      if (!id) router.replace(`/automatizaciones/${r.id}`);
      else router.refresh();
    });
  }

  const avisosDeOrden = revisar(datos);

  return (
    <div>
      <div className="cabecera">
        <div style={{ flex: 1, minWidth: 240 }}>
          <label className="campo">
            Nombre
            <input type="text" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} placeholder="Ej: Comentá GUÍA y te la mando" style={{ fontSize: 18, fontWeight: 650, minHeight: 44 }} />
          </label>
        </div>
        <span className={`etiqueta ${estaActiva ? "verde" : ""}`}>{estaActiva ? "Activa" : "Pausada"}</span>
      </div>

      <div className="receta">
        <section className="paso disparo">
          <div className="paso-cabeza"><h2>Cuándo se dispara</h2></div>
          <div className="dos">
            <label className="campo">
              Disparador
              <select value={d.tipo} onChange={(e) => cambiarDisparador({ tipo: e.target.value as TipoDisparador })}>
                {(Object.keys(NOMBRES_DISPARADOR) as TipoDisparador[]).map((t) => <option key={t} value={t}>{NOMBRES_DISPARADOR[t]}</option>)}
              </select>
            </label>
            {d.tipo === "comentario" && (
              <label className="campo">
                Publicación
                {publicaciones.length > 0 ? (
                  <select value={d.postId || ""} onChange={(e) => cambiarDisparador({ postId: e.target.value || null })}>
                    <option value="">Todas las publicaciones</option>
                    {d.postId && !publicaciones.some((p) => p.id === d.postId) && <option value={d.postId}>{d.postId}</option>}
                    {publicaciones.map((p) => <option key={p.id} value={p.id}>{p.texto}</option>)}
                  </select>
                ) : (
                  <input type="text" value={d.postId || ""} onChange={(e) => cambiarDisparador({ postId: e.target.value || null })} placeholder="Vacío = todas" />
                )}
              </label>
            )}
          </div>
          {CON_PALABRAS.includes(d.tipo) && (
            <div className="dos">
              <label className="campo">
                Palabras clave
                <input type="text" value={palabras} onChange={(e) => setPalabras(e.target.value)} placeholder="guía, info" />
                <small>Separadas por coma. No importan mayúsculas ni acentos. Vacío = cualquier texto.</small>
              </label>
              <label className="campo">
                Coincidencia
                <select value={d.coincidencia} onChange={(e) => cambiarDisparador({ coincidencia: e.target.value as Disparador["coincidencia"] })}>
                  <option value="contiene">El texto contiene la palabra</option>
                  <option value="exacta">El texto es exactamente la palabra</option>
                </select>
              </label>
            </div>
          )}
          {d.tipo === "primer_mensaje" && <p className="ayuda">Se dispara una sola vez por persona: la primera vez que te escribe por privado. Si su mensaje coincide con otra automatización por palabra clave, gana esa.</p>}
          {(d.tipo === "respuesta_historia" || d.tipo === "mencion_historia") && <p className="ayuda">Las historias dependen de lo que Instagram le informa a Composio. Probalo con tu cuenta antes de confiar en este disparador.</p>}
        </section>

        {datos.pasos.map((p, i) => (
          <div key={i}>
            <div className="hilo" />
            <section className="paso">
              <div className="paso-cabeza">
                <h2><span className="paso-num">{i + 1}</span>{NOMBRES_PASO[p.tipo]}</h2>
                <div className="paso-acciones">
                  <button type="button" className="icono-boton" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir paso" title="Subir">↑</button>
                  <button type="button" className="icono-boton" onClick={() => mover(i, 1)} disabled={i === datos.pasos.length - 1} aria-label="Bajar paso" title="Bajar">↓</button>
                  <button type="button" className="icono-boton" onClick={() => quitar(i)} aria-label="Quitar paso" title="Quitar">✕</button>
                </div>
              </div>
              <CamposPaso paso={p} cambiar={(c) => cambiarPaso(i, c)} iaDisponible={iaDisponible} esComentario={d.tipo === "comentario"} />
            </section>
          </div>
        ))}

        <div className="hilo" />
        <div className="tarjeta" style={{ borderStyle: "dashed" }}>
          <div className="chico tenue" style={{ marginBottom: 8, fontWeight: 600 }}>Agregar paso</div>
          <div className="agregar">
            {(Object.keys(NOMBRES_PASO) as TipoPaso[]).map((t) => <button key={t} type="button" className="boton claro mini" onClick={() => agregar(t)}>{NOMBRES_PASO[t]}</button>)}
          </div>
        </div>
      </div>

      {avisosDeOrden.length > 0 && (
        <div className="aviso" style={{ marginTop: 14 }}>
          {avisosDeOrden.map((a) => <div key={a}>{a}</div>)}
        </div>
      )}

      <div className="barra-guardar">
        <button type="button" className="boton" onClick={() => guardar()} disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</button>
        <button type="button" className={`boton ${estaActiva ? "claro" : "verde"}`} onClick={() => guardar(!estaActiva)} disabled={guardando}>{estaActiva ? "Guardar y pausar" : "Guardar y activar"}</button>
        {id && (
          <button type="button" className="boton peligro" disabled={guardando} onClick={() => window.confirm("¿Borrar esta automatización? También se borran sus estadísticas.") && iniciar(() => borrarAutomatizacion(id))}>Borrar</button>
        )}
        {aviso && <span role="status" className="chico" style={{ color: aviso.ok ? "var(--verde-oscuro)" : "var(--rojo)", fontWeight: 600 }}>{aviso.texto}</span>}
      </div>
    </div>
  );
}

/** Avisos sobre el orden de los pasos, con las reglas de Instagram en la mano. */
function revisar(datos: Datos): string[] {
  const avisos: string[] = [];
  const esComentario = datos.disparador.tipo === "comentario";
  if (!esComentario && datos.pasos.some((p) => p.tipo === "responder_comentario")) avisos.push("«Responder el comentario en público» solo funciona cuando el disparador es un comentario: en esta automatización se va a saltear.");
  if (esComentario) {
    const privados = datos.pasos.filter((p) => ["enviar_privado", "mensaje_botones", "pedir_dato", "responder_ia"].includes(p.tipo));
    if (privados.length > 1 && privados[0].tipo !== "pedir_dato" && privados[0].tipo !== "mensaje_botones") {
      avisos.push("Instagram permite un solo privado por comentario. El segundo mensaje va a esperar a que la persona te conteste: conviene que el primero termine con una pregunta.");
    }
  }
  const espera = datos.pasos.find((p) => p.tipo === "esperar");
  if (espera && espera.tipo === "esperar" && espera.minutos > 60 * 20) avisos.push("Con esperas tan largas el mensaje siguiente puede caer fuera de la ventana de 24 hs y no salir.");
  return avisos;
}

function CamposPaso({ paso, cambiar, iaDisponible, esComentario }: { paso: Paso; cambiar: (c: Partial<Paso>) => void; iaDisponible: boolean; esComentario: boolean }) {
  const variables = <small>Podés usar {"{{nombre}}"}, {"{{usuario}}"}, {"{{mail}}"} y {"{{telefono}}"}.</small>;
  switch (paso.tipo) {
    case "responder_comentario":
      return (
        <div className="pila" style={{ gap: 8 }}>
          {paso.variantes.map((v, i) => (
            <div key={i} className="fila" style={{ flexWrap: "nowrap" }}>
              <input type="text" value={v} maxLength={300} placeholder={`Variante ${i + 1}`} aria-label={`Variante ${i + 1}`} onChange={(e) => cambiar({ variantes: paso.variantes.map((x, j) => (j === i ? e.target.value : x)) })} />
              {paso.variantes.length > 1 && <button type="button" className="icono-boton" aria-label="Quitar variante" onClick={() => cambiar({ variantes: paso.variantes.filter((_, j) => j !== i) })}>✕</button>}
            </div>
          ))}
          <div className="fila">
            {paso.variantes.length < 8 && <button type="button" className="boton claro mini" onClick={() => cambiar({ variantes: [...paso.variantes, ""] })}>Sumar variante</button>}
            <span className="ayuda">Las variantes se van turnando para no repetir siempre la misma respuesta.</span>
          </div>
        </div>
      );
    case "enviar_privado":
      return (
        <label className="campo">
          Mensaje
          <textarea value={paso.texto} maxLength={1000} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="¡Hola {{nombre}}! Acá tenés lo que pediste: https://…" />
          {variables}
        </label>
      );
    case "mensaje_botones":
      return (
        <div className="pila" style={{ gap: 10 }}>
          <label className="campo">
            Mensaje
            <textarea value={paso.texto} maxLength={640} onChange={(e) => cambiar({ texto: e.target.value })} placeholder="¿Qué necesitás?" />
          </label>
          {paso.opciones.map((o, i) => (
            <div key={i} className="fila" style={{ flexWrap: "nowrap" }}>
              <input type="text" value={o.titulo} maxLength={20} placeholder="Texto del botón" aria-label={`Botón ${i + 1}`} style={{ flex: 1 }} onChange={(e) => cambiar({ opciones: paso.opciones.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })} />
              <input type="url" value={o.url || ""} placeholder="Link (opcional)" aria-label={`Link del botón ${i + 1}`} style={{ flex: 1.4 }} onChange={(e) => cambiar({ opciones: paso.opciones.map((x, j) => (j === i ? { ...x, url: e.target.value || undefined } : x)) })} />
              <button type="button" className="icono-boton" aria-label="Quitar botón" onClick={() => cambiar({ opciones: paso.opciones.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <div className="fila">
            <button type="button" className="boton claro mini" onClick={() => cambiar({ opciones: [...paso.opciones, { titulo: "" }] })}>Sumar botón</button>
            <span className="ayuda">Sin link es una respuesta rápida: al tocarla, la persona te manda ese texto y podés engancharlo con otra automatización. Con link abre la página (hasta 3).</span>
          </div>
        </div>
      );
    case "pedir_dato":
      return (
        <div className="pila" style={{ gap: 10 }}>
          <div className="dos">
            <label className="campo">
              Dato
              <select value={paso.campo} onChange={(e) => cambiar({ campo: e.target.value as "mail" | "telefono" })}>
                <option value="mail">Mail</option>
                <option value="telefono">Teléfono</option>
              </select>
            </label>
            <label className="campo">
              Veces que vuelve a pedirlo si está mal
              <input type="number" min={0} max={5} value={paso.reintentos} onChange={(e) => cambiar({ reintentos: Number(e.target.value) })} />
            </label>
          </div>
          <label className="campo">
            Pregunta
            <textarea value={paso.pregunta} maxLength={1000} onChange={(e) => cambiar({ pregunta: e.target.value })} />
          </label>
          <label className="campo">
            Si lo que responde no sirve
            <input type="text" value={paso.mensajeError} maxLength={500} onChange={(e) => cambiar({ mensajeError: e.target.value })} />
          </label>
          <p className="ayuda">La automatización queda esperando la respuesta. Cuando llega un dato válido lo guarda en el contacto y sigue con el paso siguiente.{esComentario ? " En comentarios, esta pregunta puede ser el privado que le llega a la persona." : ""}</p>
        </div>
      );
    case "etiqueta":
      return (
        <div className="dos">
          <label className="campo">
            Acción
            <select value={paso.accion} onChange={(e) => cambiar({ accion: e.target.value as "poner" | "sacar" })}>
              <option value="poner">Poner etiqueta</option>
              <option value="sacar">Sacar etiqueta</option>
            </select>
          </label>
          <label className="campo">
            Etiqueta
            <input type="text" value={paso.etiqueta} maxLength={40} onChange={(e) => cambiar({ etiqueta: e.target.value })} placeholder="guía" />
          </label>
        </div>
      );
    case "esperar":
      return (
        <label className="campo" style={{ maxWidth: 240 }}>
          Minutos
          <input type="number" min={1} max={1380} value={paso.minutos} onChange={(e) => cambiar({ minutos: Number(e.target.value) })} />
          <small>Hasta 23 horas (1380 minutos).</small>
        </label>
      );
    case "responder_ia":
      return (
        <div className="pila" style={{ gap: 10 }}>
          {!iaDisponible && <p className="aviso">La IA está apagada porque falta la clave del AI Gateway. Este paso se va a saltear hasta que la cargues.</p>}
          <label className="campo">
            Instrucciones para esta respuesta
            <textarea value={paso.instrucciones} maxLength={2000} onChange={(e) => cambiar({ instrucciones: e.target.value })} placeholder="Respondé la consulta en dos líneas y ofrecé agendar una llamada." />
            <small>Se suman a las instrucciones del negocio que cargaste en Ajustes.</small>
          </label>
        </div>
      );
    case "avisar_humano":
      return (
        <div className="pila" style={{ gap: 10 }}>
          <label className="campo">
            Nota para el equipo
            <input type="text" value={paso.nota} maxLength={300} onChange={(e) => cambiar({ nota: e.target.value })} />
          </label>
          <label className="fila chico">
            <input type="checkbox" checked={paso.pausarBot} onChange={(e) => cambiar({ pausarBot: e.target.checked })} />
            Pausar el bot para esta persona hasta que alguien lo reactive
          </label>
          <p className="ayuda">El aviso aparece en Inicio y en la Bandeja.</p>
        </div>
      );
  }
}
