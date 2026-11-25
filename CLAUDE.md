@AGENTS.md

# Contesta: guía para el agente

Contesta responde comentarios y mensajes de Instagram con automatizaciones. Quien te habla probablemente no programa: hacé vos los pasos, explicá en simple qué hiciste y pedí solo lo que no podés conseguir (claves y autorizaciones en el navegador).

Escribí siempre en español rioplatense, directo, sin inglés innecesario y sin raya larga.

## Instalar (en este orden)

1. `npm install`
2. `npm run preparar` crea `.env.local` con `CLAVE_PANEL` y `CRON_SECRETO`. Mostrale la clave a la persona. Si `.env.local` ya existe, no lo pises.
3. `npm run dev` y que entre a http://localhost:3000. Sin `DATABASE_URL` se usa una base local (carpeta `.datos`): alcanza para probar todo con el simulador.
4. **Probá con el simulador antes de conectar nada**: creá una automatización desde una plantilla, activala y simulá un comentario. Recién cuando eso anda, seguí.
5. Supabase: pedile la cadena «Transaction pooler» (puerto 6543), guardala en `DATABASE_URL` y corré `npm run migrar`.
6. Vercel: que importe el repositorio y cargue las variables de `.env.local`. Después `URL_PUBLICA` con la dirección del panel.
7. `npm run programar` deja el reloj en Supabase (pg_cron llama a `/api/cron` cada minuto).
8. Composio: `COMPOSIO_API_KEY` en `.env.local` y en Vercel. La conexión se hace desde el panel, en «Conectar Instagram».

## Variables

Están todas explicadas en `.env.example`. Obligatorias: `CLAVE_PANEL`, `CRON_SECRETO`. En Vercel también `DATABASE_URL`. Para Instagram: `COMPOSIO_API_KEY` y `URL_PUBLICA`. Para IA: `AI_GATEWAY_API_KEY`.

Nunca escribas claves en archivos que se suben al repositorio, ni las muestres completas en la conversación. `.env.local` está en `.gitignore`.

## Migraciones

- Viven en `supabase/migrations`, numeradas. `npm run migrar` aplica las que falten y las anota en la tabla `_migraciones`.
- Para cambiar el esquema, agregá un archivo nuevo (`0002_...sql`). No edites uno ya aplicado.
- El SQL tiene que andar también en la base local de los tests (PGlite): sin extensiones de Supabase dentro de las migraciones.

## Probar

- `npm test`: tests del motor con base en memoria y canal simulado. Corré esto después de tocar `lib/`.
- `npm run tipos` y `npm run build` antes de dar algo por terminado.
- `npm run prueba:panel`: recorre el panel con un navegador sin interfaz (la primera vez: `npx playwright install chromium`).
- En el panel, el Simulador permite «Saltar las esperas» y «Simular que pasaron 25 hs».
- En tu compu el reloj es `npm run reloj` (con `npm run dev` andando).

## Mapa del código

- `lib/motor/motor.ts`: las reglas y las protecciones. Único lugar por donde salen mensajes.
- `lib/canales/tipos.ts`: la interfaz «canal». `simulado.ts` y `composio.ts` la implementan.
- `lib/servicio.ts`: arma el motor para el panel y el latido de cada minuto.
- `lib/plantillas.ts`: las automatizaciones listas para usar.
- `app/(panel)/`: las pantallas. `app/acciones.ts`: todo lo que el panel puede hacer.
- `proxy.ts` y `lib/auth.ts`: la clave del panel.

Next.js cambió cosas respecto de lo que conocés: leé `node_modules/next/dist/docs/` antes de tocar rutas, y `node_modules/ai/docs/` antes de tocar la IA. Los modelos van como texto `proveedor/modelo` por el AI Gateway, sin paquetes de proveedor.

## Qué no tocar

- **Las protecciones del motor**: idempotencia, un privado por comentario, ventana de 24 horas, tope por hora y baja. Existen para que Instagram no limite la cuenta. Si te piden sacarlas, explicá el riesgo y no las saques.
- **No agregues difusiones masivas** ni envíos a contactos fuera de la ventana de 24 horas: Instagram no lo permite.
- No mandes mensajes reales para «probar»: usá el canal simulado. Los contactos de prueba nunca salen a Instagram.
- No saques la revisión de sesión de `app/acciones.ts` ni el secreto de `/api/cron`.
- No cambies el stack (Next.js, Supabase, Vercel, Composio, AI Gateway) ni agregues scripts que solo anden en Mac o solo en Windows: los scripts van en Node.
- No toques `LICENSE`.

## Para sumar un canal nuevo

Implementá la interfaz `Canal` en un archivo nuevo de `lib/canales/`, registralo en `canalPorNombre` (`lib/servicio.ts`) y hacé que sus eventos lleguen a `motor.recibir`. El motor y las pantallas no cambian.
