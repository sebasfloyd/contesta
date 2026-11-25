import { generateText } from "ai";
import type { GeneradorIA } from "./motor/motor";

/** Modelo en formato "proveedor/modelo" del Vercel AI Gateway. Se cambia con MODELO_IA. */
export const modeloIA = () => process.env.MODELO_IA || "anthropic/claude-haiku-5.5";

/** Hay IA si está la clave del gateway (local) o el token de Vercel (desplegado con AI Gateway activo). */
export const iaDisponible = () => !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);

export function generadorIA(): GeneradorIA | null {
  if (!iaDisponible()) return null;
  return async ({ instruccionesNegocio, instruccionesPaso, historial }) => {
    const charla = historial.map((m) => `${m.de === "contacto" ? "Persona" : "Negocio"}: ${m.texto}`).join("\n");
    const { text } = await generateText({
      model: modeloIA(),
      instructions: [
        "Respondés mensajes privados de Instagram en nombre de un negocio.",
        "Escribí un solo mensaje corto (máximo 500 caracteres), en el idioma de la persona, sin inventar precios ni datos que no estén en las instrucciones.",
        "Si no sabés la respuesta, decí que una persona del equipo le va a contestar.",
        instruccionesNegocio ? `Sobre el negocio:\n${instruccionesNegocio}` : "",
        instruccionesPaso ? `Para esta respuesta:\n${instruccionesPaso}` : "",
      ].filter(Boolean).join("\n\n"),
      prompt: `Conversación hasta ahora:\n${charla}\n\nEscribí la próxima respuesta del negocio.`,
      maxOutputTokens: 400,
    });
    return text;
  };
}
