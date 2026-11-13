import {
  mysqlTable,
  serial,
  varchar,
  text,
  timestamp,
  int,
  boolean,
} from "drizzle-orm/mysql-core";

export const responses = mysqlTable("survey_responses", {
  id: serial("id").primaryKey(),
  perfil: varchar("perfil", { length: 20 }).notNull(), // "director" | "regional"
  cveEntidad: int("cve_entidad").notNull(),
  entidad: varchar("entidad", { length: 100 }).notNull(),
  clues: varchar("clues", { length: 20 }),
  hospital: varchar("hospital", { length: 255 }),
  categoria: varchar("categoria", { length: 50 }),
  cveRegion: int("cve_region"),
  region: varchar("region", { length: 100 }),
  payload: text("payload").notNull(), // JSON con todas las respuestas
  esPrueba: boolean("es_prueba").notNull().default(false), // respuestas de prueba
  // diferencia de plantilla: E1 (total) - (E2 + E3); null en coordinadores o sin datos
  eDiferencia: int("e_diferencia"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ResponseRow = typeof responses.$inferSelect;
