# Encuesta de percepción hospitalaria IMSS-Bienestar

Aplicación full-stack para cuestionarios de directivos y coordinadores regionales, paneles de avance y resultados.

El repositorio contiene el código y el catálogo de hospitales. Por privacidad, no contiene respuestas reales, `.env`, contraseñas, tokens, `node_modules` ni compilaciones. Los respaldos se conservan aparte.

## Tecnologías

React 19, Vite, TypeScript, Tailwind CSS, Hono, tRPC, Drizzle ORM y MySQL. La API también puede usar Google Sheets a través de Apps Script.

## Desarrollo local

Requisitos: Node.js 20+.

1. Ejecuta `npm install`.
2. Copia `.env.example` a `.env` y configura un backend: `DATABASE_URL`, o bien `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_TOKEN`.
3. Configura `RESULTS_PASSWORD` y `PROGRESS_PASSWORD` en `.env`.
4. Ejecuta `npm run check` y `npm run build`.
5. Inicia en desarrollo con `npm run dev`, o con `npm start` tras compilar.

La aplicación escucha en `PORT` (3000 por omisión).

## Google Sheets

El archivo `apps-script/Code.gs` contiene el endpoint. Debe desplegarse como aplicación web con acceso para recibir solicitudes del servidor. Guarda `SPREADSHEET_ID` y `API_TOKEN` en las propiedades privadas del proyecto de Apps Script. Configura el mismo `API_TOKEN` como `GOOGLE_APPS_SCRIPT_TOKEN` solo en el entorno del servidor. No subas `.env` ni incluyas secretos o el ID de la hoja en el frontend o el repositorio.

## GitHub Pages

GitHub Pages sirve archivos estáticos; no ejecuta el backend Hono. Por tanto, publicar ahí el frontend no hace funcionar por sí solo el envío de encuestas ni los paneles. Para esos flujos se necesita alojar también el backend Node.js y configurar sus variables de entorno en ese proveedor.

## Rutas

- `/`: portada.
- `/encuesta`: cuestionario.
- `/avance`: panel de avance.
- `/resultados`: resultados y exportaciones.
