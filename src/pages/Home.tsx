import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Hospital, MapPinned, ShieldCheck } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-700 via-teal-800 to-teal-900">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-10 text-center text-white">
          <p className="mb-1 text-sm font-medium uppercase tracking-widest text-teal-200">Censo electrónico · IMSS Bienestar</p>
          <h1 className="text-3xl font-bold sm:text-4xl">Encuesta a directivos hospitalarios y coordinadores regionales</h1>
          <p className="mx-auto mt-3 max-w-2xl text-teal-100">
            Queremos conocer su opinión sobre la situación de los hospitales antes y después de la
            incorporación a IMSS Bienestar (enero de 2024). Responder le tomará entre 9 y 10 minutos.
          </p>
          <p className="mx-auto mt-3 flex max-w-2xl items-start justify-center gap-2 text-sm text-teal-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Sus respuestas son confidenciales: solo se presentarán resultados agregados, sin identificar
            personas ni hospitales. No hay respuestas correctas o incorrectas; le pedimos responder con franqueza.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <Hospital className="mb-2 h-10 w-10 text-teal-700" />
              <CardTitle className="text-teal-900">Director(a) de hospital</CardTitle>
              <CardDescription>
                26 preguntas sobre la situación de su hospital: áreas de atención, fondo rotatorio,
                plantilla de personal, equipo electromecánico y valoración de IMSS Bienestar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/encuesta?perfil=director">
                <Button className="w-full bg-teal-700 hover:bg-teal-800">Iniciar cuestionario</Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader>
              <MapPinned className="mb-2 h-10 w-10 text-teal-700" />
              <CardTitle className="text-teal-900">Coordinador(a) regional</CardTitle>
              <CardDescription>
                Preguntas sobre la situación general de los hospitales de su región: comparación por área,
                problemas graves y valoración de IMSS Bienestar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/encuesta?perfil=regional">
                <Button className="w-full bg-teal-700 hover:bg-teal-800">Iniciar cuestionario</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-teal-300">
          Sus respuestas son confidenciales y se presentarán solo de forma agregada.
        </p>
      </div>
    </div>
  );
}
