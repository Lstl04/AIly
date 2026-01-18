import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './Clients.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

function ClientsArchived() {
  const { getAccessTokenSilently } = useAuth0();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

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

      // Fetch only archived clients
      const response = await fetch(`${API_URL}/clients/?user_id=${userProfile._id}&archived=true`, {
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

  const handleUnarchive = async (clientId) => {
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
          archived: false
        }),
      });

      if (response.ok) {
        await fetchClients();
        alert('Client unarchived successfully!');
      } else {
        throw new Error('Failed to unarchive client');
      }
    } catch (err) {
      console.error('Error unarchiving client:', err);
      alert('Failed to unarchive client');
    }
  };

  const handleDelete = async (clientId, clientName) => {
    if (!confirm(`Are you sure you want to permanently delete "${clientName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchClients();
        alert('Client deleted successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete client');
      }
    } catch (err) {
      console.error('Error deleting client:', err);
      alert(err.message || 'Failed to delete client. Please try again.');
    }
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
          <h1>Archived Clients</h1>
          <p className="subtitle">View your archived client records</p>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="empty-state">
          <p>No archived clients found.</p>
        </div>
      ) : (
        <div className="clients-grid">
          {clients.map((client) => (
            <div key={client._id || client.id} className="client-card">
              <div className="client-card-header">
                <h3 className="client-name">{client.name || 'Unnamed Client'}</h3>
                <span className="client-archived-badge">Archived</span>
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
                  className="client-action-btn unarchive"
                  onClick={() => handleUnarchive(client._id || client.id)}
                >
                  Unarchive
                </button>
                <button
                  className="client-action-btn delete"
                  onClick={() => handleDelete(client._id || client.id, client.name || 'Unnamed Client')}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientsArchived;
