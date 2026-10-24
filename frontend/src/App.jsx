import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DonorRegistrationPage from './pages/DonorRegistrationPage';
import OrgRegistrationPage from './pages/OrgRegistrationPage';
import DonorDashboard from './pages/DonorDashboard';
import BloodBankDashboard from './pages/BloodBankDashboard';
import HospitalDashboard from './pages/HospitalDashboard';
import AdminDashboard from './pages/AdminDashboard';
import InventoryPage from './pages/InventoryPage';
import BloodUnitRegistrationPage from './pages/BloodUnitRegistrationPage';
import BloodUnitDetailsPage from './pages/BloodUnitDetailsPage';
import HospitalRequestPage from './pages/HospitalRequestPage';
import EmergencyTransferPage from './pages/EmergencyTransferPage';
import DispatchReceiptPage from './pages/DispatchReceiptPage';
import ExpiryMonitoringPage from './pages/ExpiryMonitoringPage';
import BlockchainExplorerPage from './pages/BlockchainExplorerPage';
import AuditLogPage from './pages/AuditLogPage';
import ReportsAnalyticsPage from './pages/ReportsAnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register-donor" element={<DonorRegistrationPage />} />
              <Route path="/register-org" element={<OrgRegistrationPage />} />

              <Route path="/unauthorized" element={<UnauthorizedPage />} />

              {/* Protected Authenticated Routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/inventory" element={<InventoryPage />} />
                <Route path="/units/:unitId" element={<BloodUnitDetailsPage />} />
                <Route path="/analytics" element={<ReportsAnalyticsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* Donor-Specific Route */}
              <Route element={<ProtectedRoute allowedRoles={['donor', 'admin']} />}>
                <Route path="/donor-dashboard" element={<DonorDashboard />} />
              </Route>

              {/* Blood Bank Routes */}
              <Route element={<ProtectedRoute allowedRoles={['blood_bank', 'admin']} />}>
                <Route path="/bloodbank-dashboard" element={<BloodBankDashboard />} />
                <Route path="/units/register" element={<BloodUnitRegistrationPage />} />
              </Route>

              {/* Hospital Routes */}
              <Route element={<ProtectedRoute allowedRoles={['hospital', 'admin']} />}>
                <Route path="/hospital-dashboard" element={<HospitalDashboard />} />
                <Route path="/transfers" element={<EmergencyTransferPage />} />
              </Route>

              {/* Multi-role Operational Routes */}
              <Route element={<ProtectedRoute allowedRoles={['blood_bank', 'hospital', 'admin']} />}>
                <Route path="/requests" element={<HospitalRequestPage />} />
                <Route path="/dispatch" element={<DispatchReceiptPage />} />
                <Route path="/expiry" element={<ExpiryMonitoringPage />} />
                <Route path="/audit" element={<AuditLogPage />} />
                <Route path="/explorer" element={<BlockchainExplorerPage />} />
              </Route>

              {/* Admin-only Route */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin-dashboard" element={<AdminDashboard />} />
              </Route>

              {/* Catch-all 404 */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}
