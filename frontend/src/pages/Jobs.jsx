import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './Jobs.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function Jobs() {
  const { user, isAuthenticated, getAccessTokenSilently } = useAuth0();
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
    materials: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mongoUserId, setMongoUserId] = useState(null);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);

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

  // Fetch jobs when mongoUserId is available
  useEffect(() => {
    const fetchJobs = async () => {
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
    };
    fetchJobs();
  }, [mongoUserId]);

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
      // Prepare job data for backend
      const jobData = {
        userId: mongoUserId,
        title: formData.title,
        status: 'pending',
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      };

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

        // Add to planned jobs list
        setPlannedJobs(prev => [...prev, createdJob]);
      }

      // Reset form and close modal
      setFormData({
        title: '',
        startTime: '',
        endTime: '',
        predictedHours: '',
        materials: ''
      });
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

  const handleEditJob = (job) => {
    setIsEditing(true);
    setEditingJobId(job._id);
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const startDate = new Date(job.startTime);
    const endDate = new Date(job.endTime);
    
    setFormData({
      title: job.title,
      startTime: formatDateTimeLocal(startDate),
      endTime: formatDateTimeLocal(endDate),
      predictedHours: '',
      materials: ''
    });
    
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

      // Update job status to completed
      const jobData = {
        userId: job.userId,
        title: job.title,
        status: 'completed',
        startTime: job.startTime,
        endTime: job.endTime,
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
      materials: ''
    });
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
                      className="job-action-btn" 
                      title="View Details"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('View details:', job._id);
                      }}
                    >
                      👁️
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
