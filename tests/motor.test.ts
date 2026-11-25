import { describe, expect, it } from "vitest";
import { armar } from "./ayuda";
import type { Paso } from "@/lib/tipos";

const GUIA: Paso[] = [
  { tipo: "responder_comentario", variantes: ["¡Te la mandé por privado!", "Listo, mirá tus mensajes.", "Ya la tenés en el privado."] },
  { tipo: "pedir_dato", campo: "mail", pregunta: "¡Hola! Pasame tu mail y te mando la guía.", mensajeError: "Ese mail no me cierra. ¿Me lo pasás de nuevo?", reintentos: 1 },
  { tipo: "etiqueta", accion: "poner", etiqueta: "guia" },
  { tipo: "enviar_privado", texto: "Gracias. Te la mandé a {{mail}}." },
];

describe("disparadores", () => {
  it("comentario con palabra clave, sin distinguir mayúsculas ni acentos", async () => {
    const t = await armar();
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, [{ tipo: "responder_comentario", variantes: ["Va"] }]);
    expect((await t.comentar("lector_uno", "Quiero la GUÍA!")).resultado).toBe("automatizacion");
    expect((await t.comentar("lector_dos", "qué lindo post")).resultado).toBe("sin_coincidencia");
    expect(t.publicas()).toHaveLength(1);
  });

  it("comentario en una publicación puntual no se dispara en otra", async () => {
    const t = await armar();
    await t.automatizacion("Solo post 2", { tipo: "comentario", palabras: ["info"], postId: "post_demo_2" }, [{ tipo: "responder_comentario", variantes: ["Va"] }]);
    expect((await t.comentar("lector_uno", "info", "post_demo_1")).resultado).toBe("sin_coincidencia");
    expect((await t.comentar("lector_uno", "info", "post_demo_2")).resultado).toBe("automatizacion");
  });

  it("mensaje privado con coincidencia exacta", async () => {
    const t = await armar();
    await t.automatizacion("Precio", { tipo: "mensaje", palabras: ["precio"], coincidencia: "exacta" }, [{ tipo: "enviar_privado", texto: "Sale 100." }]);
    expect((await t.escribir("lector_uno", "cuál es el precio?")).resultado).toBe("sin_coincidencia");
    expect((await t.escribir("lector_uno", "PRECIO")).resultado).toBe("automatizacion");
    expect(t.privados()).toHaveLength(1);
  });

  it("primer mensaje de alguien nuevo corre una sola vez, y una palabra clave le gana", async () => {
    const t = await armar();
    await t.automatizacion("Bienvenida", { tipo: "primer_mensaje" }, [{ tipo: "enviar_privado", texto: "¡Bienvenido!" }]);
    const precio = await t.automatizacion("Precio", { tipo: "mensaje", palabras: ["precio"] }, [{ tipo: "enviar_privado", texto: "Sale 100." }]);
    expect((await t.escribir("lector_uno", "hola")).resultado).toBe("automatizacion");
    expect((await t.escribir("lector_uno", "hola de nuevo")).resultado).toBe("sin_coincidencia");
    const r = await t.escribir("lector_dos", "precio");
    expect(r.automatizacionId).toBe(precio);
  });

  it("respuesta y mención en historia", async () => {
    const t = await armar();
    const resp = await t.automatizacion("Historia", { tipo: "respuesta_historia" }, [{ tipo: "enviar_privado", texto: "Gracias por responder." }]);
    const menc = await t.automatizacion("Mención", { tipo: "mencion_historia" }, [{ tipo: "enviar_privado", texto: "Gracias por la mención." }]);
    expect((await t.motor.recibir(t.evento("respuesta_historia", "lector_uno", "me encantó"))).automatizacionId).toBe(resp);
    expect((await t.motor.recibir(t.evento("mencion_historia", "lector_dos", ""))).automatizacionId).toBe(menc);
    expect(t.privados()).toHaveLength(2);
  });

  it("una automatización pausada no corre", async () => {
    const t = await armar();
    await t.automatizacion("Pausada", { tipo: "comentario", palabras: ["guia"] }, [{ tipo: "responder_comentario", variantes: ["Va"] }], false);
    expect((await t.comentar("lector_uno", "guia")).resultado).toBe("sin_coincidencia");
  });
});

describe("idempotencia", () => {
  it("el mismo evento dos veces se procesa una sola", async () => {
    const t = await armar();
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, GUIA);
    const ev = t.evento("comentario", "lector_uno", "guia", { postId: "post_demo_1" });
    expect((await t.motor.recibir(ev)).resultado).toBe("automatizacion");
    expect((await t.motor.recibir(ev)).resultado).toBe("duplicado");
    expect((await t.motor.recibir({ ...ev })).resultado).toBe("duplicado");
    expect(t.publicas()).toHaveLength(1);
    expect(t.privados()).toHaveLength(1);
    expect((await t.base.q("select 1 from ejecuciones")).length).toBe(1);
  });
});

describe("un solo privado por comentario", () => {
  it("el segundo privado espera a que la persona conteste", async () => {
    const t = await armar();
    await t.automatizacion("Dos mensajes", { tipo: "comentario", palabras: ["guia"] }, [
      { tipo: "enviar_privado", texto: "Primero." },
      { tipo: "enviar_privado", texto: "Segundo." },
    ]);
    await t.comentar("lector_uno", "guia");
    expect(t.privados()).toHaveLength(1);
    const primero = t.privados()[0];
    expect(primero.clase === "privado" && "comentarioId" in primero.destino).toBe(true);
    expect((await t.base.q<{ estado: string }>("select estado from ejecuciones"))[0].estado).toBe("esperando_respuesta");

    expect((await t.escribir("lector_uno", "dale")).resultado).toBe("reanudada");
    expect(t.privados()).toHaveLength(2);
    const segundo = t.privados()[1];
    expect(segundo.clase === "privado" && "usuarioId" in segundo.destino).toBe(true);
    expect((await t.base.q<{ estado: string }>("select estado from ejecuciones"))[0].estado).toBe("terminada");
  });
});

describe("ventana de 24 hs", () => {
  it("dentro de la ventana manda; pasadas las 24 hs bloquea y lo anota", async () => {
    const t = await armar();
    await t.automatizacion("Con espera", { tipo: "mensaje", palabras: ["info"] }, [
      { tipo: "enviar_privado", texto: "Acá va la info." },
      { tipo: "esperar", minutos: 23 * 60 },
      { tipo: "enviar_privado", texto: "¿Te sirvió?" },
      { tipo: "esperar", minutos: 2 * 60 },
      { tipo: "enviar_privado", texto: "Este ya no debería salir." },
    ]);
    await t.escribir("lector_uno", "info");
    expect(t.privados()).toHaveLength(1);

    t.adelantar(23 * 60 + 1);
    await t.motor.tic();
    expect(t.privados()).toHaveLength(2);

    t.adelantar(2 * 60 + 1); // 25 hs desde su último mensaje
    await t.motor.tic();
    expect(t.privados()).toHaveLength(2);
    expect((await t.base.q<{ estado: string }>("select estado from ejecuciones"))[0].estado).toBe("bloqueada");
    expect(await t.registro("fuera_de_ventana")).toHaveLength(1);
  });

  it("la respuesta manual también respeta la ventana", async () => {
    const t = await armar();
    await t.escribir("lector_uno", "hola");
    const c = await t.contacto("lector_uno");
    expect((await t.motor.enviarManual(c.id, "Hola, ¿en qué te ayudo?")).ok).toBe(true);
    t.adelantar(24 * 60 + 5);
    const tarde = await t.motor.enviarManual(c.id, "¿Seguís ahí?");
    expect(tarde.ok).toBe(false);
    expect(t.privados()).toHaveLength(1);
  });

  it("un comentario de más de 7 días ya no recibe privado", async () => {
    const t = await armar();
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, [{ tipo: "enviar_privado", texto: "Hola." }]);
    const viejo = new Date(t.ahora().getTime() - 8 * 24 * 60 * 60000);
    await t.motor.recibir(t.evento("comentario", "lector_uno", "guia", { ocurrido: viejo }));
    expect(t.privados()).toHaveLength(0);
    expect(await t.registro("fuera_de_ventana")).toHaveLength(1);
  });
});

describe("tope por hora", () => {
  it("al llegar al tope el envío queda en espera y sale cuando se libera", async () => {
    const t = await armar();
    await t.base.q("insert into ajustes (clave, valor) values ('general', $1::jsonb)", [JSON.stringify({ topePorHora: 2 })]);
    await t.automatizacion("Info", { tipo: "mensaje", palabras: ["info"] }, [{ tipo: "enviar_privado", texto: "Acá va." }]);
    await t.escribir("lector_uno", "info");
    await t.escribir("lector_dos", "info");
    await t.escribir("lector_tres", "info");
    expect(t.privados()).toHaveLength(2);
    expect(await t.registro("tope_por_hora")).toHaveLength(1);
    const enEspera = await t.base.q<{ estado: string }>("select estado from ejecuciones where estado = 'esperando_tiempo'");
    expect(enEspera).toHaveLength(1);

    t.adelantar(11); // todavía dentro de la misma hora: sigue en espera
    await t.motor.tic();
    expect(t.privados()).toHaveLength(2);

    t.adelantar(55); // ya pasó la hora de los dos primeros
    await t.motor.tic();
    expect(t.privados()).toHaveLength(3);
  });
});

describe("palabra de baja", () => {
  it("BASTA frena todo para ese contacto, y VOLVER lo reactiva", async () => {
    const t = await armar();
    await t.automatizacion("Info", { tipo: "mensaje", palabras: ["info"] }, [
      { tipo: "enviar_privado", texto: "Acá va." },
      { tipo: "esperar", minutos: 10 },
      { tipo: "enviar_privado", texto: "Seguimiento." },
    ]);
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, [{ tipo: "responder_comentario", variantes: ["Va"] }, { tipo: "enviar_privado", texto: "Hola." }]);
    await t.escribir("lector_uno", "info");
    expect(t.privados()).toHaveLength(1);

    expect((await t.escribir("lector_uno", "basta")).resultado).toBe("baja");
    expect((await t.contacto("lector_uno")).baja).toBe(true);
    expect(t.privados()).toHaveLength(2); // la confirmación de la baja

    t.adelantar(11);
    await t.motor.tic(); // el seguimiento quedó cancelado
    expect(t.privados()).toHaveLength(2);
    expect((await t.escribir("lector_uno", "info")).resultado).toBe("ignorado_baja");
    expect((await t.comentar("lector_uno", "guia")).resultado).toBe("ignorado_baja");
    expect(t.privados()).toHaveLength(2);
    expect(t.publicas()).toHaveLength(0);

    expect((await t.escribir("lector_uno", "Volver")).resultado).toBe("alta");
    expect((await t.escribir("lector_uno", "info")).resultado).toBe("automatizacion");
  });

  it("la baja de uno no afecta a los demás", async () => {
    const t = await armar();
    await t.automatizacion("Info", { tipo: "mensaje", palabras: ["info"] }, [{ tipo: "enviar_privado", texto: "Acá va." }]);
    await t.escribir("lector_uno", "BASTA");
    expect((await t.escribir("lector_dos", "info")).resultado).toBe("automatizacion");
  });
});

describe("captura de mail", () => {
  it("pide el mail, rechaza uno inválido, guarda el válido y sigue con los pasos", async () => {
    const t = await armar();
    const id = await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, GUIA);
    await t.comentar("lector_uno", "GUÍA");
    expect(t.publicas()).toHaveLength(1);
    expect(t.privados()).toHaveLength(1); // la pregunta, como respuesta privada al comentario

    expect((await t.escribir("lector_uno", "no sé cuál es")).resultado).toBe("dato_recibido");
    expect(t.privados()).toHaveLength(2); // el pedido de nuevo
    expect((await t.contacto("lector_uno")).datos.mail).toBeUndefined();

    await t.escribir("lector_uno", "es Lector.Uno@Ejemplo.com");
    const c = await t.contacto("lector_uno");
    expect(c.datos.mail).toBe("lector.uno@ejemplo.com");
    expect(c.etiquetas).toEqual(["guia"]);
    expect(c.origen_automatizacion_id).toBe(id);
    const ultimo = t.privados().at(-1)!;
    expect(ultimo.clase === "privado" && ultimo.contenido.texto).toBe("Gracias. Te la mandé a lector.uno@ejemplo.com.");
    expect(await t.registro("dato_capturado")).toHaveLength(1);
    expect((await t.base.q<{ estado: string }>("select estado from ejecuciones"))[0].estado).toBe("terminada");
  });

  it("después de los reintentos corta sin guardar nada", async () => {
    const t = await armar();
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, GUIA);
    await t.comentar("lector_uno", "guia");
    await t.escribir("lector_uno", "mmm");
    await t.escribir("lector_uno", "no tengo mail");
    const c = await t.contacto("lector_uno");
    expect(c.datos.mail).toBeUndefined();
    expect(c.etiquetas).toEqual([]);
    expect(await t.registro("dato_no_capturado")).toHaveLength(1);
  });

  it("captura teléfono validado", async () => {
    const t = await armar();
    await t.automatizacion("Tel", { tipo: "mensaje", palabras: ["llamame"] }, [{ tipo: "pedir_dato", campo: "telefono", pregunta: "¿A qué número?", mensajeError: "No lo entendí.", reintentos: 1 }]);
    await t.escribir("lector_uno", "llamame");
    await t.escribir("lector_uno", "al 11 5555-0100");
    expect((await t.contacto("lector_uno")).datos.telefono).toBe("1155550100");
  });
});

describe("pasos encadenados", () => {
  it("espera X minutos y sigue recién cuando pasa el tiempo", async () => {
    const t = await armar();
    await t.automatizacion("Seguimiento", { tipo: "mensaje", palabras: ["info"] }, [
      { tipo: "enviar_privado", texto: "Uno." },
      { tipo: "etiqueta", accion: "poner", etiqueta: "interesado" },
      { tipo: "esperar", minutos: 30 },
      { tipo: "mensaje_botones", texto: "¿Seguimos?", opciones: [{ titulo: "Sí" }, { titulo: "Ver web", url: "https://ejemplo.com" }] },
      { tipo: "etiqueta", accion: "sacar", etiqueta: "interesado" },
      { tipo: "avisar_humano", nota: "Quiere seguir.", pausarBot: true },
    ]);
    await t.escribir("lector_uno", "info");
    expect(t.privados()).toHaveLength(1);
    expect((await t.contacto("lector_uno")).etiquetas).toEqual(["interesado"]);

    t.adelantar(29);
    expect((await t.motor.tic()).reanudadas).toBe(0);
    expect(t.privados()).toHaveLength(1);

    t.adelantar(2);
    expect((await t.motor.tic()).reanudadas).toBe(1);
    expect(t.privados()).toHaveLength(2);
    const conBotones = t.privados()[1];
    expect(conBotones.clase === "privado" && conBotones.contenido.opciones).toHaveLength(2);
    const c = await t.contacto("lector_uno");
    expect(c.etiquetas).toEqual([]);
    expect(c.pide_humano).toBe(true);
    expect(c.bot_pausado).toBe(true);
    expect(await t.registro("aviso_humano")).toHaveLength(1);
    // Con el bot pausado, lo que escriba ya no dispara nada.
    expect((await t.escribir("lector_uno", "info")).resultado).toBe("bot_pausado");
  });

  it("las respuestas públicas rotan entre variantes", async () => {
    const t = await armar();
    await t.automatizacion("Guía", { tipo: "comentario", palabras: ["guia"] }, [{ tipo: "responder_comentario", variantes: ["A", "B", "C"] }]);
    for (const u of ["uno", "dos", "tres", "cuatro"]) await t.comentar(`lector_${u}`, "guia");
    expect(t.publicas().map((p) => (p.clase === "respuesta_comentario" ? p.texto : ""))).toEqual(["A", "B", "C", "A"]);
  });

  it("si el canal falla, queda el error anotado y no se rompe nada", async () => {
    const t = await armar();
    await t.automatizacion("Info", { tipo: "mensaje", palabras: ["info"] }, [{ tipo: "enviar_privado", texto: "Acá va." }, { tipo: "etiqueta", accion: "poner", etiqueta: "x" }]);
    t.canal.fallarCon = "Instagram no responde";
    expect((await t.escribir("lector_uno", "info")).resultado).toBe("automatizacion");
    expect(await t.registro("envio_fallido")).toHaveLength(1);
    expect((await t.base.q<{ estado: string }>("select estado from ejecuciones"))[0].estado).toBe("error");
    expect((await t.base.q<{ estado: string }>("select estado from mensajes where direccion = 'saliente'"))[0].estado).toBe("error");
  });
});

describe("respuesta con IA", () => {
  it("sin clave se saltea y lo avisa; con generador manda la respuesta", async () => {
    const sin = await armar();
    await sin.automatizacion("IA", { tipo: "mensaje" }, [{ tipo: "responder_ia", instrucciones: "Respondé corto." }]);
    await sin.escribir("lector_uno", "¿hacen envíos?");
    expect(sin.privados()).toHaveLength(0);
    expect(await sin.registro("ia_apagada")).toHaveLength(1);

    const con = await armar({ ia: async (e) => `Sí. (${e.historial.at(-1)?.texto})` });
    await con.automatizacion("IA", { tipo: "mensaje" }, [{ tipo: "responder_ia", instrucciones: "Respondé corto." }]);
    await con.escribir("lector_uno", "¿hacen envíos?");
    const p = con.privados()[0];
    expect(p.clase === "privado" && p.contenido.texto).toBe("Sí. (¿hacen envíos?)");
  });
});

describe("bot pausado por una persona", () => {
  it("responder a mano pausa el bot para ese contacto", async () => {
    const t = await armar();
    await t.automatizacion("Info", { tipo: "mensaje", palabras: ["info"] }, [{ tipo: "enviar_privado", texto: "Acá va." }]);
    await t.escribir("lector_uno", "hola");
    const c = await t.contacto("lector_uno");
    await t.motor.enviarManual(c.id, "Hola, soy del equipo.");
    expect((await t.contacto("lector_uno")).bot_pausado).toBe(true);
    expect((await t.escribir("lector_uno", "info")).resultado).toBe("bot_pausado");
    expect((await t.escribir("lector_dos", "info")).resultado).toBe("automatizacion");
  });
});
