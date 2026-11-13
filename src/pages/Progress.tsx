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
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Download, RefreshCw, Lock, LogOut, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import data from "@/data/hospitales.json";

const { entidades, regiones, hospitales } = data as {
  entidades: { cve: number; nombre: string }[];
  regiones: { cveEntidad: number; regiones: { cve: number; nombre: string }[] }[];
  hospitales: {
    clues: string;
    nombre: string;
    entidad: string;
    cveEntidad: number;
    categoria: string;
    region: string | null;
  }[];
};

type Responded = {
  perfil: string;
  clues: string | null;
  hospital: string | null;
  entidad: string;
  cveEntidad: number;
  categoria: string | null;
  cveRegion: number | null;
  region: string | null;
  createdAt: Date;
};

type HospitalRow = (typeof hospitales)[number] & { fecha: string | null };

function fmtFecha(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export default function Progress() {
  const [token, setToken] = useState(() => sessionStorage.getItem("admin_token_avance") ?? "");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [entidadSel, setEntidadSel] = useState("todas");
  const [vistaResumen, setVistaResumen] = useState<"hospitales" | "coordinaciones">("hospitales");
  const [q, setQ] = useState("");

  const auth = trpc.survey.panelAuth.useMutation({
    onSuccess: (res) => {
      sessionStorage.setItem("admin_token_avance", res.token);
      setToken(res.token);
      setLoginError("");
    },
    onError: (e) => setLoginError(e.message),
  });

  const { data: responded, isLoading, refetch, isFetching, error } = trpc.survey.responded.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (token && error) {
      sessionStorage.removeItem("admin_token_avance");
      setLoginError(error.message);
      setToken("");
    }
  }, [token, error]);

  const logout = () => {
    sessionStorage.removeItem("admin_token_avance");
    setToken("");
  };

  // cruzar respuestas: directores contra la base de hospitales; coordinadores contra regiones
  const { resumen, coordResumen, contestaron, faltan, regionales, regionalesFaltan } = useMemo(() => {
    const dirs = ((responded ?? []) as Responded[]).filter((r) => r.perfil === "director");
    const regs = ((responded ?? []) as Responded[]).filter((r) => r.perfil === "regional");
    const byClues = new Map<string, Responded>();
    for (const r of dirs) {
      if (r.clues && !byClues.has(r.clues)) byClues.set(r.clues, r); // la más reciente primero
    }
    const contestaron: HospitalRow[] = [];
    const faltan: HospitalRow[] = [];
    for (const h of hospitales) {
      const resp = byClues.get(h.clues);
      const row = { ...h, fecha: resp ? fmtFecha(resp.createdAt) : null };
      if (resp) contestaron.push(row);
      else faltan.push(row);
    }
    contestaron.sort((a, b) => a.entidad.localeCompare(b.entidad) || a.nombre.localeCompare(b.nombre));
    faltan.sort((a, b) => a.entidad.localeCompare(b.entidad) || a.nombre.localeCompare(b.nombre));

    const regionales = regs.map((r) => ({
      entidad: r.entidad,
      cveEntidad: r.cveEntidad,
      region: r.region ?? "—",
      fecha: fmtFecha(r.createdAt),
    }));
    regionales.sort((a, b) => a.entidad.localeCompare(b.entidad) || a.region.localeCompare(b.region));

    // coordinaciones con al menos una respuesta (por entidad + nombre de región)
    const regionesConRespuesta = new Set(regs.map((r) => `${r.cveEntidad}|${r.region ?? ""}`));

    // universo de coordinaciones desde la base
    const todasRegiones = entidades.flatMap((e) => {
      const rs = regiones.find((x) => x.cveEntidad === e.cve)?.regiones ?? [];
      return rs.map((r) => ({ cveEntidad: e.cve, entidad: e.nombre, region: r.nombre?.trim() || "(sin nombre)" }));
    });
    const regionalesFaltan = todasRegiones.filter(
      (r) => !regionesConRespuesta.has(`${r.cveEntidad}|${r.region}`)
    );

    const coordResumen = entidades.map((e) => {
      const total = regiones.find((x) => x.cveEntidad === e.cve)?.regiones.length ?? 0;
      const hechas = (regiones.find((x) => x.cveEntidad === e.cve)?.regiones ?? []).filter((r) =>
        regionesConRespuesta.has(`${e.cve}|${r.nombre?.trim() || "(sin nombre)"}`)
      ).length;
      return {
        cve: e.cve,
        entidad: e.nombre,
        total,
        contestaron: hechas,
        faltan: total - hechas,
        pct: total ? Math.round((hechas / total) * 100) : 0,
      };
    });

    const resumen = entidades.map((e) => {
      const total = hospitales.filter((h) => h.cveEntidad === e.cve).length;
      const hechas = contestaron.filter((h) => h.cveEntidad === e.cve).length;
      return {
        cve: e.cve,
        entidad: e.nombre,
        total,
        contestaron: hechas,
        faltan: total - hechas,
        pct: total ? Math.round((hechas / total) * 100) : 0,
      };
    });
    return { resumen, coordResumen, contestaron, faltan, regionales, regionalesFaltan };
  }, [responded]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const ok = (h: HospitalRow) =>
      (entidadSel === "todas" || h.entidad === entidadSel) &&
      (!t || h.nombre.toLowerCase().includes(t) || h.clues.toLowerCase().includes(t));
    const regionalesFiltrados = regionales.filter(
      (r) =>
        (entidadSel === "todas" || r.entidad === entidadSel) &&
        (!t || r.region.toLowerCase().includes(t))
    );
    const regionalesFaltanFiltrados = regionalesFaltan.filter(
      (r) =>
        (entidadSel === "todas" || r.entidad === entidadSel) &&
        (!t || r.region.toLowerCase().includes(t))
    );
    return {
      contestaron: contestaron.filter(ok),
      faltan: faltan.filter(ok),
      regionales: regionalesFiltrados,
      regionalesFaltan: regionalesFaltanFiltrados,
    };
  }, [contestaron, faltan, regionales, regionalesFaltan, entidadSel, q]);

  const totalBase = hospitales.length;
  const totalHechas = contestaron.length;
  const pctGlobal = totalBase ? Math.round((totalHechas / totalBase) * 100) : 0;
  const totalCoordsBase = coordResumen.reduce((acc, r) => acc + r.total, 0);
  const totalCoordsFaltan = regionalesFaltan.length;

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    const resumenRows = resumen.map((r) => ({
      Entidad: r.entidad,
      "Hospitales en base": r.total,
      "Ya contestaron": r.contestaron,
      Faltan: r.faltan,
      "Avance %": r.pct,
    }));
    const coordResumenRows = coordResumen.map((r) => ({
      Entidad: r.entidad,
      "Coordinaciones en base": r.total,
      "Ya contestaron": r.contestaron,
      Faltan: r.faltan,
      "Avance %": r.pct,
    }));
    const wsRes = XLSX.utils.json_to_sheet(resumenRows);
    wsRes["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsRes, "Resumen hospitales");
    const wsCoord = XLSX.utils.json_to_sheet(coordResumenRows);
    wsCoord["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsCoord, "Resumen coordinaciones");

    const cols = [
      { wch: 16 }, { wch: 52 }, { wch: 24 }, { wch: 22 }, { wch: 20 }, { wch: 18 },
    ];
    const aSheet = XLSX.utils.json_to_sheet(
      contestaron.map((h) => ({
        CLUES: h.clues,
        Hospital: h.nombre,
        Entidad: h.entidad,
        "Categoría gerencial": h.categoria,
        Región: h.region ?? "",
        "Fecha de respuesta": h.fecha ?? "",
      }))
    );
    aSheet["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, aSheet, "Ya contestaron");

    const fSheet = XLSX.utils.json_to_sheet(
      faltan.map((h) => ({
        CLUES: h.clues,
        Hospital: h.nombre,
        Entidad: h.entidad,
        "Categoría gerencial": h.categoria,
        Región: h.region ?? "",
      }))
    );
    fSheet["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, fSheet, "Faltan por responder");

    const cSheet = XLSX.utils.json_to_sheet(
      regionales.map((r) => ({
        Entidad: r.entidad,
        "Región (coordinación)": r.region,
        "Fecha de respuesta": r.fecha,
      }))
    );
    cSheet["!cols"] = [{ wch: 28 }, { wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, cSheet, "Coordinadores");

    const cfSheet = XLSX.utils.json_to_sheet(
      regionalesFaltan.map((r) => ({ Entidad: r.entidad, "Región (coordinación)": r.region }))
    );
    cfSheet["!cols"] = [{ wch: 28 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(wb, cfSheet, "Coord. faltantes");

    XLSX.writeFile(wb, "avance_encuesta_imss_bienestar.xlsx");
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-900">
              <Lock className="h-5 w-5" /> Panel de avance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-500">
              Esta sección es privada. Ingrese la contraseña para consultar el avance de respuestas
              por entidad.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="avance-pass">Contraseña</Label>
              <Input
                id="avance-pass"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(""); }}
                onKeyDown={(e) => e.key === "Enter" && auth.mutate({ panel: "avance", password })}
              />
            </div>
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <Button
              onClick={() => auth.mutate({ panel: "avance", password })}
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
            <Button size="sm" onClick={exportExcel} className="bg-teal-700 hover:bg-teal-800">
              <Download className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        <h1 className="mb-1 text-2xl font-bold text-teal-900">Panel de avance</h1>
        <p className="mb-4 text-sm text-slate-500">
          Hospitales de la base que ya contestaron (directores) y coordinaciones con respuesta.{" "}
          Las respuestas capturadas con la liga de prueba no se cuentan aquí.
        </p>

        {isLoading ? (
          <p className="text-slate-500">Cargando avance...</p>
        ) : (
          <>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Hospitales en base</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{totalBase}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Hospitales que contestaron</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-emerald-700">{totalHechas}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Hospitales faltantes</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-red-700">{totalBase - totalHechas}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Coordinaciones en base</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-teal-800">{totalCoordsBase}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Coordinadores que contestaron</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-emerald-700">{totalCoordsBase - totalCoordsFaltan}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">Coordinadores faltantes</CardTitle></CardHeader>
                <CardContent className="pt-0 text-3xl font-bold text-red-700">{totalCoordsFaltan}</CardContent>
              </Card>
            </div>

            <div className="mb-6">
              <div className="h-3 w-full overflow-hidden rounded bg-slate-200">
                <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pctGlobal}%` }} />
              </div>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base text-teal-900">Avance por entidad</CardTitle>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={vistaResumen === "hospitales" ? "font-semibold text-teal-800" : "text-slate-400"}>
                      Hospitales
                    </span>
                    <Switch
                      checked={vistaResumen === "coordinaciones"}
                      onCheckedChange={(v) => setVistaResumen(v ? "coordinaciones" : "hospitales")}
                      aria-label="Ver coordinaciones u hospitales"
                    />
                    <span className={vistaResumen === "coordinaciones" ? "font-semibold text-teal-800" : "text-slate-400"}>
                      Coordinaciones
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Entidad</TableHead>
                        <TableHead className="text-center">
                          {vistaResumen === "hospitales" ? "Hospitales" : "Coordinaciones"}
                        </TableHead>
                        <TableHead className="text-center">Ya contestaron</TableHead>
                        <TableHead className="text-center">Faltan</TableHead>
                        <TableHead className="w-56">Avance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(vistaResumen === "hospitales" ? resumen : coordResumen)]
                        .sort((a, b) => b.pct - a.pct || a.entidad.localeCompare(b.entidad))
                        .map((r) => (
                        <TableRow
                          key={r.cve}
                          className={`cursor-pointer ${entidadSel === r.entidad ? "bg-teal-50" : ""}`}
                          onClick={() => setEntidadSel(entidadSel === r.entidad ? "todas" : r.entidad)}
                        >
                          <TableCell className="font-medium">{r.entidad}</TableCell>
                          <TableCell className="text-center">{r.total}</TableCell>
                          <TableCell className="text-center text-emerald-700">{r.contestaron}</TableCell>
                          <TableCell className="text-center text-red-700">{r.faltan}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-2.5 flex-1 overflow-hidden rounded bg-slate-100">
                                <div className="h-full bg-emerald-600" style={{ width: `${r.pct}%` }} />
                              </div>
                              <span className="w-10 text-right text-xs text-slate-600">{r.pct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Select value={entidadSel} onValueChange={setEntidadSel}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Entidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las entidades</SelectItem>
                  {entidades.map((e) => (
                    <SelectItem key={e.cve} value={e.nombre}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Buscar hospital o CLUES..." value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
            </div>

            <Tabs defaultValue="hospitales" className="mb-6">
              <TabsList className="mb-4">
                <TabsTrigger value="hospitales">Hospitales (directores)</TabsTrigger>
                <TabsTrigger value="coordinadores">Coordinadores ({filtrados.regionales.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="coordinadores">
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                        <CheckCircle2 className="h-5 w-5" /> Ya contestaron ({filtrados.regionales.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                              <TableHead>Entidad</TableHead>
                              <TableHead>Región (coordinación)</TableHead>
                              <TableHead>Fecha</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtrados.regionales.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-medium">{r.entidad}</TableCell>
                                <TableCell className="text-xs">{r.region}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">{r.fecha}</TableCell>
                              </TableRow>
                            ))}
                            {filtrados.regionales.length === 0 && (
                              <TableRow><TableCell colSpan={3} className="text-center text-slate-400">Ninguno con estos filtros</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base text-red-800">
                        <XCircle className="h-5 w-5" /> Faltan por responder ({filtrados.regionalesFaltan.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-white">
                            <TableRow>
                              <TableHead>Entidad</TableHead>
                              <TableHead>Región (coordinación)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filtrados.regionalesFaltan.map((r, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-medium">{r.entidad}</TableCell>
                                <TableCell className="text-xs">{r.region}</TableCell>
                              </TableRow>
                            ))}
                            {filtrados.regionalesFaltan.length === 0 && (
                              <TableRow><TableCell colSpan={2} className="text-center text-slate-400">Todas las coordinaciones de este filtro ya contestaron</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="hospitales">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" /> Ya contestaron ({filtrados.contestaron.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white">
                        <TableRow>
                          <TableHead>CLUES</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtrados.contestaron.map((h) => (
                          <TableRow key={h.clues}>
                            <TableCell className="whitespace-nowrap text-xs">{h.clues}</TableCell>
                            <TableCell className="max-w-[220px]">
                              <p className="truncate text-xs font-medium" title={h.nombre}>{h.nombre}</p>
                              <Badge variant="outline" className="mt-0.5 text-[10px]">{h.categoria}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs">{h.fecha}</TableCell>
                          </TableRow>
                        ))}
                        {filtrados.contestaron.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-slate-400">Ninguno con estos filtros</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base text-red-800">
                    <XCircle className="h-5 w-5" /> Faltan por responder ({filtrados.faltan.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-white">
                        <TableRow>
                          <TableHead>CLUES</TableHead>
                          <TableHead>Hospital</TableHead>
                          <TableHead>Categoría</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtrados.faltan.map((h) => (
                          <TableRow key={h.clues}>
                            <TableCell className="whitespace-nowrap text-xs">{h.clues}</TableCell>
                            <TableCell className="max-w-[220px]">
                              <p className="truncate text-xs font-medium" title={h.nombre}>{h.nombre}</p>
                              {h.region && <p className="text-[10px] text-slate-400">Región {h.region}</p>}
                            </TableCell>
                            <TableCell className="text-xs">{h.categoria}</TableCell>
                          </TableRow>
                        ))}
                        {filtrados.faltan.length === 0 && (
                          <TableRow><TableCell colSpan={3} className="text-center text-slate-400">Ninguno con estos filtros</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}
