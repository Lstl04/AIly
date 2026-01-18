import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './Invoices.css';

function InvoicesOverdue() {
  const { user, getAccessTokenSilently } = useAuth0();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
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
        throw new Error('Failed to fetch user profile');
      }
      
      const profile = await profileResponse.json();
      const userId = profile._id;
      
      const response = await fetch(`http://127.0.0.1:8000/api/invoices/?user_id=${userId}&status_filter=overdue`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDaysOverdue = (dueDate) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = today - due;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const handleMarkPaid = async (invoiceId) => {
    if (!confirm('Mark this invoice as paid? It will be moved to the Paid section.')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`http://127.0.0.1:8000/api/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'paid' }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark invoice as paid');
      }

      // Remove from local state (it will appear in Paid section)
      setInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      alert('Invoice marked as paid successfully!');

    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      alert('Failed to mark invoice as paid. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="invoices-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="invoices-container">
      <div className="invoices-header">
        <div className="header-content">
          <h1>⚠️ Overdue Invoices</h1>
          <p className="subtitle">Manage overdue payments</p>
        </div>
        <button className="create-invoice-btn">
          <span>➕</span>
          Create Invoice
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          {error}
        </div>
      )}

      {invoices.length === 0 ? (
        <div className="empty-state">
          <p>No overdue invoices</p>
        </div>
      ) : (
        <div className="invoices-grid">
          {invoices.map((invoice) => (
            <div key={invoice._id} className="invoice-card">
              <div className="invoice-card-header">
                <div className="invoice-number">
                  <span className="invoice-icon">📄</span>
                  <h3>{invoice.invoiceNumber}</h3>
                </div>
                <div className="invoice-status status-overdue">
                  Overdue
                </div>
              </div>

              <div className="invoice-card-body">
                <div className="invoice-amount">
                  <span className="amount-label">Total Amount</span>
                  <span className="amount-value">{formatCurrency(invoice.total)}</span>
                </div>

                <div className="invoice-dates">
                  <div className="date-item">
                    <span className="date-label">Issue Date:</span>
                    <span className="date-value">{formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="date-item">
                    <span className="date-label">Due Date:</span>
                    <span className="date-value">{formatDate(invoice.dueDate)}</span>
                  </div>
                  <div className="date-item" style={{ color: '#dc3545', fontWeight: '600' }}>
                    <span className="date-label">Days Overdue:</span>
                    <span className="date-value">{calculateDaysOverdue(invoice.dueDate)} days</span>
                  </div>
                </div>
              </div>

              <div className="invoice-card-footer">
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleMarkPaid(invoice._id)}
                >
                  <span>✅</span> Mark Paid
                </button>
                <button className="invoice-action-btn">
                  📧 Remind
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default InvoicesOverdue;
