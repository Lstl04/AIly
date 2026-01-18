import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { generatePDF } from '../utils/pdfGenerator';
import './Invoices.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

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
      const profileResponse = await fetch(`${API_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const profile = await profileResponse.json();
      const userId = profile._id;
      
      const response = await fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=overdue`, {
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

      const response = await fetch(`${API_URL}/invoices/${invoiceId}`, {
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

  const handleSendReminder = async (invoiceId) => {
    if (!confirm('Send a payment reminder email to the client?')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/invoices/${invoiceId}/send-reminder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send reminder');
      }

      const result = await response.json();
      alert(result.message || 'Payment reminder sent successfully!');

    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder. ' + (error.message || 'Please try again.'));
    }
  };

  const handleDownloadPDF = async (invoiceId) => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/invoices/${invoiceId}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch invoice details');
      }

      const invoiceData = await response.json();
      
      // Generate and download PDF
      generatePDF(invoiceData, invoiceData.user, invoiceData.client);

    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Failed to download PDF. Please try again.');
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
          <h1>Overdue Invoices</h1>
          <p className="subtitle">Manage overdue payments</p>
        </div>
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
                  <span className="invoice-icon"></span>
                  <h3>{invoice.invoiceNumber}</h3>
                </div>
                <div className="invoice-status status-overdue">
                  Overdue
                </div>
              </div>

              <div className="invoice-card-body">
                <div className="invoice-amount">
                  <span className="amount-label">Total Amount: </span>
                  <span className="amount-value">{formatCurrency(invoice.total)}</span>
                </div>

                <div className="invoice-dates">
                  <div className="date-item">
                    <span className="date-label">Issue Date: </span>
                    <span className="date-value">{formatDate(invoice.issueDate)}</span>
                  </div>
                  <div className="date-item">
                    <span className="date-label">Due Date: </span>
                    <span className="date-value">{formatDate(invoice.dueDate)}</span>
                  </div>
                  <div className="date-item" style={{ color: '#dc3545', fontWeight: '600' }}>
                    <span className="date-label">Days Overdue: </span>
                    <span className="date-value">{calculateDaysOverdue(invoice.dueDate)} days</span>
                  </div>
                </div>
              </div>

              <div className="invoice-card-footer">
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleMarkPaid(invoice._id)}
                >
                  <span>Mark Paid</span>
                </button>
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleSendReminder(invoice._id)}
                >
                  Remind
                </button>
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleDownloadPDF(invoice._id)}
                >
                  Download PDF
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
