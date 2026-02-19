import { Routes, Route } from 'react-router-dom';
import Verify from './pages/Verify';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/verify/:id" element={<Verify />} />
    </Routes>
  );
}

function Home() {
  return (
    <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
      <h1>RenoveJá+</h1>
      <p>Use o link de verificação que você recebeu (ex.: /verify/&lt;id&gt;) para validar uma receita.</p>
    </div>
  );
}
