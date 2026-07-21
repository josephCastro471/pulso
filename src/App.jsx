import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppThemeProvider } from './contexts/ThemeContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { SymptomsProvider } from './contexts/SymptomsContext';
import { MedicationsProvider } from './contexts/MedicationsContext';
import { AppointmentsProvider } from './contexts/AppointmentsContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Sintomas from './pages/Sintomas';
import Medicamentos from './pages/Medicamentos';
import Citas from './pages/Citas';

function Layout() {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Outlet />
    </Box>
  );
}

function App() {
  return (
    <AppThemeProvider>
      <NotificationProvider>
        <AuthProvider>
          <SymptomsProvider>
            <MedicationsProvider>
              <AppointmentsProvider>
                <BrowserRouter>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/registro" element={<Register />} />
                    <Route
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/sintomas" element={<Sintomas />} />
                      <Route path="/medicamentos" element={<Medicamentos />} />
                      <Route path="/citas" element={<Citas />} />
                    </Route>
                  </Routes>
                </BrowserRouter>
              </AppointmentsProvider>
            </MedicationsProvider>
          </SymptomsProvider>
        </AuthProvider>
      </NotificationProvider>
    </AppThemeProvider>
  );
}

export default App;
