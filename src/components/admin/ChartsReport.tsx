import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DIRECTOR_SECTIONS, REGIONAL_SECTIONS, type Section, type Field, type Values,
} from "@/lib/questions";

const NO_DATA = "__NO_DATA__";

const PALETTE = [
  "#0f766e", "#14b8a6", "#f59e0b", "#6366f1", "#ef4444",
  "#0ea5e9", "#84cc16", "#e879f9", "#64748b", "#f97316",
];

interface Row {
  id: number | string;
  perfil: string;
  entidad: string;
  hospital: string | null;
  clues: string | null;
  region: string | null;
  esPrueba: boolean;
  payload: Values;
}

function toNum(v: unknown): number | null {
  if (v === NO_DATA || v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Cuenta por opción (radio) — valores fuera de catálogo cuentan como "Otro"
function chartRadio(rows: Row[], f: Field) {
  if (f.type !== "radio") return null;
  const counts = new Map(f.options.map((o) => [o, 0]));
  let otro = 0, contestaron = 0;
  const specs: string[] = [];
  for (const r of rows) {
    const v = r.payload[f.id];
    if (typeof v === "string" && v) {
      contestaron++;
      if (counts.has(v)) counts.set(v, counts.get(v)! + 1);
      else otro++;
    }
    const spec = r.payload[`${f.id}__spec`];
    if (typeof spec === "string" && spec.trim()) specs.push(spec.trim());
  }
  const data = [...counts.entries()].map(([name, n]) => ({ name, Respuestas: n }));
  if (otro) data.push({ name: f.options.includes("Otro") ? "Otro" : "Otro (sin catálogo)", Respuestas: otro });
  return { data, contestaron, specs };
}

// Cuenta por opción (multiMax: arreglo de opciones)
function chartMulti(rows: Row[], f: Field) {
  if (f.type !== "multiMax") return null;
  const counts = new Map(f.options.map((o) => [o, 0]));
  let contestaron = 0;
  const specs: string[] = [];
  for (const r of rows) {
    const v = r.payload[f.id];
    if (Array.isArray(v) && v.length) {
      contestaron++;
      for (const o of v) {
        const key = String(o);
        if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
        else counts.set(key, 1);
      }
    }
    const spec = r.payload[`${f.id}__spec`];
    if (typeof spec === "string" && spec.trim()) specs.push(spec.trim());
  }
  const data = [...counts.entries()].map(([name, n]) => ({ name, Respuestas: n }));
  return { data, contestaron, specs };
}

// Matriz de escala: barras apiladas por renglón
function chartScale(rows: Row[], f: Field) {
  if (f.type !== "scaleMatrix") return null;
  const data = f.rows.map((rowName) => {
    const entry: Record<string, string | number> = { name: rowName };
    for (const o of f.options) entry[o] = 0;
    return entry;
  });
  const byRow = new Map(f.rows.map((r, i) => [r, i]));
  let contestaron = 0;
  for (const r of rows) {
    const v = r.payload[f.id];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      let hit = false;
      for (const [rowName, val] of Object.entries(v as Record<string, unknown>)) {
        const i = byRow.get(rowName);
        if (i !== undefined && typeof val === "string" && f.options.includes(val)) {
          data[i][val] = (data[i][val] as number) + 1;
          hit = true;
        }
      }
      if (hit) contestaron++;
    }
  }
  return { data, contestaron };
}

// Número: promedio, mínimo, máximo
function chartNumber(rows: Row[], f: Field) {
  if (f.type !== "number") return null;
  const nums = rows.map((r) => toNum(r.payload[f.id])).filter((n): n is number => n !== null);
  const noSabe = rows.filter((r) => r.payload[f.id] === NO_DATA).length;
  if (!nums.length && !noSabe) return { data: null, contestaron: 0, stats: null as null | { prom: number; min: number; max: number; n: number; noSabe: number } };
  const sum = nums.reduce((a, b) => a + b, 0);
  const stats = {
    prom: nums.length ? Math.round(sum / nums.length) : 0,
    min: nums.length ? Math.min(...nums) : 0,
    max: nums.length ? Math.max(...nums) : 0,
    n: nums.length,
    noSabe,
  };
  return { data: null, contestaron: nums.length + noSabe, stats };
}

// Matriz numérica: promedio por renglón
function chartNumberMatrix(rows: Row[], f: Field) {
  if (f.type !== "numberMatrix") return null;
  const sum = new Map(f.rows.map((r) => [r, 0]));
  const cnt = new Map(f.rows.map((r) => [r, 0]));
  let contestaron = 0;
  for (const r of rows) {
    const v = r.payload[f.id];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      let hit = false;
      for (const [rowName, val] of Object.entries(v as Record<string, unknown>)) {
        if (sum.has(rowName)) {
          const n = toNum(val);
          if (n !== null) { sum.set(rowName, sum.get(rowName)! + n); cnt.set(rowName, cnt.get(rowName)! + 1); hit = true; }
        }
      }
      if (hit) contestaron++;
    }
  }
  const data = f.rows.map((name) => ({
    name,
    Promedio: cnt.get(name) ? Math.round((sum.get(name)! / cnt.get(name)!) * 10) / 10 : 0,
  }));
  return { data, contestaron };
}

// Texto abierto: respuestas más frecuentes
function chartText(rows: Row[], f: Field) {
  if (f.type !== "text") return null;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r.payload[f.id];
    if (typeof v === "string" && v.trim()) {
      const k = v.trim();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const data = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, n]) => ({ name: name.length > 60 ? `${name.slice(0, 60)}…` : name, Respuestas: n }));
  return { data, contestaron: [...counts.values()].reduce((a, b) => a + b, 0) };
}

function SpecsList({ specs }: { specs: string[] }) {
  if (!specs.length) return null;
  return (
    <div className="mt-2 rounded-lg bg-slate-50 p-2">
      <p className="mb-1 text-xs font-medium text-slate-500">«Especifique» ({specs.length}):</p>
      <ul className="max-h-28 space-y-0.5 overflow-y-auto text-xs text-slate-600">
        {specs.map((s, i) => <li key={i}>· {s}</li>)}
      </ul>
    </div>
  );
}

function SimpleBars({ data }: { data: { name: string; Respuestas: number }[] }) {
  const h = Math.max(160, data.length * 34 + 50);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Bar dataKey="Respuestas" fill="#0f766e" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackedScale({ data, options }: { data: Record<string, string | number>[]; options: string[] }) {
  const h = Math.max(180, data.length * 40 + 80);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" allowDecimals={false} />
        <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {options.map((o, i) => (
          <Bar key={o} dataKey={o} stackId="a" fill={PALETTE[i % PALETTE.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function QuestionChart({ f, rows }: { f: Field; rows: Row[] }) {
  const body = useMemo(() => {
    if (f.type === "radio") {
      const c = chartRadio(rows, f)!;
      return (
        <>
          <SimpleBars data={c.data} />
          <SpecsList specs={c.specs} />
          <p className="mt-1 text-xs text-slate-400">{c.contestaron} respuestas</p>
        </>
      );
    }
    if (f.type === "multiMax") {
      const c = chartMulti(rows, f)!;
      return (
        <>
          <SimpleBars data={c.data} />
          <SpecsList specs={c.specs} />
          <p className="mt-1 text-xs text-slate-400">{c.contestaron} respuestas</p>
        </>
      );
    }
    if (f.type === "scaleMatrix") {
      const c = chartScale(rows, f)!;
      return (
        <>
          <StackedScale data={c.data} options={f.options} />
          <p className="mt-1 text-xs text-slate-400">{c.contestaron} respuestas</p>
        </>
      );
    }
    if (f.type === "number") {
      const c = chartNumber(rows, f)!;
      if (!c.stats) return <p className="text-sm text-slate-400">Sin datos todavía</p>;
      return (
        <div className="flex flex-wrap gap-6 pt-2 text-center">
          <div><p className="text-2xl font-bold text-teal-800">{c.stats.prom}</p><p className="text-xs text-slate-500">Promedio</p></div>
          <div><p className="text-2xl font-bold text-teal-800">{c.stats.min}</p><p className="text-xs text-slate-500">Mínimo</p></div>
          <div><p className="text-2xl font-bold text-teal-800">{c.stats.max}</p><p className="text-xs text-slate-500">Máximo</p></div>
          <div><p className="text-2xl font-bold text-slate-500">{c.stats.n}</p><p className="text-xs text-slate-500">Con dato</p></div>
          {c.stats.noSabe > 0 && (
            <div><p className="text-2xl font-bold text-slate-400">{c.stats.noSabe}</p><p className="text-xs text-slate-500">«{f.noDataLabel ?? "No sé"}»</p></div>
          )}
        </div>
      );
    }
    if (f.type === "numberMatrix") {
      const c = chartNumberMatrix(rows, f)!;
      const h = Math.max(160, c.data.length * 34 + 50);
      return (
        <>
          <ResponsiveContainer width="100%" height={h}>
            <BarChart data={c.data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="Promedio" fill="#6366f1" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-slate-400">{c.contestaron} respuestas (promedios por renglón)</p>
        </>
      );
    }
    if (f.type === "text") {
      const c = chartText(rows, f)!;
      if (!c.data.length) return <p className="text-sm text-slate-400">Sin datos todavía</p>;
      return (
        <>
          <SimpleBars data={c.data} />
          <p className="mt-1 text-xs text-slate-400">{c.contestaron} respuestas (agrupadas por texto idéntico)</p>
        </>
      );
    }
    return null;
  }, [f, rows]);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <p className="mb-2 text-sm font-medium text-slate-800">{f.title}</p>
      {body}
    </div>
  );
}

function ProfileCharts({ sections, rows, titulo }: { sections: Section[]; rows: Row[]; titulo: string }) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base text-teal-900">{titulo}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-slate-400">Sin respuestas de este perfil con los filtros actuales.</p></CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-teal-900">{titulo} ({rows.length} respuestas)</h2>
      {sections.map((sec) => (
        <Card key={sec.key}>
          <CardHeader><CardTitle className="text-base text-teal-900">{sec.label}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {sec.fields.map((f) => <QuestionChart key={f.id} f={f} rows={rows} />)}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ChartsReport({ rows }: { rows: Row[] }) {
  const directores = rows.filter((r) => r.perfil === "director");
  const regionales = rows.filter((r) => r.perfil === "regional");
  return (
    <div className="space-y-10">
      <ProfileCharts sections={DIRECTOR_SECTIONS} rows={directores} titulo="Cuestionario de directores de hospital" />
      <ProfileCharts sections={REGIONAL_SECTIONS} rows={regionales} titulo="Cuestionario de coordinadores regionales" />
    </div>
  );
}
