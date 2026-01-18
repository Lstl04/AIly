import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Hammer, 
  FileText, 
  Users, 
  Calendar, 
  Receipt, 
  User, 
  Power, 
  ChevronDown,
  ClipboardList
} from 'lucide-react';
import './Sidebar.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function Sidebar({ user }) {
  const { logout, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [counts, setCounts] = useState({ 
    drafts: 0, sent: 0, paid: 0, overdue: 0, 
    active: 0, archived: 0 
  });

  const handleLogout = () => logout({ logoutParams: { returnTo: window.location.origin } });

  const fetchData = async () => {
    try {
      const token = await getAccessTokenSilently();
      const profileRes = await fetch(`${API_URL}/users/profile`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (!profileRes.ok) {
        console.warn('Failed to fetch user profile:', profileRes.status);
        return;
      }
      const profile = await profileRes.json();
      const userId = profile._id;
      if (!userId) {
        console.warn('User profile missing _id');
        return;
      }

      const [drafts, sent, paid, overdue, active, archived] = await Promise.all([
        fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=draft`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=sent`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=paid`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=overdue`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_URL}/clients/?user_id=${userId}&archived=false`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
        fetch(`${API_URL}/clients/?user_id=${userId}&archived=true`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.ok ? res.json() : []).catch(() => []),
      ]);

      setCounts({
        drafts: drafts.length, sent: sent.length, paid: paid.length, overdue: overdue.length,
        active: active.length, archived: archived.length
      });
    } catch (err) { console.error('Sync Error:', err); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [user, location.pathname]);

  return (
    <div className="sidebar">
      <div className="sidebar-top-section">
        {/* Branding */}
        <button 
          className="sidebar-brand"
          onClick={() => navigate('/')}
        >
          <div className="brand-logo">
            <Hammer size={28} strokeWidth={2.5} />
          </div>
          <div className="brand-info">
            <h1>AIly</h1>
            <p>{user?.name?.split(' ')[0] || 'Operator'} // Active</p>
          </div>
        </button>
        
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-divider">Management</div>
            
            <div className="nav-group">
              <button className={`group-header ${invoicesExpanded ? 'expanded' : ''}`} onClick={() => setInvoicesExpanded(!invoicesExpanded)}>
                <div className="header-label">
                  <FileText size={22} />
                  <span>Invoices</span>
                </div>
                <ChevronDown size={18} className="chevron" />
              </button>
              {invoicesExpanded && (
                <div className="group-items">
                  <button onClick={() => navigate('/invoices/drafts')} className={location.pathname === '/invoices/drafts' ? 'active' : ''}>
                    <span>Drafts</span> <span className="badge">{counts.drafts}</span>
                  </button>
                  <button onClick={() => navigate('/invoices/sent')} className={location.pathname === '/invoices/sent' ? 'active' : ''}>
                    <span>Sent</span> <span className="badge">{counts.sent}</span>
                  </button>
                  <button onClick={() => navigate('/invoices/paid')} className={location.pathname === '/invoices/paid' ? 'active' : ''}>
                    <span>Paid</span> <span className="badge">{counts.paid}</span>
                  </button>
                  <button onClick={() => navigate('/invoices/overdue')} className={location.pathname === '/invoices/overdue' ? 'active' : ''}>
                    <span>Overdue</span> <span className="badge danger">{counts.overdue}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="nav-group">
              <button className={`group-header ${clientsExpanded ? 'expanded' : ''}`} onClick={() => setClientsExpanded(!clientsExpanded)}>
                <div className="header-label">
                  <Users size={22} />
                  <span>Clients</span>
                </div>
                <ChevronDown size={18} className="chevron" />
              </button>
              {clientsExpanded && (
                <div className="group-items">
                  <button onClick={() => navigate('/clients/active')} className={location.pathname === '/clients/active' ? 'active' : ''}>
                    <span>Active</span> <span className="badge">{counts.active}</span>
                  </button>
                  <button onClick={() => navigate('/clients/archived')} className={location.pathname === '/clients/archived' ? 'active' : ''}>
                    <span>Archived</span> <span className="badge">{counts.archived}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-divider">Operations</div>
            
            <button className={`nav-link ${location.pathname === '/jobs' ? 'active' : ''}`} onClick={() => navigate('/jobs')}>
              <ClipboardList size={22} />
              <span>Jobs</span>
            </button>

            <button className={`nav-link ${location.pathname === '/calendar' ? 'active' : ''}`} onClick={() => navigate('/calendar')}>
              <Calendar size={22} />
              <span>Calendar</span>
            </button>

            <button className={`nav-link ${location.pathname === '/expenses' ? 'active' : ''}`} onClick={() => navigate('/expenses')}>
              <Receipt size={22} />
              <span>Expenses</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Footer Area */}
      <div className="sidebar-footer">
        <button className="user-profile-btn" onClick={() => navigate('/profile')}>
          <User size={22} />
          <span>Profile</span>
        </button>
        <button className="logout-btn" onClick={handleLogout}>
          <Power size={22} />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;