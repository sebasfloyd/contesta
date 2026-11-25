# Cómo aportar

Gracias por querer mejorar Contesta. Es un proyecto de enseñanza: se prioriza que el código se entienda.

## Antes de mandar un cambio

1. Contá primero qué querés cambiar abriendo un reporte. Así no trabajás de más.
2. Hacé el cambio en una rama propia.
3. Corré esto y que pase todo:
   ```
   npm test
   npm run tipos
   npm run build
   npm run prueba:panel
   ```
4. Si cambiaste algo que se ve, regenerá las imágenes con `npm run docs:img`.

## Criterios

- Los textos del panel y la documentación van en español rioplatense, directos, sin inglés innecesario y sin raya larga.
- Los ejemplos y datos de prueba no llevan nombres de personas reales.
- Nada de claves ni secretos en el repositorio.
- Las protecciones del motor (idempotencia, ventana de 24 horas, un privado por comentario, tope por hora, baja) no se quitan ni se saltean. Tampoco se aceptan difusiones masivas.
- Todo cambio en `lib/motor` viene con su test.
- Los scripts van en Node para que anden igual en Mac y en Windows.
- Cambios de esquema: una migración nueva en `supabase/migrations`, nunca editar una existente.

## Licencia

Al aportar aceptás que tu cambio se publique con la misma licencia del proyecto: Apache 2.0 con Commons Clause. Ver [LICENSE](LICENSE).
