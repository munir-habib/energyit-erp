import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAdmin, RequireAuth } from '@/components/layout/RouteGuards'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { GasPlaceholderPage } from '@/pages/GasPlaceholderPage'
import { ClientsListPage } from '@/pages/clients/ClientsListPage'
import { ClientDetailPage } from '@/pages/clients/ClientDetailPage'
import { GruposListPage } from '@/pages/grupos/GruposListPage'
import { GroupDetailPage } from '@/pages/grupos/GroupDetailPage'
import { InvoicesListPage } from '@/pages/invoices/InvoicesListPage'
import { InvoiceFormPage } from '@/pages/invoices/InvoiceFormPage'
import { SimulationsListPage } from '@/pages/simulations/SimulationsListPage'
import { SimulationNewPage } from '@/pages/simulations/SimulationNewPage'
import { SimulationResultPage } from '@/pages/simulations/SimulationResultPage'
import { ContractsListPage } from '@/pages/contracts/ContractsListPage'
import { ContractNewPage } from '@/pages/contracts/ContractNewPage'
import { ContractDetailPage } from '@/pages/contracts/ContractDetailPage'
import { PontosConsumoListPage } from '@/pages/pontosConsumo/PontosConsumoListPage'
import { PontoConsumoDetailPage } from '@/pages/pontosConsumo/PontoConsumoDetailPage'
import { CommissionsListPage } from '@/pages/commissions/CommissionsListPage'
import { ImportPage } from '@/pages/import/ImportPage'
import { AdminProductsPage } from '@/pages/admin/AdminProductsPage'
import { AdminPricingGridPage } from '@/pages/admin/AdminPricingGridPage'
import { AdminTarPage } from '@/pages/admin/AdminTarPage'
import { AdminPotenciaPage } from '@/pages/admin/AdminPotenciaPage'
import { AdminCommissionRulesPage } from '@/pages/admin/AdminCommissionRulesPage'
import { AdminMarketIndicesPage } from '@/pages/admin/AdminMarketIndicesPage'
import { AdminAccountsPage } from '@/pages/admin/AdminAccountsPage'
import { AdminAuditPage } from '@/pages/admin/AdminAuditPage'

import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage'
import { LoginSplash } from '@/components/auth/LoginSplash'

export default function App() {
  return (
    <>
      <LoginSplash />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registar" element={<RegisterPage />} />
      <Route path="/recuperar-password" element={<ForgotPasswordPage />} />
      <Route path="/redefinir-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/gas" element={<GasPlaceholderPage />} />

        <Route path="/clientes" element={<ClientsListPage />} />
        <Route path="/clientes/:id" element={<ClientDetailPage />} />

        <Route path="/grupos" element={<GruposListPage />} />
        <Route path="/grupos/:id" element={<GroupDetailPage />} />

        <Route path="/faturas" element={<InvoicesListPage />} />
        <Route path="/faturas/nova" element={<InvoiceFormPage />} />
        <Route path="/faturas/:id/editar" element={<InvoiceFormPage />} />

        <Route path="/simulacoes" element={<SimulationsListPage />} />
        <Route path="/simulacoes/nova" element={<SimulationNewPage />} />
        <Route path="/simulacoes/:id" element={<SimulationResultPage />} />

        <Route path="/contratos" element={<ContractsListPage />} />
        <Route path="/contratos/novo" element={<ContractNewPage />} />
        <Route path="/contratos/:id" element={<ContractDetailPage />} />

        <Route path="/pontos-consumo" element={<PontosConsumoListPage />} />
        <Route path="/pontos-consumo/:id" element={<PontoConsumoDetailPage />} />

        <Route path="/comissoes" element={<CommissionsListPage />} />
        <Route path="/importar" element={<ImportPage />} />

        <Route
          path="/admin/pricing-grid"
          element={
            <RequireAdmin>
              <AdminPricingGridPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/produtos"
          element={
            <RequireAdmin>
              <AdminProductsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/tar"
          element={
            <RequireAdmin>
              <AdminTarPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/potencia"
          element={
            <RequireAdmin>
              <AdminPotenciaPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/comissoes"
          element={
            <RequireAdmin>
              <AdminCommissionRulesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/indices"
          element={
            <RequireAdmin>
              <AdminMarketIndicesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/contas"
          element={
            <RequireAdmin>
              <AdminAccountsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/auditoria"
          element={
            <RequireAdmin>
              <AdminAuditPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}
