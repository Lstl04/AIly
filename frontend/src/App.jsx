import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import Sidebar from './components/Sidebar';
import AIly from './components/AIly';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Calendar from './pages/Calendar';
import Jobs from './pages/Jobs';
import InvoicesDrafts from './pages/InvoicesDrafts';
import InvoicesSent from './pages/InvoicesSent';
import InvoicesPaid from './pages/InvoicesPaid';
import InvoicesOverdue from './pages/InvoicesOverdue';
import Onboarding from './pages/Onboarding';
import Expenses from './pages/Expenses';
import ClientsActive from './pages/ClientsActive';
import ClientsArchived from './pages/ClientsArchived';
import './App.css';

function App() {
  const { isAuthenticated, isLoading, user } = useAuth0();

  if (isLoading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <Router>
      {!isAuthenticated ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <div className="app-container">
          <Sidebar user={user} />
          <AIly />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/invoices/drafts" element={<InvoicesDrafts />} />
              <Route path="/invoices/sent" element={<InvoicesSent />} />
              <Route path="/invoices/paid" element={<InvoicesPaid />} />
              <Route path="/invoices/overdue" element={<InvoicesOverdue />} />
              <Route path="/clients/active" element={<ClientsActive />} />
              <Route path="/clients/archived" element={<ClientsArchived />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      )}
    </Router>
  );
}

export default App;
