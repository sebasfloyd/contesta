import { NextResponse } from "next/server";
import { base } from "@/lib/db";
import { leerConexion } from "@/lib/ajustes";
import { canalPorNombre } from "@/lib/servicio";

export const dynamic = "force-dynamic";

/** Publicaciones para elegir en el editor: las de Instagram si está conectado, más las de prueba. */
export async function GET() {
  const prueba = await (await canalPorNombre("simulado")).publicaciones();
  const cx = await leerConexion(await base());
  if (cx?.estado !== "activa" || !process.env.COMPOSIO_API_KEY) return NextResponse.json(prueba);
  try {
    return NextResponse.json([...(await (await canalPorNombre("instagram")).publicaciones()), ...prueba]);
  } catch {
    return NextResponse.json(prueba);
  }
}
