import { useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Field } from "@/lib/questions";

export type Values = Record<string, unknown>;

// Fisher-Yates determinista por pregunta (para no re-render distinto)
function shuffled<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  field: Field;
  values: Values;
  onChange: (id: string, value: unknown) => void;
  error?: string;
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p
      data-error
      role="alert"
      className="flex items-start gap-2 rounded-md border-2 border-red-400 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 shadow-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function FieldRenderer({ field, values, onChange, error }: Props) {
  switch (field.type) {
    case "radio":
      return <RadioInput field={field} values={values} onChange={onChange} error={error} />;
    case "number":
      return <NumberInput field={field} values={values} onChange={onChange} error={error} />;
    case "text":
      return <TextInput field={field} values={values} onChange={onChange} error={error} />;
    case "scaleMatrix":
      return <ScaleMatrix field={field} values={values} onChange={onChange} error={error} />;
    case "multiMax":
      return <MultiMax field={field} values={values} onChange={onChange} error={error} />;
    case "numberMatrix":
      return <NumberMatrix field={field} values={values} onChange={onChange} error={error} />;
  }
}

// ─── Radio ───
function RadioInput({ field, values, onChange, error }: Props) {
  const opts = useMemo(
    () => (field.type === "radio" && field.shuffle ? shuffled(field.options, field.id) : field.type === "radio" ? field.options : []),
    [field]
  );
  if (field.type !== "radio") return null;
  const val = (values[field.id] as string) ?? "";
  const specFor = field.withSpecify ?? [];
  const showSpec = specFor.includes(val);
  return (
    <div className="space-y-2">
      <RadioGroup
        value={val}
        onValueChange={(v) => onChange(field.id, v)}
        className="gap-1.5"
      >
        {opts.map((o) => (
          <div key={o} className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-teal-50/60">
            <RadioGroupItem value={o} id={`${field.id}-${o}`} className="border-teal-600 text-teal-700" />
            <Label htmlFor={`${field.id}-${o}`} className="cursor-pointer text-sm font-normal leading-snug">
              {o}
            </Label>
          </div>
        ))}
      </RadioGroup>
      {showSpec && (
        <div className="ml-6 mt-1">
          <Input
            placeholder="Especifique"
            value={(values[`${field.id}__spec`] as string) ?? ""}
            onChange={(e) => onChange(`${field.id}__spec`, e.target.value)}
            className="max-w-xs"
          />
        </div>
      )}
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Número ───
export const NO_DATA = "__NO_DATA__";

function NumberInput({ field, values, onChange, error }: Props) {
  if (field.type !== "number") return null;
  const raw = values[field.id];
  const isNoData = raw === NO_DATA;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="number"
          inputMode="numeric"
          min={field.min}
          max={field.max}
          disabled={isNoData}
          value={typeof raw === "string" && raw !== NO_DATA ? raw : ""}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder="Escriba un número"
          className="max-w-[200px]"
        />
        {field.noDataLabel && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox
              checked={isNoData}
              onCheckedChange={(c) => onChange(field.id, c ? NO_DATA : "")}
              className="border-teal-600 data-[state=checked]:bg-teal-600"
            />
            {field.noDataLabel}
          </label>
        )}
      </div>
      {field.min !== undefined && field.max !== undefined && (
        <p className="text-xs text-slate-500">Entre {field.min} y {field.max}</p>
      )}
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Texto ───
function TextInput({ field, values, onChange, error }: Props) {
  if (field.type !== "text") return null;
  const val = (values[field.id] as string) ?? "";
  return (
    <div className="space-y-2">
      <Textarea
        value={val}
        onChange={(e) => onChange(field.id, e.target.value.slice(0, field.maxLength))}
        maxLength={field.maxLength}
        rows={field.rows ?? 3}
        placeholder="Escriba su respuesta"
        className="max-w-xl"
      />
      <p className="text-xs text-slate-500">{val.length}/{field.maxLength} caracteres</p>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Matriz de escala (radio por renglón) ───
function ScaleMatrix({ field, values, onChange, error }: Props) {
  const rows = useMemo(
    () => (field.type === "scaleMatrix" && field.shuffleRows ? shuffled(field.rows, field.id) : field.type === "scaleMatrix" ? field.rows : []),
    [field]
  );
  if (field.type !== "scaleMatrix") return null;
  const matrix = (values[field.id] as Record<string, string>) ?? {};
  const short = field.options;
  const defIdx = field.defaultValue !== undefined ? field.options.indexOf(field.defaultValue) : -1;
  const eff = (row: string) => matrix[row] ?? field.defaultValue;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="bg-teal-700 text-white">
              <th className="p-2.5 text-left font-medium w-[40%]">Aspecto</th>
              {short.map((o, oi) => (
                <th
                  key={o}
                  className={`p-2.5 text-center font-medium text-xs leading-tight ${
                    oi === defIdx ? "bg-green-700" : ""
                  }`}
                >
                  {o}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                <td className="p-2.5 align-middle text-xs leading-snug">{row}</td>
                {field.options.map((o, oi) => (
                  <td
                    key={o}
                    className={`p-1 text-center ${oi === defIdx ? "bg-green-50" : ""}`}
                  >
                    <input
                      type="radio"
                      name={`${field.id}-${row}`}
                      checked={eff(row) === o}
                      onChange={() => onChange(field.id, { ...matrix, [row]: o })}
                      className={`h-4 w-4 ${oi === defIdx ? "accent-green-700" : "accent-teal-700"}`}
                      aria-label={`${row}: ${o}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Selección múltiple con tope ───
function MultiMax({ field, values, onChange, error }: Props) {
  if (field.type !== "multiMax") return null;
  const sel = (values[field.id] as string[]) ?? [];
  const noneOpt = field.noneOption;
  const extraOpt = field.extraOption;
  const exclusive = [noneOpt, extraOpt].filter(Boolean) as string[];
  const toggle = (opt: string) => {
    let next: string[];
    if (sel.includes(opt)) {
      next = sel.filter((s) => s !== opt);
    } else if (exclusive.includes(opt)) {
      next = [opt];
    } else {
      next = [...sel.filter((s) => !exclusive.includes(s)), opt].slice(0, field.max);
    }
    onChange(field.id, next);
  };
  const otherSel = sel.includes("Otro (especifique)");
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-teal-800">
        {sel.some((s) => exclusive.includes(s)) ? "Opción única seleccionada" : `${sel.length}/${field.max} seleccionadas`}
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {field.options.map((o) => (
          <label key={o} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-teal-50/60">
            <Checkbox
              checked={sel.includes(o)}
              onCheckedChange={() => toggle(o)}
              className="mt-0.5 border-teal-600 data-[state=checked]:bg-teal-600"
            />
            <span className="text-sm font-normal leading-snug">{o}</span>
          </label>
        ))}
        {noneOpt && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-teal-50/60">
            <Checkbox
              checked={sel.includes(noneOpt)}
              onCheckedChange={() => toggle(noneOpt)}
              className="mt-0.5 border-teal-600 data-[state=checked]:bg-teal-600"
            />
            <span className="text-sm font-normal leading-snug">{noneOpt}</span>
          </label>
        )}
        {extraOpt && (
          <>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:bg-teal-50/60">
              <Checkbox
                checked={sel.includes(extraOpt)}
                onCheckedChange={() => toggle(extraOpt)}
                className="mt-0.5 border-teal-600 data-[state=checked]:bg-teal-600"
              />
              <span className="text-sm font-normal leading-snug">{extraOpt}</span>
            </label>
            {otherSel && (
              <Input
                placeholder="Especifique"
                value={(values[`${field.id}__spec`] as string) ?? ""}
                onChange={(e) => onChange(`${field.id}__spec`, e.target.value)}
                className="max-w-xs sm:col-span-2"
              />
            )}
          </>
        )}
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}

// ─── Matriz numérica ───
function NumberMatrix({ field, values, onChange, error }: Props) {
  if (field.type !== "numberMatrix") return null;
  const matrix = (values[field.id] as Record<string, string>) ?? {};
  const set = (row: string, v: string) => onChange(field.id, { ...matrix, [row]: v });
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {field.rows.map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <Label className="text-xs font-normal leading-snug">{row}</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={matrix[row] ?? ""}
              onChange={(e) => set(row, e.target.value)}
              className="h-8 w-24 text-right"
              aria-label={row}
            />
          </div>
        ))}
        {field.otherRow && (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 sm:col-span-2">
            <Input
              placeholder="Otro (especifique el tipo de personal)"
              value={(values[`${field.id}__otro_label`] as string) ?? ""}
              onChange={(e) => onChange(`${field.id}__otro_label`, e.target.value)}
              className="h-8 flex-1 text-xs"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={(values[`${field.id}__otro_value`] as string) ?? ""}
              onChange={(e) => onChange(`${field.id}__otro_value`, e.target.value)}
              className="h-8 w-24 text-right"
              aria-label="Otro: cantidad"
            />
          </div>
        )}
      </div>
      {error && <ErrorBanner message={error} />}
    </div>
  );
}
