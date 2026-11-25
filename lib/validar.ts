import { z } from "zod";

const texto = (max: number) => z.string().trim().max(max);

export const esquemaDisparador = z.object({
  tipo: z.enum(["comentario", "mensaje", "respuesta_historia", "mencion_historia", "primer_mensaje"]),
  palabras: z.array(texto(60)).max(20).transform((p) => p.filter(Boolean)),
  coincidencia: z.enum(["contiene", "exacta"]),
  postId: texto(100).nullish().transform((v) => v || null),
});

export const esquemaPaso = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("responder_comentario"), variantes: z.array(texto(300)).max(8).transform((v) => v.filter(Boolean)) }),
  z.object({ tipo: z.literal("enviar_privado"), texto: texto(1000) }),
  z.object({
    tipo: z.literal("mensaje_botones"),
    texto: texto(640),
    opciones: z.array(z.object({ titulo: texto(20), url: z.string().trim().max(500).optional().transform((u) => (u && /^https?:\/\//i.test(u) ? u : undefined)) })).max(13).transform((o) => o.filter((x) => x.titulo)),
  }),
  z.object({ tipo: z.literal("pedir_dato"), campo: z.enum(["mail", "telefono"]), pregunta: texto(1000), mensajeError: texto(500), reintentos: z.coerce.number().int().min(0).max(5) }),
  z.object({ tipo: z.literal("etiqueta"), accion: z.enum(["poner", "sacar"]), etiqueta: texto(40) }),
  z.object({ tipo: z.literal("esperar"), minutos: z.coerce.number().int().min(1).max(60 * 23) }),
  z.object({ tipo: z.literal("responder_ia"), instrucciones: texto(2000) }),
  z.object({ tipo: z.literal("avisar_humano"), nota: texto(300), pausarBot: z.boolean() }),
]);

export const esquemaAutomatizacion = z.object({
  nombre: z.string().trim().min(1, "Ponele un nombre.").max(80),
  disparador: esquemaDisparador,
  pasos: z.array(esquemaPaso).min(1, "Agregá al menos un paso.").max(20),
});

export type DatosAutomatizacion = z.infer<typeof esquemaAutomatizacion>;
