import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';

function Dashboard() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 dark:text-gray-600 text-lg">Dashboard — Coming soon</p>
    </div>
  );
}

function Projects() {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 dark:text-gray-600 text-lg">Projects — Coming soon</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
