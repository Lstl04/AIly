import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './Clients.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

function ClientsActive() {
  const { getAccessTokenSilently } = useAuth0();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    address: ''
  });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  useEffect(() => {
    if (userProfile) {
      fetchClients();
    }
  }, [userProfile]);

  const fetchUserProfile = async () => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const profile = await response.json();
        setUserProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchClients = async () => {
    if (!userProfile) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Fetch only active (non-archived) clients
      const response = await fetch(`${API_URL}/clients/?user_id=${userProfile._id}&archived=false`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data || []);
      } else {
        throw new Error('Failed to fetch clients');
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      if (!userProfile) {
        throw new Error('User profile not loaded');
      }

      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const clientData = {
        userId: userProfile._id,
        name: formData.name,
        email: formData.email || undefined,
        address: formData.address || undefined,
        archived: false
      };

      const response = await fetch(`${API_URL}/clients/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to create client');
      }

      handleCloseModal();
      await fetchClients();
      alert('Client created successfully!');
    } catch (err) {
      console.error('Error creating client:', err);
      setError(err.message || 'Failed to create client');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (clientId) => {
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/clients/${clientId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          archived: true
        }),
      });

      if (response.ok) {
        await fetchClients();
        alert('Client archived successfully!');
      } else {
        throw new Error('Failed to archive client');
      }
    } catch (err) {
      console.error('Error archiving client:', err);
      alert('Failed to archive client');
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({
      name: '',
      email: '',
      address: ''
    });
    setError(null);
  };

  if (loading) {
    return (
      <div className="clients-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading clients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="clients-container">
      <div className="clients-header">
        <div className="header-content">
          <h1>Active Clients</h1>
          <p className="subtitle">Manage your active client relationships</p>
        </div>
        <button className="create-client-btn" onClick={() => setShowCreateModal(true)}>
          <span>+</span>
          <span>New Client</span>
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="empty-state">
          <p>No active clients found. Create your first client to get started!</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map((client) => (
            <div key={client._id || client.id} className="client-card">
              <div className="client-card-header">
                <h3 className="client-name">{client.name || 'Unnamed Client'}</h3>
              </div>
              <div className="client-info">
                {client.email && (
                  <div className="client-info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{client.email}</span>
                  </div>
                )}
                {client.address && (
                  <div className="client-info-item">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{client.address}</span>
                  </div>
                )}
              </div>
              <div className="client-actions">
                <button
                  className="client-action-btn archive"
                  onClick={() => handleArchive(client._id || client.id)}
                >
                  Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Client</h2>
              <button className="modal-close-btn" onClick={handleCloseModal}>×</button>
            </div>
            <form onSubmit={handleCreateClient} className="modal-form">
              <div className="form-group">
                <label>Client Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Enter client name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="client@example.com"
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Enter client address"
                />
              </div>
              {error && (
                <div className="error-banner">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="modal-btn modal-btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="modal-btn modal-btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClientsActive;
