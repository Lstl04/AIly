import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './Invoices.css';

function InvoicesDrafts() {
  const { user, getAccessTokenSilently } = useAuth0();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [clientInfo, setClientInfo] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  
  const [formData, setFormData] = useState({
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    jobTitle: '',
    jobDescription: '',
    hoursWorked: 0,
    items: [{ description: '', cost: 0, quantity: 1 }],
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchInvoices();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch('http://127.0.0.1:8000/api/users/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      if (!userProfile || !userProfile._id) {
        await fetchUserProfile(); // Make sure profile is loaded
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Use MongoDB user ID from profile
      const userId = userProfile?._id;
      if (!userId) {
        setError('User profile not loaded');
        return;
      }
      const response = await fetch(`http://127.0.0.1:8000/api/invoices/?user_id=${userId}&status_filter=draft`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setInvoices(data);
        setError(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to fetch invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', cost: 0, quantity: 1 }]
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData(prev => ({
        ...prev,
        items: prev.items.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateTotal = () => {
    const hourlyRate = userProfile?.hourlyRate || 0;
    const laborCost = parseFloat(formData.hoursWorked) * hourlyRate;
    const itemsCost = formData.items.reduce((sum, item) => {
      return sum + (parseFloat(item.cost || 0) * parseFloat(item.quantity || 0));
    }, 0);
    return laborCost + itemsCost;
  };

  const handleCreateInvoice = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      if (!userProfile) {
        throw new Error('User profile not loaded. Please wait...');
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Step 1: Create client (only if not editing)
      if (!editingInvoiceId) {
        const clientData = {
          userId: userProfile._id,
          name: formData.clientName,
          email: formData.clientEmail,
          address: formData.clientAddress || ''
        };

        console.log('Creating client with data:', clientData);

        const clientResponse = await fetch('http://127.0.0.1:8000/api/clients/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(clientData),
        });

        if (!clientResponse.ok) {
          const errorData = await clientResponse.json().catch(() => ({}));
          console.error('Client creation error:', errorData);
          throw new Error(errorData.detail || 'Failed to create client');
        }

        const client = await clientResponse.json();
        console.log('Client created:', client);
      }

      // Step 2: Prepare line items (without job description)
      const lineItems = [];
      
      // Add labor as first line item if hours worked > 0
      if (formData.hoursWorked > 0) {
        lineItems.push({
          description: 'Labor',
          quantity: parseFloat(formData.hoursWorked) || 0,
          rate: parseFloat(userProfile?.hourlyRate || 0),
          amount: parseFloat(formData.hoursWorked || 0) * parseFloat(userProfile?.hourlyRate || 0)
        });
      }

      // Add other items
      formData.items.forEach(item => {
        if (item.description && item.cost > 0) {
          lineItems.push({
            description: item.description,
            quantity: parseFloat(item.quantity || 1),
            rate: parseFloat(item.cost || 0),
            amount: parseFloat(item.quantity || 1) * parseFloat(item.cost || 0)
          });
        }
      });

      // Step 3: Create or update invoice
      const invoiceData = {
        userId: userProfile._id,
        clientId: "", // Empty string as requested
        jobId: "", // Empty string as requested
        invoiceTitle: formData.jobTitle || '',
        invoiceDescription: formData.jobDescription || '',
        status: 'draft',
        issueDate: new Date(formData.issueDate).toISOString(),
        dueDate: new Date(formData.dueDate).toISOString(),
        lineItems: lineItems,
        total: calculateTotal()
      };

      console.log('Creating/updating invoice with data:', invoiceData);

      let invoiceResponse;
      if (editingInvoiceId) {
        // Update existing invoice
        invoiceResponse = await fetch(`http://127.0.0.1:8000/api/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceData),
        });
      } else {
        // Create new invoice
        invoiceResponse = await fetch('http://127.0.0.1:8000/api/invoices/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceData),
        });
      }

      if (!invoiceResponse.ok) {
        const errorData = await invoiceResponse.json().catch(() => ({}));
        console.error('Invoice creation/update error:', errorData);
        throw new Error(errorData.detail || 'Failed to save invoice');
      }

      const invoice = await invoiceResponse.json();
      console.log('Invoice saved successfully:', invoice);

      // Success! Close modal, reset form, and refresh
      handleCloseModal();
      await fetchInvoices(); // Refresh the invoice list
      alert(editingInvoiceId ? 'Invoice updated successfully!' : 'Invoice created successfully!');

    } catch (error) {
      console.error('Error creating invoice:', error);
      setError(error.message || 'Failed to create invoice. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditInvoice = async (invoiceId) => {
    try {
      setError(null);
      setLoadingInvoice(true);
      
      // Ensure userProfile is loaded
      if (!userProfile) {
        await fetchUserProfile();
      }
      
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Fetch invoice details
      const response = await fetch(`http://127.0.0.1:8000/api/invoices/${invoiceId}/details`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch invoice:', errorText);
        throw new Error('Failed to fetch invoice details');
      }

      const data = await response.json();
      console.log('Invoice data received:', data);
      
      if (!data) {
        throw new Error('No data received from server');
      }
      
      if (!data.invoice) {
        console.error('Missing invoice in response:', data);
        throw new Error('Invalid invoice data received');
      }

      const invoice = data.invoice;
      const client = data.client || null;

      // If client is null (empty clientId), we'll use empty values
      // User can still edit other fields but client info won't be available
      const clientName = client?.name || '';
      const clientEmail = client?.email || '';
      const clientAddress = client?.address || '';

      // Populate form with invoice data - handle date parsing safely
      let issueDate = new Date().toISOString().split('T')[0];
      let dueDate = '';
      
      try {
        if (invoice.issueDate) {
          const parsedIssueDate = new Date(invoice.issueDate);
          if (!isNaN(parsedIssueDate.getTime())) {
            issueDate = parsedIssueDate.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn('Error parsing issue date:', e);
      }

      try {
        if (invoice.dueDate) {
          const parsedDueDate = new Date(invoice.dueDate);
          if (!isNaN(parsedDueDate.getTime())) {
            dueDate = parsedDueDate.toISOString().split('T')[0];
          }
        }
      } catch (e) {
        console.warn('Error parsing due date:', e);
      }

      // Extract labor hours from lineItems (first item if it's labor)
      let hoursWorked = 0;
      let items = [];
      
      if (invoice.lineItems && Array.isArray(invoice.lineItems) && invoice.lineItems.length > 0) {
        // Check if first item is labor (has rate matching hourly rate)
        const firstItem = invoice.lineItems[0];
        const isLabor = firstItem?.description === 'Labor' || 
                       (userProfile?.hourlyRate && firstItem?.rate === userProfile.hourlyRate);
        
        if (isLabor) {
          hoursWorked = parseFloat(firstItem.quantity || 0);
          items = invoice.lineItems.slice(1).map(item => ({
            description: item?.description || '',
            cost: parseFloat(item?.rate || 0),
            quantity: parseFloat(item?.quantity || 1)
          }));
        } else {
          items = invoice.lineItems.map(item => ({
            description: item?.description || '',
            cost: parseFloat(item?.rate || 0),
            quantity: parseFloat(item?.quantity || 1)
          }));
        }
      }

      // If no items, add one empty item
      if (items.length === 0) {
        items = [{ description: '', cost: 0, quantity: 1 }];
      }

      setFormData({
        clientName: clientName,
        clientEmail: clientEmail,
        clientAddress: clientAddress,
        jobTitle: invoice.invoiceTitle || '',
        jobDescription: invoice.invoiceDescription || '',
        hoursWorked: hoursWorked,
        items: items,
        issueDate: issueDate,
        dueDate: dueDate
      });

      setClientInfo(client);
      setEditingInvoiceId(invoiceId);
      setShowCreateModal(true);

    } catch (error) {
      console.error('Error fetching invoice:', error);
      setError(error.message || 'Failed to load invoice for editing');
      alert('Error loading invoice: ' + (error.message || 'Unknown error'));
    } finally {
      setLoadingInvoice(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId) => {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`http://127.0.0.1:8000/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete invoice');
      }

      // Remove from local state and refresh
      setInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      alert('Invoice deleted successfully!');

    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const handleSendInvoice = async (invoiceId) => {
    if (!confirm('Send this invoice? It will be moved to the Sent section.')) {
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
        body: JSON.stringify({ status: 'sent' }),
      });

      if (!response.ok) {
        throw new Error('Failed to send invoice');
      }

      // Remove from local state (it will appear in Sent section)
      setInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      alert('Invoice sent successfully!');

    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      clientEmail: '',
      clientAddress: '',
      jobTitle: '',
      jobDescription: '',
      hoursWorked: 0,
      items: [{ description: '', cost: 0, quantity: 1 }],
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: ''
    });
    setEditingInvoiceId(null);
    setClientInfo(null);
    setLoadingInvoice(false);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetForm();
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
          <h1>📝 Draft Invoices</h1>
          <p className="subtitle">Manage your draft invoices</p>
        </div>
        <button className="create-invoice-btn" onClick={() => setShowCreateModal(true)}>
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
          <p>No draft invoices</p>
        </div>
      ) : (
        <div className="invoices-grid">
          {invoices.map((invoice) => (
            <div key={invoice._id} className="invoice-card">
              <div className="invoice-card-header">
                <div className="invoice-number">
                  <span className="invoice-icon">📄</span>
                  <h3>{invoice.invoiceNumber || 'Draft'}</h3>
                </div>
                <div className="invoice-status status-draft">
                  Draft
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
                </div>
              </div>

              <div className="invoice-card-footer">
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleSendInvoice(invoice._id)}
                >
                  <span>📤</span> Send
                </button>
                <button 
                  className="invoice-action-btn"
                  onClick={() => {
                    try {
                      const invoiceId = invoice._id || invoice.id;
                      if (invoiceId) {
                        handleEditInvoice(String(invoiceId));
                      } else {
                        alert('Invalid invoice ID');
                      }
                    } catch (err) {
                      console.error('Error in edit button:', err);
                      alert('Error opening edit form');
                    }
                  }}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="invoice-action-btn delete"
                  onClick={() => handleDeleteInvoice(invoice._id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="invoice-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingInvoiceId ? 'Edit Invoice' : 'Create New Invoice'}</h2>
              <button className="close-btn" onClick={handleCloseModal}>
                &times;
              </button>
            </div>

            {loadingInvoice ? (
              <div className="invoice-form" style={{ padding: '40px', textAlign: 'center' }}>
                <div className="spinner"></div>
                <p>Loading invoice data...</p>
              </div>
            ) : (
            <form onSubmit={handleCreateInvoice} className="invoice-form">
              {/* Client Information */}
              <div className="form-section">
                <h3>Client Information</h3>
                {editingInvoiceId && !clientInfo && (
                  <div className="info-banner" style={{ marginBottom: '16px', padding: '12px', background: '#fff3cd', borderRadius: '8px', color: '#856404' }}>
                    <span>ℹ️</span> Client information not available for this invoice. Fields are disabled.
                  </div>
                )}
                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    name="clientName"
                    value={formData.clientName}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingInvoiceId}
                  />
                  {editingInvoiceId && <small>Client cannot be changed when editing</small>}
                </div>

                <div className="form-group">
                  <label>Client Email *</label>
                  <input
                    type="email"
                    name="clientEmail"
                    value={formData.clientEmail}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingInvoiceId}
                  />
                </div>

                <div className="form-group">
                  <label>Client Address</label>
                  <input
                    type="text"
                    name="clientAddress"
                    value={formData.clientAddress}
                    onChange={handleInputChange}
                    disabled={!!editingInvoiceId}
                  />
                </div>
              </div>

              {/* Job Information */}
              <div className="form-section">
                <h3>Job Details</h3>
                <div className="form-group">
                  <label>Job Title *</label>
                  <input
                    type="text"
                    name="jobTitle"
                    value={formData.jobTitle}
                    onChange={handleInputChange}
                    placeholder="e.g., Website Building"
                  />
                </div>
                <div className="form-group">
                  <label>Job Description *</label>
                  <input
                    type="text"
                    name="jobDescription"
                    value={formData.jobDescription}
                    onChange={handleInputChange}
                    placeholder="e.g., built a full stack website"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Hours Worked</label>
                  <input
                    type="number"
                    name="hoursWorked"
                    value={formData.hoursWorked}
                    onChange={handleInputChange}
                    min="0"
                    step="0.5"
                  />
                  <small>Rate: {formatCurrency(userProfile?.hourlyRate || 0)}/hr = {formatCurrency((formData.hoursWorked || 0) * (userProfile?.hourlyRate || 0))}</small>
                </div>
              </div>
            

              {/* Additional Items */}
              <div className="form-section">
                <h3>Additional Items</h3>
                {formData.items.map((item, index) => (
                  <div key={index} className="item-row">
                    <div className="form-group">
                      <label>Description</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Item description"
                      />
                    </div>
                    <div className="form-group">
                      <label>Cost</label>
                      <input
                        type="number"
                        value={item.cost}
                        onChange={(e) => handleItemChange(index, 'cost', e.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        min="1"
                      />
                    </div>
                    {formData.items.length > 1 && (
                      <button 
                        type="button" 
                        className="remove-item-btn"
                        onClick={() => removeItem(index)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" className="add-item-btn" onClick={addItem}>
                  ➕ Add Item
                </button>
              </div>

              {/* Dates */}
              <div className="form-section">
                <h3>Invoice Dates</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Issue Date *</label>
                    <input
                      type="date"
                      name="issueDate"
                      value={formData.issueDate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Due Date *</label>
                    <input
                      type="date"
                      name="dueDate"
                      value={formData.dueDate}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="invoice-total">
                <h3>Total Amount: {formatCurrency(calculateTotal())}</h3>
              </div>

              {/* Submit Button */}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? (editingInvoiceId ? 'Updating...' : 'Creating...') : (editingInvoiceId ? 'Update Invoice' : 'Create Invoice')}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InvoicesDrafts;
