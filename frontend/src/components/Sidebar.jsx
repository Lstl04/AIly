import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ user }) {
  const { logout, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const location = useLocation();
  const [invoiceCounts, setInvoiceCounts] = useState({
    drafts: 0,
    sent: 0,
    paid: 0,
    overdue: 0
  });
  const [clientCounts, setClientCounts] = useState({
    active: 0,
    archived: 0
  });

  const handleLogout = () => {
    logout({ 
      logoutParams: { returnTo: window.location.origin } 
    });
  };

  const fetchInvoiceCounts = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Get user profile to get MongoDB _id
      const profileResponse = await fetch('http://127.0.0.1:8000/api/users/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!profileResponse.ok) {
        return;
      }
      
      const profile = await profileResponse.json();
      const userId = profile._id;
      
      if (!userId) return;

      // Fetch counts for each status
      const statuses = ['draft', 'sent', 'paid', 'overdue'];
      const counts = {};

      await Promise.all(
        statuses.map(async (status) => {
          try {
            const response = await fetch(
              `http://127.0.0.1:8000/api/invoices/?user_id=${userId}&status_filter=${status}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );
            if (response.ok) {
              const data = await response.json();
              counts[status] = data.length;
            } else {
              counts[status] = 0;
            }
          } catch (error) {
            console.error(`Error fetching ${status} invoices:`, error);
            counts[status] = 0;
          }
        })
      );

      setInvoiceCounts({
        drafts: counts.draft || 0,
        sent: counts.sent || 0,
        paid: counts.paid || 0,
        overdue: counts.overdue || 0
      });
    } catch (error) {
      console.error('Error fetching invoice counts:', error);
    }
  };

  const fetchClientCounts = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Get user profile to get MongoDB _id
      const profileResponse = await fetch('http://127.0.0.1:8000/api/users/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!profileResponse.ok) {
        return;
      }
      
      const profile = await profileResponse.json();
      const userId = profile._id;
      
      if (!userId) return;

      // Fetch active clients
      const activeResponse = await fetch(
        `http://127.0.0.1:8000/api/clients/?user_id=${userId}&archived=false`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      // Fetch archived clients
      const archivedResponse = await fetch(
        `http://127.0.0.1:8000/api/clients/?user_id=${userId}&archived=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const activeCount = activeResponse.ok ? (await activeResponse.json()).length : 0;
      const archivedCount = archivedResponse.ok ? (await archivedResponse.json()).length : 0;

      setClientCounts({
        active: activeCount,
        archived: archivedCount
      });
    } catch (error) {
      console.error('Error fetching client counts:', error);
    }
  };

  useEffect(() => {
    fetchInvoiceCounts();
    fetchClientCounts();
    
    // Refresh counts when route changes (user navigates between pages)
    const interval = setInterval(() => {
      fetchInvoiceCounts();
      fetchClientCounts();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [user, location.pathname]);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>💼 PersonalCFO</h2>
        <p className="user-name">{user?.name || user?.email || 'User'}</p>
      </div>
      
      <nav className="sidebar-nav">
        {/* Jobs Section */}
        <div className="sidebar-section">
          <button 
            className={`section-header ${location.pathname === '/jobs' ? 'active' : ''}`}
            onClick={() => navigate('/jobs')}
          >
            <div className="section-title">
              <span className="section-icon">🔧</span>
              <span>Jobs</span>
            </div>
          </button>
        </div>
        
        {/* Invoices Section */}
        <div className="sidebar-section">
          <button 
            className="section-header"
            onClick={() => setInvoicesExpanded(!invoicesExpanded)}
          >
            <div className="section-title">
              <span className="section-icon">📄</span>
              <span>Invoices</span>
            </div>
            <span className={`expand-icon ${invoicesExpanded ? 'expanded' : ''}`}>
              ›
            </span>
          </button>
          
          {invoicesExpanded && (
            <div className="section-content">
              <button 
                className={`sidebar-item ${location.pathname === '/invoices/drafts' ? 'active' : ''}`}
                onClick={() => navigate('/invoices/drafts')}
              >
                <span className="item-icon">📝</span>
                <span className="item-label">Drafts</span>
                <span className="item-count">{invoiceCounts.drafts}</span>
              </button>
              <button 
                className={`sidebar-item ${location.pathname === '/invoices/sent' ? 'active' : ''}`}
                onClick={() => navigate('/invoices/sent')}
              >
                <span className="item-icon">📤</span>
                <span className="item-label">Sent</span>
                <span className="item-count">{invoiceCounts.sent}</span>
              </button>
              <button 
                className={`sidebar-item ${location.pathname === '/invoices/paid' ? 'active' : ''}`}
                onClick={() => navigate('/invoices/paid')}
              >
                <span className="item-icon">✓</span>
                <span className="item-label">Paid</span>
                <span className="item-count">{invoiceCounts.paid}</span>
              </button>
              <button 
                className={`sidebar-item ${location.pathname === '/invoices/overdue' ? 'active' : ''}`}
                onClick={() => navigate('/invoices/overdue')}
              >
                <span className="item-icon">⚠️</span>
                <span className="item-label">Overdue</span>
                <span className="item-count">{invoiceCounts.overdue}</span>
              </button>
            </div>
          )}
        </div>

        {/* Clients Section */}
        <div className="sidebar-section">
          <button 
            className="section-header"
            onClick={() => setClientsExpanded(!clientsExpanded)}
          >
            <div className="section-title">
              <span className="section-icon">👥</span>
              <span>Clients</span>
            </div>
            <span className={`expand-icon ${clientsExpanded ? 'expanded' : ''}`}>
              ›
            </span>
          </button>
          
          {clientsExpanded && (
            <div className="section-content">
              <button 
                className={`sidebar-item ${location.pathname === '/clients/active' ? 'active' : ''}`}
                onClick={() => navigate('/clients/active')}
              >
                <span className="item-icon">⭐</span>
                <span className="item-label">Active</span>
                <span className="item-count">{clientCounts.active}</span>
              </button>
              <button 
                className={`sidebar-item ${location.pathname === '/clients/archived' ? 'active' : ''}`}
                onClick={() => navigate('/clients/archived')}
              >
                <span className="item-icon">📦</span>
                <span className="item-label">Archived</span>
                <span className="item-count">{clientCounts.archived}</span>
              </button>
            </div>
          )}
        </div>

        {/* Calendar Section */}
        <div className="sidebar-section">
          <button 
            className={`section-header ${location.pathname === '/calendar' ? 'active' : ''}`}
            onClick={() => navigate('/calendar')}
          >
            <div className="section-title">
              <span className="section-icon">📅</span>
              <span>Calendar</span>
            </div>
          </button>
        </div>

    

        {/* Expenses Section */}
        <div className="sidebar-section">
          <button 
            className={`section-header ${location.pathname === '/expenses' ? 'active' : ''}`}
            onClick={() => navigate('/expenses')}
          >
            <div className="section-title">
              <span className="section-icon">🧾</span>
              <span>Expenses</span>
            </div>
          </button>
        </div>
        
      </nav>

      {/* Footer Actions */}
      <div className="sidebar-footer">
        <button className="sidebar-item" onClick={() => navigate('/profile')}>
          <span className="item-icon">👤</span>
          <span className="item-label">Profile</span>
        </button>
        
        <button className="sidebar-item logout-btn" onClick={handleLogout}>
          <span className="item-icon">🚪</span>
          <span className="item-label">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
