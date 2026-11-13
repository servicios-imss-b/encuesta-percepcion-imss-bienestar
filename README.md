# Encuesta de percepción hospitalaria IMSS-Bienestar

Repositorio privado para migración a otro proveedor.

## Respaldo completo

El paquete de migración incluye:

- Código fuente completo: React 19 + Vite + TypeScript + Tailwind + Hono + tRPC 11 + Drizzle ORM + MySQL.
- Catálogo vigente: 593 hospitales y 216 coordinaciones.
- 677 respuestas reales: 517 directores y 160 coordinadores.
- Respaldo fiel en `datos/respuestas-percepcion.json` y versión tabular en CSV.
- Esquema MySQL en `db/schema.sql` y esquema Drizzle en `db/schema.ts`.

El paquete íntegro se entrega como `encuesta-percepcion-migracion.zip` en la conversación de Kimi, debido a que el conector de GitHub no admite la carga directa del archivo binario. No incluye `.env`, credenciales, `node_modules` ni compilaciones.

## Puesta en marcha

Requisitos: Node.js 20+ y MySQL 8+.

1. Descomprimir el paquete.
2. Crear una base MySQL vacía y ejecutar `db/schema.sql`.
3. Copiar `.env.example` a `.env` y configurar `DATABASE_URL`.
4. Ejecutar `npm install`.
5. Validar con `npm run check` y compilar con `npm run build`.
6. Iniciar con `npm start`.

El servidor escucha en `PORT` (3000 por omisión).

## Validación del respaldo

Al importar, comprobar 677 filas, 517 directores y 160 coordinadores; todos con `esPrueba = false`. El JSON conserva el `payload` completo por pregunta y es la fuente recomendada para restauración.

## Rutas

- `/`: portada.
- `/encuesta`: cuestionario.
- `/avance`: avance.
- `/resultados`: resultados y exportaciones.

Las contraseñas operativas deben trasladarse por un canal seguro antes de abrir el sitio al público.
