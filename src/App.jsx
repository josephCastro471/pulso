import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import Box from '@mui/material/Box';
import { AppThemeProvider } from './contexts/ThemeContext';
import { SymptomsProvider } from './contexts/SymptomsContext';
import { MedicationsProvider } from './contexts/MedicationsContext';
import { AppointmentsProvider } from './contexts/AppointmentsContext';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
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
      <SymptomsProvider>
        <MedicationsProvider>
          <AppointmentsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<Layout />}>
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
    </AppThemeProvider>
  );
}

export default App;
