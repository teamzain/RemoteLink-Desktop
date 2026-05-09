import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Landing from './pages/Landing'
import Downloads from './pages/Downloads'
import FeaturesPage from './pages/landing/FeaturesPage'
import SolutionsPage from './pages/landing/SolutionsPage'
import PricingPage from './pages/landing/PricingPage'
import ResourcesPage from './pages/landing/ResourcesPage'
import EnterprisePage from './pages/landing/EnterprisePage'
import ProductPage from './pages/landing/ProductPage'
import CustomersPage from './pages/landing/CustomersPage'
import DashboardHome from './pages/dashboard/DashboardHome'
import RemoteSupport from './pages/dashboard/RemoteSupport'
import Devices from './pages/dashboard/Devices'
import Billing from './pages/dashboard/Billing'
import Settings from './pages/dashboard/Settings'
import Profile from './pages/dashboard/Profile'
import Support from './pages/dashboard/Support'
import Documentation from './pages/dashboard/Documentation'
import Members from './pages/dashboard/Members'
import SessionViewer from './pages/session/SessionViewer'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import ForgotPassword from './pages/auth/ForgotPassword'
import TwoFactor from './pages/auth/TwoFactor'
import ResetPassword from './pages/auth/ResetPassword'
import AuthCallback from './pages/auth/AuthCallback'
import Onboard from './pages/auth/Onboard'

import React, { useEffect } from 'react'

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.accessToken)
  const isLoading = useAuthStore((state) => state.isLoading)

  if (isLoading) return null; // Or a loading spinner
  if (!token) return <Navigate to="/login" />
  return <>{children}</>
}

function App() {
  const initialize = useAuthStore((state) => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/downloads" element={<Downloads />} />
      <Route path="/features" element={<FeaturesPage />} />
      <Route path="/solutions" element={<SolutionsPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/resources" element={<ResourcesPage />} />
      <Route path="/enterprise" element={<EnterprisePage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/product" element={<ProductPage />} />

      {/* Dashboard Routes (Protected) */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardHome /></ProtectedRoute>} />
      <Route path="/dashboard/devices" element={<ProtectedRoute><Devices /></ProtectedRoute>} />
      <Route path="/dashboard/sessions" element={<ProtectedRoute><RemoteSupport /></ProtectedRoute>} />
      <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
      <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/dashboard/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/dashboard/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
      <Route path="/dashboard/documentation" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
      <Route path="/dashboard/members" element={<ProtectedRoute><Members /></ProtectedRoute>} />
      <Route path="/session/:deviceId" element={<ProtectedRoute><SessionViewer /></ProtectedRoute>} />

      {/* Auth Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/2fa" element={<TwoFactor />} />
      <Route path="/onboard" element={<Onboard />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
    </Routes>
  )
}

export default App
