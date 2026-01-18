import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { generatePDF } from '../utils/pdfGenerator';
import './Invoices.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Debug: Log the API URL to help troubleshoot
console.log('API_URL:', API_URL);
console.log('VITE_API_URL env:', import.meta.env.VITE_API_URL);

function InvoicesPaid() {
  const { user, getAccessTokenSilently } = useAuth0();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

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
      
      const response = await fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=paid`, {
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

  const handleViewInvoice = async (invoiceId) => {
    try {
      setLoadingInvoice(true);
      setError(null);
      
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

      const data = await response.json();
      setSelectedInvoice(data);
      setShowViewModal(true);

    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError('Failed to load invoice details');
      alert('Error loading invoice: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleCloseViewModal = () => {
    setShowViewModal(false);
    setSelectedInvoice(null);
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
          <h1>Paid Invoices</h1>
          <p className="subtitle">View your paid invoices</p>
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
          <p>No paid invoices</p>
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
                <div className="invoice-status status-paid">
                  Paid
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
                </div>
              </div>

              <div className="invoice-card-footer">
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleViewInvoice(invoice._id)}
                >
                  View
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

      {/* View Invoice Modal */}
      {showViewModal && selectedInvoice && (
        <div className="modal-overlay" onClick={handleCloseViewModal}>
          <div className="invoice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>Invoice Details</h2>
              <button className="close-btn" onClick={handleCloseViewModal}>
                &times;
              </button>
            </div>

            {loadingInvoice ? (
              <div className="invoice-form" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p>Loading invoice...</p>
              </div>
            ) : (
              <div className="invoice-form" style={{ padding: '32px' }}>
                {selectedInvoice.invoice && (
                  <>
                    {/* Invoice Header */}
                    <div className="form-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '24px', color: '#333' }}>
                            {selectedInvoice.invoice.invoiceNumber || 'Draft Invoice'}
                          </h3>
                          <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>
                            Status: <span style={{ 
                              padding: '4px 12px', 
                              borderRadius: '4px', 
                              background: '#28a745', 
                              color: 'white',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>{selectedInvoice.invoice.status?.toUpperCase() || 'PAID'}</span>
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>
                            {formatCurrency(selectedInvoice.invoice.total || 0)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Client Information */}
                    {selectedInvoice.client && (
                      <div className="form-section">
                        <h3>Bill To</h3>
                        <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '8px' }}>
                          <p style={{ margin: '4px 0', fontWeight: '600' }}>{selectedInvoice.client.name}</p>
                          {selectedInvoice.client.email && (
                            <p style={{ margin: '4px 0', color: '#666' }}>{selectedInvoice.client.email}</p>
                          )}
                          {selectedInvoice.client.address && (
                            <p style={{ margin: '4px 0', color: '#666' }}>{selectedInvoice.client.address}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Invoice Title & Description */}
                    {(selectedInvoice.invoice.invoiceTitle || selectedInvoice.invoice.invoiceDescription) && (
                      <div className="form-section">
                        <h3>Job Information</h3>
                        {selectedInvoice.invoice.invoiceTitle && (
                          <p style={{ margin: '8px 0', fontSize: '16px', fontWeight: '600' }}>
                            {selectedInvoice.invoice.invoiceTitle}
                          </p>
                        )}
                        {selectedInvoice.invoice.invoiceDescription && (
                          <p style={{ margin: '8px 0', color: '#666' }}>
                            {selectedInvoice.invoice.invoiceDescription}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Line Items */}
                    {selectedInvoice.invoice.lineItems && selectedInvoice.invoice.lineItems.length > 0 && (
                      <div className="form-section">
                        <h3>Line Items</h3>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '16px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ textAlign: 'left', padding: '12px', fontWeight: '600' }}>Description</th>
                              <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Quantity</th>
                              <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Rate</th>
                              <th style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedInvoice.invoice.lineItems.map((item, index) => (
                              <tr key={index} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                <td style={{ padding: '12px' }}>{item.description || '-'}</td>
                                <td style={{ textAlign: 'right', padding: '12px' }}>{item.quantity || 0}</td>
                                <td style={{ textAlign: 'right', padding: '12px' }}>{formatCurrency(item.rate || 0)}</td>
                                <td style={{ textAlign: 'right', padding: '12px', fontWeight: '600' }}>
                                  {formatCurrency(item.amount || 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="form-section">
                      <h3>Invoice Dates</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>Issue Date</p>
                          <p style={{ margin: '4px 0', fontWeight: '600' }}>
                            {formatDate(selectedInvoice.invoice.issueDate)}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '4px 0', color: '#666', fontSize: '14px' }}>Due Date</p>
                          <p style={{ margin: '4px 0', fontWeight: '600' }}>
                            {formatDate(selectedInvoice.invoice.dueDate)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Total */}
                    <div style={{ 
                      background: '#f8f9fa', 
                      padding: '20px', 
                      borderRadius: '8px', 
                      marginTop: '24px',
                      textAlign: 'right'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '24px' }}>
                        Total: {formatCurrency(selectedInvoice.invoice.total || 0)}
                      </h3>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicesPaid;
