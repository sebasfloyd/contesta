import { NextResponse } from "next/server";
import { secretoCronValido } from "@/lib/auth";
import { latido } from "@/lib/servicio";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Lo llama el reloj (pg_cron de Supabase, o `npm run reloj` en tu compu) una vez por minuto.
 * Reanuda esperas y trae lo nuevo de Instagram. Pide el secreto CRON_SECRETO.
 */
async function atender(pedido: Request) {
  if (!secretoCronValido(pedido.headers.get("authorization"))) {
    return NextResponse.json({ error: "Secreto incorrecto." }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await latido()) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = atender;
export const POST = atender;
