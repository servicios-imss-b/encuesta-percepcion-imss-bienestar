import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Survey from './pages/Survey'
import Admin from './pages/Admin'
import Progress from './pages/Progress'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/encuesta" element={<Survey />} />
      <Route path="/resultados" element={<Admin />} />
      <Route path="/avance" element={<Progress />} />
    </Routes>
  )
}
