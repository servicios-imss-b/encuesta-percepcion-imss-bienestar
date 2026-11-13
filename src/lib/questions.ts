// Definición estructurada de los cuestionarios (Directores y Coordinadores regionales)
// Fuente: Cuestionario_Directores_09102026.pdf y Cuestionario de regionales.pdf

export type Values = Record<string, unknown>;

export type Field =
  | RadioField
  | NumberField
  | TextField
  | ScaleMatrixField
  | MultiMaxField
  | NumberMatrixField;

interface Base {
  id: string;
  title: string;
  help?: string;
  clarification?: string; // nota visible de definición pendiente
  optional?: boolean;
  visibleIf?: (values: Values) => boolean; // lógica de salto (p.ej. G1 = 0)
}

export interface RadioField extends Base {
  type: "radio";
  options: string[];
  withSpecify?: string[]; // opciones que abren campo "Especifique"
  shuffle?: boolean;
}

export interface NumberField extends Base {
  type: "number";
  min?: number;
  max?: number;
  noDataLabel?: string; // p.ej. "No tengo el dato"
}

export interface TextField extends Base {
  type: "text";
  maxLength: number;
  rows?: number;
}

export interface ScaleMatrixField extends Base {
  type: "scaleMatrix";
  rows: string[];
  options: string[];
  shuffleRows?: boolean;
  defaultValue?: string; // opción preseleccionada por renglón (p.ej. "Opera con normalidad")
}

export interface MultiMaxField extends Base {
  type: "multiMax";
  options: string[];
  max: number;
  noneOption?: string; // opción excluyente (p.ej. "Ninguno")
  extraOption?: string; // p.ej. "Otra (especifique)" (también excluyente)
}

export interface NumberMatrixField extends Base {
  type: "numberMatrix";
  rows: string[];
  otherRow?: boolean; // permite "Otro (especifique)"
}

export interface Section {
  key: string;
  label: string;
  intro?: string;
  fields: Field[];
}

// ─── Los 14 aspectos (C1, C2 y C3, idénticos en ambos cuestionarios) ───
export const AREAS = [
  "Abasto de medicamentos conforme al CPM institucional",
  "Abasto de material de curación conforme al CPM institucional",
  "Suficiencia de médicos especialistas adicional",
  "Suficiencia de personal de enfermería adicional",
  "Suficiencia de personal paramédico adicional",
  "Equipo médico en funcionamiento",
  "Conservación y mantenimiento del inmueble",
  "Servicios generales (limpieza, lavandería, alimentación, vigilancia)",
  "Instalaciones electromecánicas en funcionamiento (elevadores, aire acondicionado, calderas, planta de emergencia)",
  "Recursos para gastos de operación",
  "Trámites administrativos (compras, contratación y pagos)",
  "Referencia y contrarreferencia de pacientes",
  "Sistemas informáticos y conectividad",
  "El Modelo médico de gestión",
];

const ESCALA_COMPARACION = ["Mejoró", "Se mantuvo igual", "Empeoró", "No me consta"];
const FORMACION = [
  "Médico general, sin especialidad",
  "Medicina familiar",
  "Medicina interna",
  "Cirugía general",
  "Ginecología y obstetricia",
  "Pediatría",
  "Anestesiología",
  "Urgencias médicas",
  "Salud pública o epidemiología",
  "Otra especialidad médica",
  "Profesión no médica",
];
const TIEMPO_CARGO = [
  "Menos de 6 meses",
  "De 6 meses a menos de 1 año",
  "De 1 a menos de 3 años",
  "De 3 a menos de 6 años",
  "6 años o más",
];
const SEXO = ["Mujer", "Hombre", "Prefiero no responder"];

// Áreas para C4 (con temporalidad por renglón)
const AREAS_C4 = [
  "Quirófanos",
  "Urgencias",
  "Hospitalización (camas fuera de servicio)",
  "Terapia intensiva o cuidados intermedios",
  "Laboratorio o imagenología",
  "Consulta de especialidades",
  "Otro",
];

const ESPECIALIDADES = [
  "Alergología e inmunología",
  "Anatomía patológica",
  "Anestesiología",
  "Cardiología",
  "Cirugía cardiotorácica / de tórax",
  "Cirugía de columna",
  "Cirugía general",
  "Cirugía maxilofacial",
  "Cirugía pediátrica",
  "Cirugía plástica y reconstructiva",
  "Cirugía vascular",
  "Colposcopía y patología de cuello uterino",
  "Dermatología",
  "Endocrinología",
  "Endocrinología pediátrica",
  "Gastroenterología",
  "Gastroenterología pediátrica",
  "Geriatría",
  "Ginecología y obstetricia",
  "Ginecología oncológica",
  "Hematología",
  "Hematología pediátrica",
  "Infectología",
  "Infectología pediátrica",
  "Medicina crítica",
  "Medicina de rehabilitación",
  "Medicina del deporte",
  "Medicina del trabajo",
  "Medicina familiar",
  "Medicina interna",
  "Medicina materno fetal",
  "Medicina nuclear",
  "Medicina preventiva y salud pública",
  "Nefrología",
  "Nefrología pediátrica",
  "Neonatología",
  "Neumología",
  "Neumología pediátrica",
  "Neurocirugía",
  "Neurología",
  "Neurología pediátrica",
  "Oftalmología",
  "Oncología",
  "Oncología pediátrica",
  "Ortopedia y traumatología",
  "Otorrinolaringología",
  "Patología clínica",
  "Pediatría",
  "Psiquiatría",
  "Psiquiatría pediátrica",
  "Radiología e imagen",
  "Reumatología",
  "Urgencias médicas",
  "Urología",
  "Uroginecología",
  "Otra (especifique)",
];

const TIPOS_PERSONAL_E4 = [
  "Médicos especialistas",
  "Médicos generales",
  "Enfermería de atención clínica",
  "Enfermería de especialidad",
  "Personal paramédico",
];

// ─── Lógica de salto de la Sección G (Traslado de pacientes) ───
const tieneAmbulancias = (v: Values) => Number(v.amb1) > 0;
const hayAmbulanciasRotas = (v: Values) => Number(v.amb1) > 0 && Number(v.amb2) < Number(v.amb1);

// ══════════════ CUESTIONARIO DIRECTOR ══════════════
export const DIRECTOR_SECTIONS: Section[] = [
  {
    key: "A",
    label: "Sección A. Perfil del informante",
    fields: [
      {
        id: "edad",
        type: "number",
        title: "A3. ¿Cuántos años cumplidos tiene?",
        help: "Número entero, de 25 a 80. La edad se captura exacta para validar, pero se reporta solo en rangos para no permitir identificar a la persona.",
        min: 25,
        max: 80,
      },
      { id: "sexo", type: "radio", title: "A4. Sexo", options: SEXO },
      {
        id: "formacion",
        type: "radio",
        title: "A5. ¿Cuál es su formación principal?",
        options: FORMACION,
        withSpecify: ["Otra especialidad médica", "Profesión no médica"],
      },
      {
        id: "posgrado",
        type: "radio",
        title: "A6. ¿Tiene estudios de posgrado en administración o gestión de servicios de salud?",
        options: ["Sí, concluidos", "Sí, en curso", "No"],
      },
      {
        id: "tiempo_cargo",
        type: "radio",
        title: "A7. ¿Cuánto tiempo lleva en su cargo actual, en este hospital?",
        options: TIEMPO_CARGO,
      },
      {
        id: "nombramiento",
        type: "radio",
        title: "A7a. ¿Cuál es su tipo de nombramiento en el cargo actual?",
        options: [
          "Plaza de director(a) (puesto de estructura o mando)",
          "Encargado(a) de despacho o comisionado(a), conservando mi plaza de origen",
          "Nombramiento temporal o interino",
          "Otro",
        ],
        withSpecify: ["Otro"],
      },
      {
        id: "plaza_institucion",
        type: "radio",
        title: "A7b. ¿Su plaza a qué institución pertenece?",
        options: ["IMSS-Bienestar", "Secretaría de Salud"],
      },
    ],
  },
  {
    key: "B",
    label: "Sección B. Situación general del hospital",
    fields: [
      {
        id: "b1",
        type: "radio",
        title: "B1. En general, ¿cómo calificaría la situación actual de su hospital?",
        options: ["Buena", "Regular", "Mala", "No sé"],
      },
      {
        id: "b2",
        type: "radio",
        title: "B2. Comparada con antes de que su hospital pasara a IMSS Bienestar (enero de 2024), la situación general de su hospital...",
        options: ["Mejoró", "Se mantuvo igual", "Empeoró", "No me consta"],
      },
      {
        id: "b3",
        type: "radio",
        title: "B3. En los próximos 12 meses, ¿espera que la situación general de su hospital...",
        options: ["Mejore", "Siga igual", "Empeore", "No sé"],
      },
    ],
  },
  {
    key: "C",
    label: "Sección C. Comparación por área",
    intro: "Compare cada aspecto con la situación antes de la incorporación a IMSS Bienestar (enero de 2024).",
    fields: [
      {
        id: "c1",
        type: "scaleMatrix",
        title: "C1. Compare cada aspecto de la situación de su hospital con antes de que pasara a IMSS Bienestar (enero de 2024).",
        help: "Una respuesta por renglón. El orden de los renglones se presenta de forma aleatoria.",
        rows: AREAS,
        options: ESCALA_COMPARACION,
        shuffleRows: true,
      },
      {
        id: "c2",
        type: "multiMax",
        title: "C2. Actualmente, ¿cuáles de estos aspectos son un problema grave en su hospital? (Seleccione solo 3)",
        options: AREAS,
        max: 3,
        noneOption: "Ninguno es un problema grave",
      },
      {
        id: "c3",
        type: "multiMax",
        title: "C3. Antes de que su hospital pasara a IMSS Bienestar (enero de 2024), ¿cuáles de estos aspectos eran un problema grave en su hospital? (Seleccione solo 3)",
        options: AREAS,
        max: 3,
        noneOption: "Ninguno era un problema grave",
        extraOption: "No me consta",
      },
      {
        id: "c4",
        type: "scaleMatrix",
        title: "C4. ¿Hay algún servicio o área de su hospital que hoy esté cerrado o funcionando de forma parcial?",
        help: "Por omisión todos los servicios aparecen como «Opera con normalidad»; solo cambie los que estén cerrados o funcionando de forma parcial.",
        rows: AREAS_C4,
        options: [
          "Opera con normalidad",
          "Desde antes de que su hospital pasara a IMSS Bienestar (enero de 2024)",
          "Desde después de enero de 2024",
          "No me consta",
          "No aplica",
        ],
        defaultValue: "Opera con normalidad",
      },
      {
        id: "c6",
        type: "radio",
        title: "C6. ¿Cómo describiría el almacén de su hospital para medicamentos e insumos?",
        options: [
          "Tiene espacio y condiciones suficientes",
          "Tiene espacio suficiente, pero condiciones inadecuadas (temperatura, humedad, seguridad o red fría)",
          "No tiene espacio suficiente",
          "No cuenta con almacén propio",
        ],
      },
    ],
  },
  {
    key: "D",
    label: "Sección D. Fondo rotatorio",
    fields: [
      {
        id: "d1",
        type: "radio",
        title: "D1. Antes de que su hospital pasara a IMSS Bienestar (enero de 2024), ¿contaba con recursos propios para gastos de operación (por ejemplo, fondo rotatorio o presupuesto asignado al hospital)?",
        options: ["Sí", "No", "No me consta"],
      },
      {
        id: "d1_monto",
        type: "number",
        title: "D1a. Si respondió «Sí», ¿de cuánto era aproximadamente al mes?",
        help: "Cantidad en pesos. Si no conoce el dato, active la casilla «No sé».",
        min: 0,
        noDataLabel: "No sé",
        optional: true,
      },
      {
        id: "d2",
        type: "radio",
        title: "D2. ¿Qué tan necesario considera contar con un fondo rotatorio para la operación de su hospital?",
        options: ["Muy necesario", "Algo necesario", "Poco necesario", "Nada necesario"],
      },
      {
        id: "d3",
        type: "radio",
        title: "D3. Antes de la incorporación a IMSS Bienestar, ¿su hospital tenía cajas de cobro de cuotas de recuperación?",
        options: ["Sí", "No", "No sé"],
      },
    ],
  },
  {
    key: "E",
    label: "Sección E. Plantilla de personal",
    fields: [
      {
        id: "e1",
        type: "number",
        title: "E1. Al día de hoy, ¿cuántas personas integran la plantilla total de su hospital?",
        help: "Incluya todo el personal (médico, de enfermería, paramédico, administrativo y de servicios) y todos los tipos de contratación.",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "e2",
        type: "number",
        title: "E2. Del total anterior, ¿cuántas personas son personal médico (médicos generales, especialistas y residentes)?",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "e3",
        type: "number",
        title: "E3. Del total, ¿cuántas personas se dedican a la atención al usuario y al trato digno (trabajo social, módulo de atención y orientación, gestor de calidad u otras áreas afines)?",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "e4",
        type: "numberMatrix",
        title: "E4. Para cada tipo de personal, ¿cuántas personas necesitaría contratar como mínimo indispensable en los próximos 3 meses?",
        rows: TIPOS_PERSONAL_E4,
      },
      {
        id: "e5",
        type: "numberMatrix",
        title: "E5. Si anotó médicos especialistas en la pregunta anterior, ¿de qué especialidades y cuántos?",
        help: "Indique la cantidad necesaria por especialidad. Si no anotó médicos especialistas en E4, puede dejar esta pregunta en blanco.",
        rows: ESPECIALIDADES,
        otherRow: true,
        optional: true,
      },
    ],
  },
  {
    key: "F",
    label: "Sección F. Equipo electromecánico",
    fields: [
      {
        id: "f1",
        type: "radio",
        title: "F1. ¿Qué tipo de aire acondicionado tiene su hospital?",
        options: [
          "Sistema integral que climatiza todo el hospital",
          "Solo equipos individuales en algunas áreas (minisplits, de ventana o tipo paquete)",
          "Ambos",
          "No cuenta con aire acondicionado",
        ],
      },
      {
        id: "f2",
        type: "radio",
        title: "F2. ¿Su hospital cuenta con chiller (enfriador de agua para el sistema central)?",
        options: ["Sí, funciona", "Sí, pero no funciona", "No cuenta con chiller"],
      },
      {
        id: "f3",
        type: "number",
        title: "F3. ¿Cuántos equipos de aire acondicionado individuales tiene instalados su hospital?",
        help: "Incluya minisplits, de ventana y tipo paquete. Escriba 0 si no tiene.",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "f4",
        type: "number",
        title: "F4. De ellos, ¿cuántos son minisplits?",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "f5",
        type: "number",
        title: "F5. De esos equipos individuales, ¿cuántos no funcionan hoy?",
        min: 0,
        noDataLabel: "No tengo el dato",
      },
      {
        id: "f6",
        type: "number",
        title: "F6. ¿Cuántos elevadores tiene su hospital?",
        help: "Escriba 0 si no tiene.",
        min: 0,
      },
      {
        id: "f7",
        type: "number",
        title: "F7. De ellos, ¿cuántos no funcionan hoy?",
        help: "Responda solo si su hospital cuenta con elevadores.",
        min: 0,
        optional: true,
      },
    ],
  },
  {
    key: "G",
    label: "Sección G. Traslado de pacientes",
    fields: [
      {
        id: "amb1",
        type: "number",
        title: "G1. ¿Cuántas ambulancias tiene asignadas su hospital?",
        help: "Si la respuesta es 0, se saltarán las preguntas G2 a G6.",
        min: 0,
      },
      {
        id: "amb2",
        type: "number",
        title: "G2. De ese total, ¿cuántas se encuentran actualmente en funcionamiento, es decir, en condiciones de dar servicio hoy?",
        min: 0,
        visibleIf: tieneAmbulancias,
      },
      {
        id: "amb3",
        type: "multiMax",
        title: "G3. De las ambulancias que no funcionan, ¿cuál es la causa principal? (Marque las que apliquen)",
        options: [
          "Falla mecánica",
          "Falta de equipo médico",
          "Falta de combustible o presupuesto de operación",
          "Falta de personal para operarla",
          "Siniestro o accidente",
        ],
        max: 99,
        extraOption: "Otra (especifique)",
        visibleIf: hayAmbulanciasRotas,
      },
      {
        id: "amb4",
        type: "multiMax",
        title: "G4. ¿Quién opera las ambulancias? (Marque según las que apliquen)",
        options: [
          "IMSS-Bienestar",
          "Gobierno estatal / Servicios Estatales de Salud",
          "Municipio",
        ],
        max: 3,
        visibleIf: tieneAmbulancias,
      },
      {
        id: "amb5",
        type: "multiMax",
        title: "G5. ¿Las ambulancias son propias o se prestan mediante un servicio? (Marque según las que apliquen)",
        options: [
          "Propias",
          "Servicio subrogado o contratado",
          "Prestadas o en comodato (por ejemplo, del municipio o de Cruz Roja)",
        ],
        max: 3,
        visibleIf: tieneAmbulancias,
      },
      {
        id: "amb6",
        type: "number",
        title: "G6. ¿Con cuántas personas cuenta para operar las ambulancias (operadores, paramédicos o técnicos en urgencias médicas)?",
        min: 0,
        visibleIf: tieneAmbulancias,
      },
      {
        id: "amb7",
        type: "multiMax",
        title: "G7. ¿Qué necesita su hospital en materia de ambulancias? (Marque 3 máximo)",
        options: [
          "Más unidades",
          "Reparación o mantenimiento",
          "Equipamiento médico",
          "Combustible o presupuesto de operación",
          "Personal operativo",
          "Capacitación",
        ],
        max: 3,
        noneOption: "No aplica",
        extraOption: "Otra (especifique)",
      },
      {
        id: "amb8",
        type: "text",
        title: "G8. Describa brevemente la principal necesidad o problema en el traslado de pacientes de su hospital:",
        maxLength: 300,
      },
    ],
  },
  {
    key: "V",
    label: "Valoración de IMSS Bienestar",
    fields: [
      {
        id: "v1",
        type: "text",
        title: "V1. En una frase, ¿qué aspecto de IMSS Bienestar considera más positivo para su hospital?",
        maxLength: 150,
      },
      {
        id: "v2",
        type: "text",
        title: "V2. En una frase, ¿qué aspecto de IMSS Bienestar considera que más necesita mejorar?",
        maxLength: 150,
      },
    ],
  },
  {
    key: "H",
    label: "Sección H. Cierre",
    fields: [
      {
        id: "h1",
        type: "text",
        title: "H1. Si pudiera pedir una sola acción al nivel central para mejorar su hospital en los próximos 6 meses, ¿cuál sería?",
        maxLength: 300,
        optional: true,
      },
    ],
  },
];

// ══════════════ CUESTIONARIO COORDINADOR REGIONAL ══════════════
export const REGIONAL_SECTIONS: Section[] = [
  {
    key: "A",
    label: "Sección A. Perfil del informante",
    fields: [
      {
        id: "edad",
        type: "number",
        title: "A2. ¿Cuántos años cumplidos tiene?",
        help: "Número entero, de 25 a 80. La edad se captura exacta para validar, pero se reporta solo en rangos para no permitir identificar a la persona.",
        min: 25,
        max: 80,
      },
      { id: "sexo", type: "radio", title: "A3. Sexo", options: SEXO },
      {
        id: "formacion",
        type: "radio",
        title: "A4. ¿Cuál es su formación principal?",
        options: FORMACION,
        withSpecify: ["Otra especialidad médica", "Profesión no médica"],
      },
      {
        id: "posgrado",
        type: "radio",
        title: "A5. ¿Tiene estudios de posgrado en administración o gestión de servicios de salud?",
        options: ["Sí, concluidos", "Sí, en curso", "No"],
      },
      {
        id: "tiempo_cargo",
        type: "radio",
        title: "A6. ¿Cuánto tiempo lleva como coordinador(a) de esta región?",
        options: TIEMPO_CARGO,
      },
      {
        id: "antes_region",
        type: "radio",
        title: "A7. Antes de la incorporación a IMSS Bienestar, ¿trabajaba en esta región?",
        options: ["Sí, en el mismo cargo", "Sí, en otro cargo", "No"],
      },
    ],
  },
  {
    key: "B",
    label: "Sección B. Situación general de la región",
    fields: [
      {
        id: "b1",
        type: "radio",
        title: "B1. En general, ¿cómo calificaría la situación actual de los hospitales de su región?",
        options: ["Buena", "Regular", "Mala", "No sé"],
      },
      {
        id: "b2",
        type: "radio",
        title: "B2. Comparada con antes de que los hospitales de su región pasaran a IMSS Bienestar (enero de 2024), la situación general de los hospitales de su región...",
        options: ["Mejoró", "Se mantuvo igual", "Empeoró", "No me consta"],
      },
      {
        id: "b3",
        type: "radio",
        title: "B3. En los próximos 12 meses, ¿espera que la situación de los hospitales de su región...",
        options: ["Mejore", "Siga igual", "Empeore", "No sé"],
      },
    ],
  },
  {
    key: "C",
    label: "Sección C. Comparación por área y problemas graves",
    intro: "Responda con base en los hospitales de su región.",
    fields: [
      {
        id: "c1",
        type: "scaleMatrix",
        title: "C1. Compare cada aspecto de la situación de los hospitales de su región con antes de que pasaran a IMSS Bienestar (enero de 2024).",
        help: "Una respuesta por renglón. El orden de los renglones se presenta de forma aleatoria.",
        rows: AREAS,
        options: ESCALA_COMPARACION,
        shuffleRows: true,
      },
      {
        id: "d1",
        type: "multiMax",
        title: "D1. Actualmente, ¿cuáles de estos aspectos son un problema grave en los hospitales de su región? (Seleccione solo 3)",
        options: AREAS,
        max: 3,
        extraOption: "Otro (especifique)",
      },
      {
        id: "d3",
        type: "multiMax",
        title: "D3. Antes de que los hospitales de su región pasaran a IMSS Bienestar (enero de 2024), ¿cuáles de estos aspectos eran un problema grave en la región? (Seleccione solo 3)",
        options: AREAS,
        max: 3,
        extraOption: "Otro (especifique)",
      },
    ],
  },
  {
    key: "V",
    label: "Valoración de IMSS Bienestar",
    fields: [
      {
        id: "v1",
        type: "text",
        title: "V1. En una frase, ¿qué aspecto de IMSS Bienestar considera más positivo para su región?",
        maxLength: 150,
      },
      {
        id: "v2",
        type: "text",
        title: "V2. En una frase, ¿qué aspecto de IMSS Bienestar considera que más necesita mejorar?",
        maxLength: 150,
      },
    ],
  },
  {
    key: "H",
    label: "Sección H. Cierre",
    fields: [
      {
        id: "h1",
        type: "text",
        title: "H1. Si pudiera pedir una sola acción al nivel central para mejorar su región en los próximos 6 meses, ¿cuál sería?",
        maxLength: 300,
        optional: true,
      },
    ],
  },
];

export type Perfil = "director" | "regional";

export function getSections(perfil: Perfil): Section[] {
  return perfil === "director" ? DIRECTOR_SECTIONS : REGIONAL_SECTIONS;
}
