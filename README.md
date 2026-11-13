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
4. Si el frontend y el backend se alojan en dominios distintos, configura `CORS_ORIGIN` con el origen del frontend.
5. Ejecuta `npm run check` y `npm run build`.
6. Inicia en desarrollo con `npm run dev`, o con `npm start` tras compilar.

La aplicación escucha en `PORT` (3000 por omisión).

## Google Sheets y GitHub Pages

GitHub Pages usa `VITE_GOOGLE_APPS_SCRIPT_URL` para enviar solicitudes directamente al web app de Apps Script mediante un formulario oculto a un iframe. Apps Script responde con `window.top.postMessage`, evitando CORS sin exponer un token en el navegador. El frontend acepta mensajes de `script.google.com` y de los subdominios `*.googleusercontent.com` donde Apps Script ejecuta el HTML.

Importante: al modificar `apps-script/Code.gs` hay que publicar una **nueva versión** de la implementación (Implementar → Administrar implementaciones → editar → Nueva versión). Editar el código no actualiza la URL `/exec` que ya está publicada.

En las propiedades privadas del proyecto de Apps Script configura `SPREADSHEET_ID`, `RESULTS_PASSWORD` y `PROGRESS_PASSWORD`. Despliega como aplicación web ejecutada por la cuenta propietaria y accesible para cualquiera; las consultas de resultados y avance siguen protegidas por sus contraseñas. El workflow de Pages ya incluye la URL pública del web app.

Para desarrollo local también puede usarse la API Hono con las variables de `GOOGLE_APPS_SCRIPT_URL` y `GOOGLE_APPS_SCRIPT_TOKEN` del `.env`. No subas `.env` ni incluyas contraseñas, tokens o el ID de la hoja en el frontend.

## Rutas

- `/`: portada.
- `/encuesta`: cuestionario.
- `/avance`: panel de avance.
- `/resultados`: resultados y exportaciones.
