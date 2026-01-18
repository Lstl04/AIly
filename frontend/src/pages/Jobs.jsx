import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useLocation } from 'react-router-dom';
import './Jobs.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Helper function to create Google Calendar event
const createGoogleCalendarEvent = async (job) => {
  try {
    // Get Google Calendar token and calendar ID from localStorage
    const googleToken = localStorage.getItem('google_calendar_token');
    const calendarId = localStorage.getItem('google_calendar_selected_id') || 'primary';
    
    if (!googleToken) {
      console.log('Google Calendar not connected, skipping event creation');
      return null;
    }
    
    // Check if token is expired
    const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
    if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
      console.log('Google Calendar token expired, skipping event creation');
      return null;
    }
    
    // Only create event if job status is not "completed"
    if (job.status === 'completed') {
      console.log('Job is completed, skipping calendar event creation');
      return null;
    }
    
    // Prepare event data
    const eventData = {
      summary: job.title || 'Job',
      description: `Job: ${job.title || 'Untitled'}`,
      start: {
        dateTime: job.startTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: job.endTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      location: job.location || '',
    };
    
    // Create event in Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      }
    );
    
    if (response.ok) {
      const event = await response.json();
      console.log('Google Calendar event created:', event.id);
      return event.id;
    } else {
      const errorData = await response.json();
      console.error('Error creating Google Calendar event:', errorData);
      return null;
    }
  } catch (error) {
    console.error('Error creating Google Calendar event:', error);
    return null;
  }
};

// Helper function to delete Google Calendar event
const deleteGoogleCalendarEvent = async (eventId) => {
  try {
    // Get Google Calendar token and calendar ID from localStorage
    const googleToken = localStorage.getItem('google_calendar_token');
    const calendarId = localStorage.getItem('google_calendar_selected_id') || 'primary';
    
    if (!googleToken) {
      console.log('Google Calendar not connected, skipping event deletion');
      return false;
    }
    
    // Check if token is expired
    const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
    if (tokenExpiry && Date.now() > parseInt(tokenExpiry)) {
      console.log('Google Calendar token expired, skipping event deletion');
      return false;
    }
    
    if (!eventId) {
      console.log('No event ID provided, skipping event deletion');
      return false;
    }
    
    // Delete event from Google Calendar
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${googleToken}`,
        },
      }
    );
    
    if (response.ok || response.status === 204) {
      console.log('Google Calendar event deleted:', eventId);
      return true;
    } else {
      const errorData = await response.text();
      console.error('Error deleting Google Calendar event:', errorData);
      return false;
    }
  } catch (error) {
    console.error('Error deleting Google Calendar event:', error);
    return false;
  }
};

function Jobs() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
  const location = useLocation();
  const [plannedJobs, setPlannedJobs] = useState([]);
  const [pastJobs, setPastJobs] = useState([]);
  const [activeTab, setActiveTab] = useState('planned'); // 'planned' or 'past'
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingJobId, setEditingJobId] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    startTime: '',
    endTime: '',
    predictedHours: '',
    materials: '',
    addClient: false,
    selectedClientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mongoUserId, setMongoUserId] = useState(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [showCreateNewClient, setShowCreateNewClient] = useState(false);

  // Fetch MongoDB user ID from profile
  useEffect(() => {
    const fetchUserId = async () => {
      if (isAuthenticated) {
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
            const userData = await response.json();
            setMongoUserId(userData._id);
          }
        } catch (err) {
          console.error('Error fetching user:', err);
        }
      }
    };
    fetchUserId();
  }, [isAuthenticated, getAccessTokenSilently]);

  // Fetch jobs function - extracted so it can be called from multiple places
  const fetchJobs = useCallback(async () => {
    if (!mongoUserId) return;
    
    setIsLoadingJobs(true);
    try {
      const response = await fetch(`${API_URL}/jobs/?user_id=${mongoUserId}`);
      if (response.ok) {
        const jobs = await response.json();
        const now = new Date();
        
        // Split into planned (pending/in_progress) and past (completed) jobs
        const planned = jobs.filter(job => job.status !== 'completed');
        const past = jobs.filter(job => job.status === 'completed');
        
        setPlannedJobs(planned);
        setPastJobs(past);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, [mongoUserId]);

  // Fetch jobs when mongoUserId is available
  useEffect(() => {
    fetchJobs();
  }, [mongoUserId]);

  // Refetch jobs when navigating to the Jobs page (to catch updates from other pages)
  useEffect(() => {
    if (location.pathname === '/jobs' && mongoUserId) {
      fetchJobs();
    }
  }, [location.pathname, mongoUserId, fetchJobs]);

  // Refetch jobs when page becomes visible (to catch updates made in other tabs/pages)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && location.pathname === '/jobs' && mongoUserId) {
        fetchJobs();
      }
    };

    const handleFocus = () => {
      if (location.pathname === '/jobs' && mongoUserId) {
        fetchJobs();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [location.pathname, mongoUserId, fetchJobs]);

  // Fetch clients when addClient is checked
  const fetchClients = async () => {
    if (!mongoUserId) return;
    
    setLoadingClients(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/clients/?user_id=${mongoUserId}&archived=false`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data || []);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
    } finally {
      setLoadingClients(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!mongoUserId) {
      setError('User not authenticated. Please try again.');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // If "Add a client" is checked, get or create the client
      let clientId = null;
      let clientAddress = null;
      if (formData.addClient) {
        // If a client is selected from dropdown, fetch client details to get address
        if (formData.selectedClientId) {
          try {
            const clientResponse = await fetch(`${API_URL}/clients/${formData.selectedClientId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (!clientResponse.ok) {
              const errorData = await clientResponse.json().catch(() => ({}));
              throw new Error(errorData.detail || 'Failed to fetch client details');
            }

            const selectedClient = await clientResponse.json();
            clientId = selectedClient._id || selectedClient.id;
            clientAddress = selectedClient.address || null;
            console.log('Client selected:', selectedClient);
          } catch (clientError) {
            console.error('Error fetching client:', clientError);
            setError(clientError.message || 'Failed to fetch client details. Please try again.');
            setIsSubmitting(false);
            return;
          }
        } 
        // If creating new client, create it first
        else if (showCreateNewClient && formData.clientName.trim()) {
          try {
            const clientData = {
              userId: mongoUserId,
              name: formData.clientName.trim(),
              email: formData.clientEmail.trim() || undefined,
              address: formData.clientAddress.trim() || undefined,
              archived: false
            };

            const clientResponse = await fetch(`${API_URL}/clients/`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(clientData),
            });

            if (!clientResponse.ok) {
              const errorData = await clientResponse.json().catch(() => ({}));
              throw new Error(errorData.detail || 'Failed to create client');
            }

            const createdClient = await clientResponse.json();
            clientId = createdClient._id || createdClient.id;
            clientAddress = createdClient.address || null;
            console.log('Client created:', createdClient);
          } catch (clientError) {
            console.error('Error creating client:', clientError);
            setError(clientError.message || 'Failed to create client. Please try again.');
            setIsSubmitting(false);
            return;
          }
        } else if (showCreateNewClient) {
          // If create new client is shown but no name provided
          setError('Please select a client or create a new one with a name.');
          setIsSubmitting(false);
          return;
        } else {
          // If checkbox is checked but no client selected
          setError('Please select a client or create a new one.');
          setIsSubmitting(false);
          return;
        }
      }

      // Prepare job data for backend
      const jobData = {
        userId: mongoUserId,
        title: formData.title,
        status: 'pending',
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      };

      // Add clientId if client was selected/created
      if (clientId) {
        jobData.clientId = clientId;
      }

      // Add location (client address) if client has an address
      if (clientAddress) {
        jobData.location = clientAddress;
      }

      if (isEditing && editingJobId) {
        // Update existing job
        console.log('Updating job:', editingJobId, jobData);

        const response = await fetch(`${API_URL}/jobs/${editingJobId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Backend error:', errorData);
          throw new Error(errorData.detail || 'Failed to update job');
        }

        const updatedJob = await response.json();
        console.log('Job updated:', updatedJob);

        // Update in local state
        setPlannedJobs(prev => prev.map(job => 
          job._id === editingJobId ? updatedJob : job
        ));

      } else {
        // Create new job
        console.log('Creating job:', jobData);

        const response = await fetch(`${API_URL}/jobs/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Backend error:', errorData);
          throw new Error(errorData.detail || 'Failed to create job');
        }

        const createdJob = await response.json();
        console.log('Job created:', createdJob);

        // Create Google Calendar event if job is not completed
        let finalJob = createdJob;
        if (createdJob.status !== 'completed') {
          try {
            const eventId = await createGoogleCalendarEvent(createdJob);
            // Update job with the calendar event ID if event was created
            if (eventId) {
              const updateResponse = await fetch(`${API_URL}/jobs/${createdJob._id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: createdJob.userId,
                  title: createdJob.title,
                  status: createdJob.status,
                  startTime: createdJob.startTime,
                  endTime: createdJob.endTime,
                  location: createdJob.location,
                  clientId: createdJob.clientId,
                  googleCalendarEventId: eventId
                })
              });
              
              if (updateResponse.ok) {
                finalJob = await updateResponse.json();
              }
            }
          } catch (error) {
            console.error('Failed to create Google Calendar event:', error);
            // Don't fail the job creation if calendar event fails
          }
        }

        // Add to planned jobs list
        setPlannedJobs(prev => [...prev, finalJob]);
      }

      // Reset form and close modal
      setFormData({
        title: '',
        startTime: '',
        endTime: '',
        predictedHours: '',
        materials: '',
        addClient: false,
        selectedClientId: '',
        clientName: '',
        clientEmail: '',
        clientAddress: ''
      });
      setShowCreateNewClient(false);
      setShowCreateModal(false);
      setIsEditing(false);
      setEditingJobId(null);
      
    } catch (err) {
      console.error('Error saving job:', err);
      setError(err.message || 'Failed to save job');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditJob = async (job) => {
    setIsEditing(true);
    setEditingJobId(job._id);
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const startDate = new Date(job.startTime);
    const endDate = new Date(job.endTime);
    
    // Check if job has a clientId
    const hasClient = !!(job.clientId || job.client_id);
    const clientId = job.clientId || job.client_id || '';
    
    setFormData({
      title: job.title,
      startTime: formatDateTimeLocal(startDate),
      endTime: formatDateTimeLocal(endDate),
      predictedHours: '',
      materials: '',
      addClient: hasClient,
      selectedClientId: clientId,
      clientName: '',
      clientEmail: '',
      clientAddress: ''
    });
    setShowCreateNewClient(false);
    
    // If job has a client, fetch clients list to populate dropdown
    if (hasClient && mongoUserId) {
      await fetchClients();
    }
    
    setShowCreateModal(true);
  };

  const handleCompleteJob = async (jobId) => {
    if (!confirm('Mark this job as completed?')) {
      return;
    }

    try {
      // Find the job in planned jobs
      const job = plannedJobs.find(j => j._id === jobId);
      if (!job) return;

      // Delete Google Calendar event if it exists
      if (job.googleCalendarEventId) {
        try {
          await deleteGoogleCalendarEvent(job.googleCalendarEventId);
        } catch (error) {
          console.error('Failed to delete Google Calendar event:', error);
          // Don't fail the job completion if calendar event deletion fails
        }
      }

      // Update job status to completed
      const jobData = {
        userId: job.userId,
        title: job.title,
        status: 'completed',
        startTime: job.startTime,
        endTime: job.endTime,
        googleCalendarEventId: null // Clear the event ID
      };

      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        throw new Error('Failed to complete job');
      }

      const updatedJob = await response.json();
      
      // Move from planned to past jobs
      setPlannedJobs(prev => prev.filter(job => job._id !== jobId));
      setPastJobs(prev => [...prev, updatedJob]);
      
      console.log('Job marked as completed');
    } catch (err) {
      console.error('Error completing job:', err);
      alert('Failed to complete job. Please try again.');
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      // Find the job in planned or past jobs to get the calendar event ID
      const job = plannedJobs.find(j => j._id === jobId) || pastJobs.find(j => j._id === jobId);
      
      // Delete Google Calendar event if it exists
      if (job && job.googleCalendarEventId) {
        try {
          await deleteGoogleCalendarEvent(job.googleCalendarEventId);
        } catch (error) {
          console.error('Failed to delete Google Calendar event:', error);
          // Don't fail the job deletion if calendar event deletion fails
        }
      }

      const response = await fetch(`${API_URL}/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      // Remove from local state
      setPlannedJobs(prev => prev.filter(job => job._id !== jobId));
      setPastJobs(prev => prev.filter(job => job._id !== jobId));
      
      console.log('Job deleted successfully');
    } catch (err) {
      console.error('Error deleting job:', err);
      alert('Failed to delete job. Please try again.');
    }
  };

  // Helper function to format date for datetime-local input
  const formatDateTimeLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingJobId(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setIsEditing(false);
    setEditingJobId(null);
    setFormData({
      title: '',
      startTime: '',
      endTime: '',
      predictedHours: '',
      materials: '',
      addClient: false,
      selectedClientId: '',
      clientName: '',
      clientEmail: '',
      clientAddress: ''
    });
    setShowCreateNewClient(false);
    setError(null);
  };

  return (
    <div className="jobs-container">
      <div className="jobs-header">
        <div className="header-content">
          <h1>🔧 Jobs</h1>
          <p className="subtitle">Manage and track your jobs</p>
        </div>
        <button className="create-job-btn" onClick={openCreateModal}>
          <span>➕</span>
          Create Job
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="jobs-tabs">
        <button
          className={`tab-btn ${activeTab === 'planned' ? 'active' : ''}`}
          onClick={() => setActiveTab('planned')}
        >
          <span className="tab-icon">📋</span>
          Planned Jobs
          <span className="tab-count">{plannedJobs.length}</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          <span className="tab-icon">✅</span>
          Past Jobs
          <span className="tab-count">{pastJobs.length}</span>
        </button>
      </div>

      {/* Jobs Content */}
      <div className="jobs-content">
        {isLoadingJobs ? (
          <div className="empty-state">
            <h3>Loading jobs...</h3>
            <p>Please wait while we fetch your jobs</p>
          </div>
        ) : activeTab === 'planned' ? (
          plannedJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No incoming jobs</h3>
              <p>Planned jobs will appear here</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {plannedJobs.map((job) => (
                <div key={job._id} className="job-card">
                  <div className="job-card-header">
                    <div className="job-title">
                      <span className="job-icon">🔧</span>
                      <h3>{job.title}</h3>
                    </div>
                    <div className={`job-status status-${job.status}`}>
                      {job.status}
                    </div>
                  </div>

                  <div className="job-card-body">
                    <div className="job-time">
                      <div className="time-item">
                        <span className="time-label">Start:</span>
                        <span className="time-value">
                          {new Date(job.startTime).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="time-item">
                        <span className="time-label">End:</span>
                        <span className="time-value">
                          {new Date(job.endTime).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {job.location && (
                      <div className="job-location">
                        <span className="location-icon">📍</span>
                        <span>{job.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="job-card-footer">
                    <button 
                      className="job-action-btn complete" 
                      title="Mark as Complete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteJob(job._id);
                      }}
                    >
                      ✅
                    </button>
                    <button 
                      className="job-action-btn" 
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditJob(job);
                      }}
                    >
                      ✏️
                    </button>
                    <button 
                      className="job-action-btn delete" 
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job._id);
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          pastJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No Past Jobs</h3>
              <p>Completed jobs will appear here</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {pastJobs.map((job) => (
                <div key={job._id} className="job-card past">
                  <div className="job-card-header">
                    <div className="job-title">
                      <span className="job-icon">✅</span>
                      <h3>{job.title}</h3>
                    </div>
                    <div className={`job-status status-${job.status}`}>
                      {job.status}
                    </div>
                  </div>

                  <div className="job-card-body">
                    <div className="job-time">
                      <div className="time-item">
                        <span className="time-label">Start:</span>
                        <span className="time-value">
                          {new Date(job.startTime).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="time-item">
                        <span className="time-label">End:</span>
                        <span className="time-value">
                          {new Date(job.endTime).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>

                    {job.location && (
                      <div className="job-location">
                        <span className="location-icon">📍</span>
                        <span>{job.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="job-card-footer">
                    <button 
                      className="job-action-btn delete" 
                      title="Delete Job"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job._id);
                      }}
                    >
                      🗑️
                    </button>
                    {job.invoiceId && (
                      <button 
                        className="job-action-btn" 
                        title="View Invoice"
                        onClick={(e) => {
                          e.stopPropagation();
                          console.log('View invoice:', job.invoiceId);
                        }}
                      >
                        📄
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Create Job Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div className="job-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Job' : 'Create New Job'}</h2>
              <button className="close-btn" onClick={closeCreateModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="job-form">
              {error && (
                <div className="error-banner">
                  <span>⚠️</span>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="title">
                  Job Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Website Development, Plumbing Repair"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="startTime">
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    id="startTime"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endTime">
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    id="endTime"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="predictedHours">
                  Predicted Hours
                </label>
                <input
                  type="number"
                  id="predictedHours"
                  name="predictedHours"
                  value={formData.predictedHours}
                  onChange={handleInputChange}
                  placeholder="0"
                  step="0.5"
                  min="0"
                  disabled={isSubmitting}
                />
                <small className="field-hint">Optional: For your planning reference</small>
              </div>

              <div className="form-group">
                <label htmlFor="materials">
                  Potential Materials Required
                </label>
                <textarea
                  id="materials"
                  name="materials"
                  value={formData.materials}
                  onChange={handleInputChange}
                  placeholder="List any materials or equipment needed..."
                  rows="4"
                  disabled={isSubmitting}
                />
                <small className="field-hint">Optional: For your planning reference</small>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="addClient"
                    checked={formData.addClient}
                    onChange={async (e) => {
                      const checked = e.target.checked;
                      setFormData(prev => ({
                        ...prev,
                        addClient: checked,
                        // Clear client fields when unchecking
                        selectedClientId: checked ? prev.selectedClientId : '',
                        clientName: checked ? prev.clientName : '',
                        clientEmail: checked ? prev.clientEmail : '',
                        clientAddress: checked ? prev.clientAddress : ''
                      }));
                      setShowCreateNewClient(false);
                      
                      // Fetch clients when checkbox is checked
                      if (checked && mongoUserId) {
                        await fetchClients();
                      }
                    }}
                    disabled={isSubmitting}
                  />
                  <span>Add a client</span>
                </label>
              </div>

              {formData.addClient && (
                <div className="client-fields-section">
                  <h3 className="section-title">Client Information</h3>
                  
                  {!showCreateNewClient ? (
                    <>
                      <div className="form-group">
                        <label htmlFor="selectedClientId">
                          Select Client
                        </label>
                        <select
                          id="selectedClientId"
                          name="selectedClientId"
                          value={formData.selectedClientId}
                          onChange={handleInputChange}
                          disabled={isSubmitting || loadingClients}
                          className="client-select"
                        >
                          <option value="">-- Select a client --</option>
                          {loadingClients ? (
                            <option value="" disabled>Loading clients...</option>
                          ) : clients.length === 0 ? (
                            <option value="" disabled>No clients found</option>
                          ) : (
                            clients.map((client) => (
                              <option key={client._id || client.id} value={client._id || client.id}>
                                {client.name || 'Unnamed Client'}
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="btn-create-new-client"
                        onClick={() => {
                          setShowCreateNewClient(true);
                          setFormData(prev => ({
                            ...prev,
                            selectedClientId: '' // Clear selection when creating new
                          }));
                        }}
                        disabled={isSubmitting}
                      >
                        + Create New Client
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="form-group">
                        <label htmlFor="clientName">
                          Client Name *
                        </label>
                        <input
                          type="text"
                          id="clientName"
                          name="clientName"
                          value={formData.clientName}
                          onChange={handleInputChange}
                          placeholder="Enter client name"
                          required={showCreateNewClient}
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="clientEmail">
                          Client Email
                        </label>
                        <input
                          type="email"
                          id="clientEmail"
                          name="clientEmail"
                          value={formData.clientEmail}
                          onChange={handleInputChange}
                          placeholder="client@example.com"
                          disabled={isSubmitting}
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor="clientAddress">
                          Client Address
                        </label>
                        <textarea
                          id="clientAddress"
                          name="clientAddress"
                          value={formData.clientAddress}
                          onChange={handleInputChange}
                          placeholder="Enter client address"
                          rows="3"
                          disabled={isSubmitting}
                        />
                      </div>

                      <button
                        type="button"
                        className="btn-cancel-new-client"
                        onClick={() => {
                          setShowCreateNewClient(false);
                          setFormData(prev => ({
                            ...prev,
                            clientName: '',
                            clientEmail: '',
                            clientAddress: ''
                          }));
                        }}
                        disabled={isSubmitting}
                      >
                        Cancel - Select Existing Client
                      </button>
                    </>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeCreateModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? (isEditing ? 'Updating...' : 'Creating...') : (isEditing ? 'Update Job' : 'Create Job')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Jobs;
