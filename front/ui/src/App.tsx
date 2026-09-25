import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import Graph from './pages/Graph';
import Chat from './pages/Chat';
import Settings from './pages/Settings';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Documents />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/documents/:id" element={<DocumentDetail />} />
        <Route path="/graph/:id" element={<Graph />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}

export default App;