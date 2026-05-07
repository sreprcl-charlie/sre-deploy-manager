import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage        from './pages/LoginPage';
import SignupPage       from './pages/SignupPage';
import DashboardPage    from './pages/DashboardPage';
import ChangesPage      from './pages/ChangesPage';
import NewChangePage    from './pages/NewChangePage';
import ChangeDetailPage from './pages/ChangeDetailPage';
import CheckpointsPage  from './pages/CheckpointsPage';
import DeployMonitorPage from './pages/DeployMonitorPage';
import InvitePage       from './pages/InvitePage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/changes" element={<ProtectedRoute><ChangesPage /></ProtectedRoute>} />
          <Route path="/changes/new" element={<ProtectedRoute><NewChangePage /></ProtectedRoute>} />
          <Route path="/changes/:id" element={<ProtectedRoute><ChangeDetailPage /></ProtectedRoute>} />
          <Route path="/checkpoints" element={<ProtectedRoute><CheckpointsPage /></ProtectedRoute>} />
          <Route path="/deploy" element={<ProtectedRoute><DeployMonitorPage /></ProtectedRoute>} />
          <Route path="/deploy/:id" element={<ProtectedRoute><DeployMonitorPage /></ProtectedRoute>} />
          <Route path="/admin/invite" element={<ProtectedRoute roles={['superuser']}><InvitePage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
