import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { callAppsScript, type SheetResponse } from "./queries/apps-script";
import { responses } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { RESULTS_PASSWORD, PROGRESS_PASSWORD, TOKEN_TTL_MS } from "./config";
import { env } from "./lib/env";

// Tokens de acceso a los paneles (en memoria; caducan en 12 h)
// token → { panel, expires }
type Panel = "resultados" | "avance";
const adminTokens = new Map<string, { panel: Panel; expires: number }>();

const PANEL_PASSWORDS: Record<Panel, string> = {
  resultados: RESULTS_PASSWORD,
  avance: PROGRESS_PASSWORD,
};

function requirePanel(token: string, panel: Panel) {
  const entry = adminTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    adminTokens.delete(token);
    throw new Error("Acceso no autorizado. Inicie sesión de nuevo.");
  }
  if (entry.panel !== panel) {
    throw new Error("Acceso no autorizado. Inicie sesión de nuevo.");
  }
  // renovar vigencia
  entry.expires = Date.now() + TOKEN_TTL_MS;
}

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),

  survey: createRouter({
    submit: publicQuery
      .input(
        z.object({
          perfil: z.enum(["director", "regional"]),
          cveEntidad: z.number().int(),
          entidad: z.string(),
          clues: z.string().optional(),
          hospital: z.string().optional(),
          categoria: z.string().optional(),
          cveRegion: z.number().int().optional(),
          region: z.string().optional(),
          esPrueba: z.boolean().optional(),
          eDiferencia: z.number().int().optional(),
          payload: z.record(z.string(), z.unknown()),
        })
      )
      .mutation(async ({ input }) => {
        if (env.googleAppsScriptUrl) {
          const result = await callAppsScript<{ id: number }>("submit", input);
          return { ok: true as const, id: result.id };
        }

        const db = getDb();
        const result = await db.insert(responses).values({
          perfil: input.perfil,
          cveEntidad: input.cveEntidad,
          entidad: input.entidad,
          clues: input.clues ?? null,
          hospital: input.hospital ?? null,
          categoria: input.categoria ?? null,
          cveRegion: input.cveRegion ?? null,
          region: input.region ?? null,
          payload: JSON.stringify(input.payload),
          esPrueba: input.esPrueba ?? false,
          eDiferencia: input.eDiferencia ?? null,
        });
        return { ok: true as const, id: Number(result[0].insertId) };
      }),

    // Autenticación para los dos paneles (resultados / avance)
    panelAuth: publicQuery
      .input(z.object({ panel: z.enum(["resultados", "avance"]), password: z.string() }))
      .mutation(({ input }) => {
        if (input.password !== PANEL_PASSWORDS[input.panel]) {
          throw new Error("Contraseña incorrecta.");
        }
        const token = randomUUID();
        adminTokens.set(token, { panel: input.panel, expires: Date.now() + TOKEN_TTL_MS });
        return { token, panel: input.panel };
      }),

    // Panel de resultados: todas las respuestas completas
    list: publicQuery
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        requirePanel(input.token, "resultados");
        if (env.googleAppsScriptUrl) {
          return callAppsScript<SheetResponse[]>("list");
        }

        const db = getDb();
        const rows = await db.select().from(responses).orderBy(desc(responses.createdAt), desc(responses.id));
        return rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) as Record<string, unknown> }));
      }),

    count: publicQuery
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        requirePanel(input.token, "resultados");
        if (env.googleAppsScriptUrl) {
          return callAppsScript<{ total: number; directores: number; regionales: number }>("count");
        }

        const db = getDb();
        const rows = await db.select().from(responses);
        return {
          total: rows.length,
          directores: rows.filter((r) => r.perfil === "director").length,
          regionales: rows.filter((r) => r.perfil === "regional").length,
        };
      }),

    // Panel de avance: directores y coordinadores, datos mínimos para el cruce
    responded: publicQuery
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        requirePanel(input.token, "avance");
        if (env.googleAppsScriptUrl) {
          return callAppsScript<
            Pick<SheetResponse, "id" | "perfil" | "clues" | "hospital" | "entidad" | "cveEntidad" | "categoria" | "cveRegion" | "region" | "createdAt">[]
          >( "responded");
        }

        const db = getDb();
        const rows = await db
          .select({
            id: responses.id,
            perfil: responses.perfil,
            clues: responses.clues,
            hospital: responses.hospital,
            entidad: responses.entidad,
            cveEntidad: responses.cveEntidad,
            categoria: responses.categoria,
            cveRegion: responses.cveRegion,
            region: responses.region,
            createdAt: responses.createdAt,
          })
          .from(responses)
          // solo respuestas reales: las de prueba no cuentan
          .where(eq(responses.esPrueba, false))
          .orderBy(desc(responses.createdAt), desc(responses.id));
        return rows;
      }),
  }),
});

export type AppRouter = typeof appRouter;
