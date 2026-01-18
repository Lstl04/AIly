import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ user }) {
  const { logout } = useAuth0();
  const navigate = useNavigate();
  const [invoicesExpanded, setInvoicesExpanded] = useState(true);
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const location = useLocation();

  const handleLogout = () => {
    logout({ 
      logoutParams: { returnTo: window.location.origin } 
    });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>💼 PersonalCFO</h2>
        <p className="user-name">{user?.name || user?.email || 'User'}</p>
      </div>
      
      <nav className="sidebar-nav">
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
              <button className="sidebar-item">
                <span className="item-icon">📝</span>
                <span className="item-label">Drafts</span>
                <span className="item-count">0</span>
              </button>
              <button className="sidebar-item">
                <span className="item-icon">📤</span>
                <span className="item-label">Sent</span>
                <span className="item-count">0</span>
              </button>
              <button className="sidebar-item">
                <span className="item-icon">✓</span>
                <span className="item-label">Paid</span>
                <span className="item-count">0</span>
              </button>
              <button className="sidebar-item">
                <span className="item-icon">⚠️</span>
                <span className="item-label">Overdue</span>
                <span className="item-count">0</span>
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
              <button className="sidebar-item">
                <span className="item-icon">📋</span>
                <span className="item-label">All Clients</span>
                <span className="item-count">0</span>
              </button>
              <button className="sidebar-item">
                <span className="item-icon">⭐</span>
                <span className="item-label">Active</span>
                <span className="item-count">0</span>
              </button>
              <button className="sidebar-item">
                <span className="item-icon">📦</span>
                <span className="item-label">Archived</span>
                <span className="item-count">0</span>
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
