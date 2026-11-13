import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChartsReport from "@/components/admin/ChartsReport";
import { ArrowLeft, Download, RefreshCw, Lock, LogOut } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { DIRECTOR_SECTIONS, REGIONAL_SECTIONS } from "@/lib/questions";
import hospitalData from "@/data/hospitales.json";

const ENTIDADES = (hospitalData as { entidades: { cve: number; nombre: string }[] }).entidades;

type Row = {
  id: number;
  perfil: string;
  entidad: string;
  clues: string | null;
  hospital: string | null;
  region: string | null;
  esPrueba: boolean;
  eDiferencia: number | null;
  createdAt: Date;
  payload: Record<string, unknown>;
};

// Mapas pregunta → etiqueta por perfil (los ids se repiten entre perfiles con preguntas distintas)
interface LabelMap {
  labels: Record<string, string>;
  order: string[];
}
function buildLabelMap(sections: { fields: (typeof DIRECTOR_SECTIONS)[number]["fields"] }[]): LabelMap {
  const labels: Record<string, string> = {};
  const order: string[] = [];
  const used = new Set<string>();
  const addLabel = (key: string, label: string) => {
    let l = label;
    while (used.has(l)) l = `${label} [${key}]`;
    used.add(l);
    labels[key] = l;
    order.push(key);
  };
  for (const sec of sections) {
    for (const f of sec.fields) {
      const titulo = f.title.replace(/^(A\d+[ab]?|B\d|C\d|D\d|E\d|F\d|V\d|G\d)\.\s*/, "");
      addLabel(f.id, titulo);
      if (f.type === "radio" && f.withSpecify) addLabel(`${f.id}__spec`, `${titulo}: Especifique`);
      if (f.type === "multiMax" && f.extraOption === "Otro (especifique)") addLabel(`${f.id}__spec`, `${titulo}: Otro (especifique)`);
      if (f.type === "numberMatrix") {
        addLabel(`${f.id}__otro_label`, `${titulo}: Otro (especifique)`);
        addLabel(`${f.id}__otro_value`, `${titulo}: Otro cantidad`);
      }
    }
  }
  return { labels, order };
}
const MAP_DIRECTOR = buildLabelMap(DIRECTOR_SECTIONS);
const MAP_REGIONAL = buildLabelMap(REGIONAL_SECTIONS);
const BASE_COLS = ["ID", "Perfil", "Entidad", "Hospital", "CLUES", "Region", "Dif. plantilla E1-(E2+E3)", "Fecha", "Prueba"];

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  if (Array.isArray(v)) return v.join("; ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, string>)
      .filter(([, val]) => val !== "" && val !== undefined)
      .map(([k, val]) => `${k}: ${val}`)
      .join("; ");
  }
  return String(v);
}

function computeStats(reales: Row[]) {
  const byPerfil = { director: 0, regional: 0 };
  const byEntidad = new Map<string, number>();
  const b1 = new Map<string, number>();
  const b2 = new Map<string, number>();
  for (const r of reales) {
    byPerfil[r.perfil as "director" | "regional"]++;
    byEntidad.set(r.entidad, (byEntidad.get(r.entidad) ?? 0) + 1);
    const v1 = r.payload.b1 as string;
    const v2 = r.payload.b2 as string;
    if (v1) b1.set(v1, (b1.get(v1) ?? 0) + 1);
    if (v2) b2.set(v2, (b2.get(v2) ?? 0) + 1);
  }
  return {
    n: reales.length,
    byPerfil,
    byEntidad: [...byEntidad.entries()].sort((a, b) => b[1] - a[1]),
    b1: [...b1.entries()],
    b2: [...b2.entries()],
  };
}

export default function Admin() {
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token_resultados") ?? "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [perfilFilter, setPerfilFilter] = useState("todos");
  const [entidadFilter, setEntidadFilter] = useState("todas");
  const [incluirPruebas, setIncluirPruebas] = useState(false);
  const [q, setQ] = useState("");

  const auth = trpc.survey.panelAuth.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem("admin_token_resultados", res.token);
      setToken(res.token);
      setLoginError("");
    },
    onError: (e) => setLoginError(e.message),
  });

  const { data, isLoading, refetch, isFetching, error } = trpc.survey.list.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  // token inválido o caducado → volver a pedir contraseña
  useEffect(() => {
    if (token && error) {
      sessionStorage.removeItem("admin_token_resultados");
      setLoginError(error.message);
      setToken("");
    }
  }, [token, error]);

  const logout = () => {
    sessionStorage.removeItem("admin_token_resultados");
    setToken("");
  };

  const rows = useMemo(() => (data ?? []) as Row[], [data]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (!incluirPruebas && r.esPrueba) return false;
      if (perfilFilter !== "todos" && r.perfil !== perfilFilter) return false;
      if (entidadFilter !== "todas" && r.entidad !== entidadFilter) return false;
      if (!t) return true;
      return [r.hospital, r.region, r.clues].some((x) => x?.toLowerCase().includes(t));
    });
  }, [rows, perfilFilter, entidadFilter, incluirPruebas, q]);

  const stats = useMemo(() => computeStats(rows.filter((r) => !r.esPrueba)), [rows]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-900">
              <Lock className="h-5 w-5" /> Panel de resultados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Esta sección es privada. Ingrese la contraseña para consultar las respuestas.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pass">Contraseña</Label>
              <Input
                id="admin-pass"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                onKeyDown={(e) => e.key === "Enter" && auth.mutate({ panel: "resultados", password })}
              />
            </div>
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <Button
              onClick={() => auth.mutate({ panel: "resultados", password })}
              disabled={auth.isPending || !password}
              className="w-full bg-teal-700 hover:bg-teal-800"
            >
              {auth.isPending ? "Verificando..." : "Acceder"}
            </Button>
            <Link to="/" className="block text-center text-sm text-teal-700 hover:underline">
              ← Volver a la encuesta
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }


  const exportExcel = (perfil: "director" | "regional") => {
    const rows = filtered.filter((r) => r.perfil === perfil);
    const { labels, order } = perfil === "director" ? MAP_DIRECTOR : MAP_REGIONAL;
    // llaves no catalogadas (respuestas de versiones anteriores): al final, ordenadas
    const extraKeys = [
      ...new Set(rows.flatMap((r) => Object.keys(r.payload).filter((k) => !(k in labels)))),
    ].sort();
    const header = [
      ...BASE_COLS,
      ...order.filter((k, i) => order.indexOf(k) === i).map((k) => labels[k]),
      ...extraKeys,
    ];
    const flat = rows.map((r) => {
      const base: Record<string, string | number> = {
        ID: r.id,
        Perfil: r.perfil === "director" ? "Director de hospital" : "Coordinador regional",
        Entidad: r.entidad,
        Hospital: r.hospital ?? "",
        CLUES: r.clues ?? "",
        Region: r.region ?? "",
        "Dif. plantilla E1-(E2+E3)": r.eDiferencia ?? "",
        Fecha: new Date(r.createdAt).toLocaleString("es-MX"),
        Prueba: r.esPrueba ? "Sí" : "No",
      };
      for (const [k, v] of Object.entries(r.payload)) {
        base[labels[k] ?? k] = fmt(v);
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(flat, { header });
    ws["!cols"] = header.map(() => ({ wch: 24 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Respuestas");

    const st = computeStats(rows.filter((r) => !r.esPrueba));
    const nombrePerfil = perfil === "director" ? "Director de hospital" : "Coordinador regional";
    const resumen = [
      { Indicador: `Respuestas ${nombrePerfil}`, Valor: st.n },
      ...st.byEntidad.map(([e, n]) => ({ Indicador: `Entidad: ${e}`, Valor: n })),
      ...st.b1.map(([o, n]) => ({ Indicador: `B1 Situación actual - ${o}`, Valor: n })),
      ...st.b2.map(([o, n]) => ({ Indicador: `B2 Comparación vs antes - ${o}`, Valor: n })),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), "Resumen");

    XLSX.writeFile(wb, `resultados_${perfil === "director" ? "hospitales" : "coordinaciones"}_imss_bienestar.xlsx`);
  };

  const opciones = (arr: [string, number][]) =>
    arr.map(([o, n]) => ({ o, n, pct: stats.n ? Math.round((n / stats.n) * 100) : 0 }));

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
            <ArrowLeft className="h-4 w-4" /> Encuesta
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
            </Button>
            <Button size="sm" onClick={() => exportExcel("director")} className="bg-teal-700 hover:bg-teal-800" disabled={!filtered.some((r) => r.perfil === "director")}>
              <Download className="mr-1 h-4 w-4" /> Hospitales
            </Button>
            <Button size="sm" onClick={() => exportExcel("regional")} className="bg-teal-700 hover:bg-teal-800" disabled={!filtered.some((r) => r.perfil === "regional")}>
              <Download className="mr-1 h-4 w-4" /> Coordinaciones
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        <h1 className="mb-4 text-2xl font-bold text-teal-900">Panel de resultados</h1>

        {isLoading ? (
          <p className="text-slate-500">Cargando respuestas...</p>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Total (sin pruebas)</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{stats.n}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Directores</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{stats.byPerfil.director}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Coordinadores</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{stats.byPerfil.regional}</CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Entidades con respuestas</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{stats.byEntidad.length}</CardContent></Card>
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="text-base text-teal-900">B1. Situación actual (ambos perfiles)</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {opciones(stats.b1).map(({ o, n, pct }) => (
                    <div key={o} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0">{o}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-slate-600">{n} ({pct}%)</span>
                    </div>
                  ))}
                  {stats.b1.length === 0 && <p className="text-sm text-slate-400">Sin datos</p>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base text-teal-900">B2. Comparación vs antes de IMSS Bienestar</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {opciones(stats.b2).map(({ o, n, pct }) => (
                    <div key={o} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0">{o}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                        <div className="h-full bg-teal-600" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-12 text-right text-slate-600">{n} ({pct}%)</span>
                    </div>
                  ))}
                  {stats.b2.length === 0 && <p className="text-sm text-slate-400">Sin datos</p>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                <Select value={perfilFilter} onValueChange={setPerfilFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los perfiles</SelectItem>
                    <SelectItem value="director">Director</SelectItem>
                    <SelectItem value="regional">Coordinador regional</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entidadFilter} onValueChange={setEntidadFilter}>
                  <SelectTrigger className="w-52"><SelectValue placeholder="Entidad" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las entidades</SelectItem>
                    {ENTIDADES.map((e) => (
                      <SelectItem key={e.cve} value={e.nombre}>{e.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Buscar hospital o CLUES..." value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={incluirPruebas}
                    onChange={(e) => setIncluirPruebas(e.target.checked)}
                    className="h-4 w-4 accent-teal-700"
                  />
                  Incluir pruebas
                </label>
                <span className="text-sm text-slate-500">{filtered.length} respuestas</span>
              </CardContent>
            </Card>

            <Tabs defaultValue="tabla">
              <TabsList className="mb-4">
                <TabsTrigger value="tabla">Tabla de respuestas</TabsTrigger>
                <TabsTrigger value="graficas">Reporte gráfico</TabsTrigger>
              </TabsList>
              <TabsContent value="graficas">
                <ChartsReport rows={filtered} />
              </TabsContent>
              <TabsContent value="tabla" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base text-teal-900">Respuestas ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Perfil</TableHead>
                        <TableHead>Entidad</TableHead>
                        <TableHead>Hospital / Región</TableHead>
                        <TableHead>B1</TableHead>
                        <TableHead>B2</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>{r.id}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString("es-MX")}</TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={r.perfil === "director" ? "default" : "secondary"}>
                                {r.perfil === "director" ? "Director" : "Regional"}
                              </Badge>
                              {r.esPrueba && (
                                <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">PRUEBA</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{r.entidad}</TableCell>
                          <TableCell className="max-w-xs">
                            <p className="truncate text-xs font-medium">{r.hospital ?? r.region ?? "—"}</p>
                            {r.clues && <p className="text-[10px] text-slate-400">{r.clues}</p>}
                          </TableCell>
                          <TableCell className="text-xs">{fmt(r.payload.b1)}</TableCell>
                          <TableCell className="text-xs">{fmt(r.payload.b2)}</TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-slate-400">Sin respuestas todavía</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                </CardContent>
              </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
