import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { FieldRenderer, ErrorBanner, type Values, NO_DATA } from "@/components/survey/Fields";
import { getSections, type Field, type Perfil } from "@/lib/questions";
import { CONFIG } from "@/lib/config";
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
    municipio: string;
    categoria: string;
    cveRegion: number | null;
    region: string | null;
  }[];
};

// ─── Validación ───
function validateField(field: Field, values: Values): string | undefined {
  // lógica condicional
  if (field.visibleIf && !field.visibleIf(values)) return undefined;
  if (field.id === "d1_monto" && values.d1 !== "Sí") return undefined;
  // E5 ligada a E4: la suma de especialidades debe igualar "Médicos especialistas" de E4
  if (field.id === "e5") {
    const esp = Number((values.e4 as Record<string, string> | undefined)?.["Médicos especialistas"] || 0);
    const m = (values.e5 as Record<string, string>) ?? {};
    const sum =
      Object.values(m).reduce((acc, x) => acc + (Number(x) || 0), 0) +
      (Number(values.e5__otro_value) || 0);
    if (esp === 0) return undefined; // sin especialistas requeridos en E4, E5 queda opcional
    if (sum === 0) return `En E4 indicó ${esp} médicos especialistas; indique las especialidades y cantidades.`;
    if (sum !== esp)
      return `La suma de especialidades (${sum}) debe ser igual a los médicos especialistas indicados en E4 (${esp}).`;
    return undefined;
  }
  // E2 + E3 ligada a E1: la suma puede ser igual o menor a la plantilla total
  if (field.id === "e2" || field.id === "e3") {
    const parse = (x: unknown) =>
      x === undefined || x === "" || x === NO_DATA ? null : Number(x);
    const e1v = parse(values.e1);
    const e2v = parse(values.e2);
    const e3v = parse(values.e3);
    if (e1v !== null && e2v !== null && e3v !== null && e2v + e3v > e1v) {
      return `E2 + E3 (${e2v} + ${e3v} = ${e2v + e3v}) no puede ser mayor que E1, la plantilla total (${e1v}). Puede ser igual o menor.`;
    }
    return undefined;
  }
  if (field.id === "f7") {
    if (values.f6 === "0" || values.f6 === 0 || values.f6 === "") return undefined;
  }
  const v = values[field.id];
  switch (field.type) {
    case "radio":
      if (!field.optional && (v === undefined || v === "")) return "Seleccione una opción.";
      return undefined;
    case "number": {
      if (v === undefined || v === "") return field.optional ? undefined : "Escriba un número o marque la casilla.";
      if (v === NO_DATA) return undefined;
      const n = Number(v);
      if (isNaN(n)) return "Escriba un número válido.";
      if (field.min !== undefined && n < field.min) return `El valor mínimo es ${field.min}.`;
      if (field.max !== undefined && n > field.max) return `El valor máximo es ${field.max}.`;
      return undefined;
    }
    case "text":
      if (!field.optional && !(v as string)?.trim()) return "Escriba su respuesta.";
      return undefined;
    case "scaleMatrix": {
      const m = (v as Record<string, string>) ?? {};
      const missing = field.rows.filter((r) => !(m[r] ?? field.defaultValue)).length;
      return missing > 0 ? `Faltan ${missing} renglones por responder.` : undefined;
    }
    case "multiMax":
      if (!field.optional && (!v || (v as string[]).length === 0)) return "Seleccione al menos una opción.";
      return undefined;
    case "numberMatrix":
      return undefined; // se permite dejarla en blanco (= ninguno)
  }
}

// ─── Selector con buscador ───
function SearchableSelect({
  options,
  value,
  onSelect,
  placeholder,
}: {
  options: { key: string; label: string; sub?: string }[];
  value: string | null;
  onSelect: (key: string) => void;
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const selected = options.find((o) => o.key === value);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = t
      ? options.filter((o) => o.label.toLowerCase().includes(t) || o.sub?.toLowerCase().includes(t))
      : options;
    return base.slice(0, 60);
  }, [q, options]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-teal-300 bg-teal-50 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-teal-900">{selected.label}</p>
          {selected.sub && <p className="text-xs text-teal-700">{selected.sub}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={() => onSelect("")}>Cambiar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      <div className="max-h-64 overflow-y-auto rounded-lg border">
        {filtered.length === 0 && <p className="p-3 text-sm text-slate-500">Sin resultados</p>}
        {filtered.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-teal-50"
          >
            <p className="text-sm">{o.label}</p>
            {o.sub && <p className="text-xs text-slate-500">{o.sub}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Portada de bienvenida ───
function Welcome({ perfil, onStart }: { perfil: Perfil; onStart: () => void }) {
  const esDirector = perfil === "director";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg text-teal-900">
          {esDirector
            ? "Cuestionario para directivos hospitalarios · IMSS Bienestar"
            : "Cuestionario para coordinadores regionales · IMSS Bienestar"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm leading-relaxed text-slate-700">
        <p>
          {esDirector
            ? "Estimada directora, estimado director:"
            : "Estimada coordinadora, estimado coordinador:"}{" "}
          queremos conocer su opinión sobre la situación de{" "}
          {esDirector ? "su hospital" : "los hospitales de su región"} antes y después de la
          incorporación a IMSS Bienestar
          {CONFIG.eventDate ? (
            <>. Los resultados se presentarán en la reunión del {CONFIG.eventDate}.</>
          ) : (
            <>.</>
          )}
        </p>
        <p>
          Responder le tomará entre 9 y 10 minutos. Sus respuestas son confidenciales: solo se
          presentarán resultados agregados, sin identificar personas ni hospitales.{" "}
          {esDirector
            ? "El hospital se registra solo para clasificar los resultados por tipo de hospital y región, y las respuestas no se usarán para evaluar el desempeño de nadie. "
            : "La región se registra solo para clasificar los resultados, y las respuestas no se usarán para evaluar el desempeño de nadie. "}
          Le pedimos responder con franqueza; no hay respuestas correctas o incorrectas.
        </p>
        {CONFIG.deadline && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            <strong>Fecha límite:</strong> {CONFIG.deadline}.
          </p>
        )}
        {CONFIG.contact && (
          <p>
            <strong>Dudas:</strong> {CONFIG.contact}.
          </p>
        )}
        {CONFIG.privacyUrl && (
          <p>
            <strong>Aviso de privacidad:</strong>{" "}
            <a href={CONFIG.privacyUrl} target="_blank" rel="noreferrer" className="text-teal-700 underline">
              consulte el aviso de privacidad integral
            </a>
            .
          </p>
        )}
        <Button onClick={onStart} className="w-full bg-teal-700 hover:bg-teal-800">
          Comenzar <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Página del cuestionario ───
export default function Survey() {
  const [params] = useSearchParams();
  const perfilParam = params.get("perfil") === "regional" ? "regional" : "director";
  const esPrueba = params.get("prueba") === "1";
  const [perfil, setPerfil] = useState<Perfil>(perfilParam);
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [cveEntidad, setCveEntidad] = useState<number | null>(null);
  const [unitKey, setUnitKey] = useState<string>("");
  const [identError, setIdentError] = useState("");
  const [done, setDone] = useState(false);

  const sections = getSections(perfil);
  const totalSteps = sections.length + 1; // + identificación
  const isRegional = perfil === "regional";

  // Preseleccionar valores por omisión al entrar a una sección (p.ej. C4 "Opera con normalidad")
  useEffect(() => {
    if (!started || step === 0) return;
    const section = sections[step - 1];
    setValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const f of section.fields) {
        if (f.type === "scaleMatrix" && f.defaultValue && next[f.id] === undefined) {
          next[f.id] = Object.fromEntries(f.rows.map((r) => [r, f.defaultValue]));
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [started, step, sections]);

  const regionOpts = useMemo(() => {
    const r = regiones.find((x) => x.cveEntidad === cveEntidad);
    return (r?.regiones ?? []).map((x) => ({ key: String(x.cve), label: x.nombre }));
  }, [cveEntidad]);

  const hospitalOpts = useMemo(() => {
    if (!cveEntidad) return [];
    return hospitales
      .filter((h) => h.cveEntidad === cveEntidad)
      .map((h) => ({
        key: h.clues,
        label: h.nombre,
        sub: `${h.clues} · ${h.categoria} · ${h.municipio}${h.region ? ` · Región ${h.region}` : ""}`,
        raw: h,
      }));
  }, [cveEntidad]);

  const selectedHospital = hospitales.find((h) => h.clues === unitKey);
  const selectedRegion = regiones.find((r) => r.cveEntidad === cveEntidad)?.regiones.find((r) => String(r.cve) === unitKey);

  const setValue = (id: string, v: unknown) => {
    setValues((prev) => {
      const next = { ...prev, [id]: v };
      // salto lógico G1 = 0: limpiar G2–G6
      if (id === "amb1" && Number(v) === 0) {
        delete next.amb2;
        delete next.amb3;
        delete next.amb3__spec;
        delete next.amb4;
        delete next.amb5;
        delete next.amb6;
      }
      return next;
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const submit = trpc.survey.submit.useMutation({
    onSuccess: () => setDone(true),
    onError: (e) => setIdentError(`No se pudo guardar la respuesta: ${e.message}. Intente de nuevo.`),
  });

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!cveEntidad) {
        setIdentError("Seleccione la entidad.");
        return false;
      }
      if (!unitKey) {
        setIdentError(isRegional ? "Seleccione su región." : "Seleccione su hospital.");
        return false;
      }
      setIdentError("");
      return true;
    }
    const section = sections[step - 1];
    const errs: Record<string, string> = {};
    for (const f of section.fields) {
      if (f.visibleIf && !f.visibleIf(values)) continue;
      const e = validateField(f, values);
      if (e) errs[f.id] = e;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setTimeout(
        () =>
          document
            .querySelector("[data-error]")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        60
      );
    }
    return Object.keys(errs).length === 0;
  };

  const next = () => {
    if (!validateStep()) return;
    window.scrollTo({ top: 0 });
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  };
  const prev = () => {
    window.scrollTo({ top: 0 });
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = () => {
    if (!validateStep()) return;
    const entidad = entidades.find((e) => e.cve === cveEntidad);
    // diferencia de plantilla E1 - (E2 + E3), solo directores con los tres datos
    const num = (x: unknown) =>
      x === undefined || x === "" || x === NO_DATA ? null : Number(x);
    const e1n = num(values.e1);
    const e2n = num(values.e2);
    const e3n = num(values.e3);
    const eDiferencia =
      isRegional || e1n === null || e2n === null || e3n === null ? undefined : e1n - (e2n + e3n);
    submit.mutate({
      perfil,
      cveEntidad: cveEntidad!,
      entidad: entidad?.nombre ?? "",
      clues: !isRegional && selectedHospital ? selectedHospital.clues : undefined,
      hospital: !isRegional && selectedHospital ? selectedHospital.nombre : undefined,
      categoria: !isRegional && selectedHospital ? selectedHospital.categoria : undefined,
      cveRegion: isRegional && selectedRegion ? selectedRegion.cve : selectedHospital?.cveRegion ?? undefined,
      region: isRegional && selectedRegion ? selectedRegion.nombre : selectedHospital?.region ?? undefined,
      esPrueba,
      eDiferencia,
      payload: values,
    });
  };

  const switchPerfil = (p: Perfil) => {
    setPerfil(p);
    setStarted(false);
    setStep(0);
    setUnitKey("");
    setValues({});
    setErrors({});
    setIdentError("");
  };

  if (done) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="mb-4 h-16 w-16 text-teal-600" />
        <h1 className="mb-2 text-2xl font-bold text-teal-900">Gracias</h1>
        <p className="text-slate-600">Sus respuestas quedaron registradas.</p>
        {CONFIG.eventDate && (
          <p className="mt-1 text-slate-600">Los resultados se presentarán el {CONFIG.eventDate}.</p>
        )}
      </div>
    );
  }

  const progress = ((started ? step + 1 : 0) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-slate-50 pb-16">
      <header className="border-b border-teal-100 bg-white">
        {esPrueba && (
          <div className="bg-amber-400 px-4 py-2 text-center text-sm font-bold text-amber-950">
            ⚠ MODO PRUEBA — esta respuesta se guarda como prueba y no cuenta en los resultados
          </div>
        )}
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-sm text-teal-700 hover:underline">← Inicio</Link>
          <div className="flex items-center gap-2">
            {(["director", "regional"] as Perfil[]).map((p) => (
              <button
                key={p}
                onClick={() => switchPerfil(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  perfil === p ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p === "director" ? "Director de hospital" : "Coordinador regional"}
              </button>
            ))}
          </div>
        </div>
        {started && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <Progress value={progress} className="h-2 [&>div]:bg-teal-600" />
            <p className="mt-1 text-xs text-slate-500">Paso {step + 1} de {totalSteps}</p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pt-6">
        {!started ? (
          <Welcome perfil={perfil} onStart={() => { setStarted(true); window.scrollTo({ top: 0 }); }} />
        ) : step === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-teal-900">
                {isRegional ? "A1. Seleccione su región" : "A0/A2. Entidad y hospital"}
              </CardTitle>
              <CardDescription>
                {isRegional
                  ? "Seleccione primero la entidad y después la región que coordina."
                  : "Seleccione primero la entidad y después su hospital de la lista (nombre y CLUES). La categoría gerencial y la región se asignan automáticamente."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Entidad</Label>
                <SearchableSelect
                  options={entidades.map((e) => ({ key: String(e.cve), label: e.nombre }))}
                  value={cveEntidad ? String(cveEntidad) : null}
                  onSelect={(k) => {
                    setCveEntidad(k ? Number(k) : null);
                    setUnitKey("");
                    setIdentError("");
                  }}
                  placeholder="Buscar entidad..."
                />
              </div>
              {cveEntidad && (
                <div className="space-y-1.5">
                  <Label>{isRegional ? "Región" : "Hospital"}</Label>
                  <SearchableSelect
                    options={isRegional ? regionOpts : hospitalOpts}
                    value={unitKey || null}
                    onSelect={(k) => {
                      setUnitKey(k);
                      setIdentError("");
                    }}
                    placeholder={isRegional ? "Buscar región..." : "Buscar hospital por nombre o CLUES..."}
                  />
                </div>
              )}
              {selectedHospital && (
                <p className="rounded-lg bg-teal-50 px-3 py-2 text-xs text-teal-800">
                  Categoría gerencial: <strong>{selectedHospital.categoria}</strong>
                  {selectedHospital.region && <> · Región: <strong>{selectedHospital.region}</strong></>}
                </p>
              )}
              {identError && <ErrorBanner message={identError} />}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-teal-900">{sections[step - 1].label}</CardTitle>
              {sections[step - 1].intro && <CardDescription>{sections[step - 1].intro}</CardDescription>}
            </CardHeader>
            <CardContent className="space-y-8">
              {sections[step - 1].fields
                .filter((f) => !f.visibleIf || f.visibleIf(values))
                .map((f) => (
                  <div key={f.id} className="space-y-2 border-b border-slate-100 pb-6 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-slate-800">{f.title}</p>
                    {f.help && <p className="text-xs text-slate-500">{f.help}</p>}
                    {f.clarification && (
                      <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {f.clarification}
                      </p>
                    )}
                    <FieldRenderer field={f} values={values} onChange={setValue} error={errors[f.id]} />
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-between">
          {started ? (
            <>
              <Button variant="outline" onClick={prev} disabled={step === 0}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
              </Button>
              {step < totalSteps - 1 ? (
                <Button onClick={next} className="bg-teal-700 hover:bg-teal-800">
                  Siguiente <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submit.isPending} className="bg-teal-700 hover:bg-teal-800">
                  {submit.isPending ? "Enviando..." : "Enviar respuestas"}
                </Button>
              )}
            </>
          ) : (
            <Link to="/" className="text-sm text-teal-700 hover:underline">← Volver al inicio</Link>
          )}
        </div>
        {submit.isError && (
          <div className="mt-3">
            <ErrorBanner message="Ocurrió un error al enviar. Intente de nuevo." />
          </div>
        )}
      </main>
    </div>
  );
}
