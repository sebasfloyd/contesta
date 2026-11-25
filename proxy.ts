import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION, sesionValida } from "./lib/auth";

// Todo el panel pide la clave. Quedan afuera: la pantalla de entrada y el cron (que usa su propio secreto).
export async function proxy(pedido: NextRequest) {
  if (await sesionValida(pedido.cookies.get(COOKIE_SESION)?.value)) return NextResponse.next();
  if (pedido.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Hay que entrar al panel primero." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/entrar", pedido.url));
}

export const config = {
  matcher: ["/((?!entrar|api/cron|_next/static|_next/image|favicon.ico|icono.svg|logo.svg).*)"],
};
