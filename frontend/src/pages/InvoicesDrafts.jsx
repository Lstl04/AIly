import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { generatePDF } from '../utils/pdfGenerator';
import './Invoices.css';

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
  const [clients, setClients] = useState([]);
  const [pendingJobs, setPendingJobs] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showCreateNewClient, setShowCreateNewClient] = useState(false);
  const [showCreateNewJob, setShowCreateNewJob] = useState(false);
  
  const [formData, setFormData] = useState({
    selectedClientId: '',
    clientName: '',
    clientEmail: '',
    clientAddress: '',
    selectedJobId: '',
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

  // Fetch clients and jobs when modal opens
  useEffect(() => {
    if (showCreateModal && userProfile) {
      fetchClients();
      fetchPendingJobs();
    }
  }, [showCreateModal, userProfile]);

  const fetchClients = async () => {
    if (!userProfile) return;
    
    setLoadingClients(true);
    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      const response = await fetch(`${API_URL}/clients/?user_id=${userProfile._id}&archived=false`, {
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

  const fetchPendingJobs = async () => {
    if (!userProfile) return;
    
    setLoadingJobs(true);
    try {
      // Fetch all jobs and filter for pending/in_progress
      const response = await fetch(`${API_URL}/jobs/?user_id=${userProfile._id}`);
      if (response.ok) {
        const allJobs = await response.json();
        // Filter for pending and in_progress jobs
        const pending = allJobs.filter(job => job.status === 'pending' || job.status === 'in_progress');
        setPendingJobs(pending || []);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  };

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
      const response = await fetch(`${API_URL}/invoices/?user_id=${userId}&status_filter=draft`, {
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

      // Step 1: Get or create client (only if not editing)
      let createdClientId = "";
      if (!editingInvoiceId) {
        // If a client is selected from dropdown, use that
        if (formData.selectedClientId) {
          createdClientId = formData.selectedClientId;
        } 
        // If creating new client, create it first
        else if (showCreateNewClient && formData.clientName.trim()) {
          const clientData = {
            userId: userProfile._id,
            name: formData.clientName.trim(),
            email: formData.clientEmail.trim() || undefined,
            address: formData.clientAddress.trim() || undefined,
            archived: false
          };

          console.log('Creating client with data:', clientData);

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
            console.error('Client creation error:', errorData);
            throw new Error(errorData.detail || 'Failed to create client');
          }

          const client = await clientResponse.json();
          console.log('Client created:', client);
          createdClientId = client._id || client.id;
        } else {
          throw new Error('Please select a client or create a new one');
        }
      } else {
        // When editing, use existing clientId from invoice
        if (clientInfo && clientInfo._id) {
          createdClientId = clientInfo._id;
        }
      }

      // Step 1.5: Get or create job
      let createdJobId = "";
      let isNewJobCreated = false;
      
      // If a job is selected from dropdown, use that (DO NOT CREATE NEW JOB)
      if (formData.selectedJobId && formData.selectedJobId.trim()) {
        createdJobId = formData.selectedJobId.trim();
        console.log('✓ Using existing job from dropdown:', createdJobId);
      } 
      // If creating new job, create it first (ONLY if no job was selected)
      else if (showCreateNewJob && formData.jobTitle.trim() && !formData.selectedJobId) {
        console.log('Creating new job (no existing job selected)');
        isNewJobCreated = true;
        const jobData = {
          userId: userProfile._id,
          title: formData.jobTitle.trim(),
          status: 'pending',
          startTime: new Date().toISOString(), // Default to now
          endTime: new Date(Date.now() + 3600000).toISOString(), // Default to 1 hour from now
        };

        // Add clientId if client was selected/created
        if (createdClientId) {
          jobData.clientId = createdClientId;
        }

        // Add location if client has address
        if (createdClientId) {
          try {
            const clientResponse = await fetch(`${API_URL}/clients/${createdClientId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (clientResponse.ok) {
              const client = await clientResponse.json();
              if (client.address) {
                jobData.location = client.address;
              }
            }
          } catch (err) {
            console.error('Error fetching client for location:', err);
          }
        }

        console.log('Creating job with data:', jobData);

        const jobResponse = await fetch(`${API_URL}/jobs/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jobData),
        });

        if (!jobResponse.ok) {
          const errorData = await jobResponse.json().catch(() => ({}));
          console.error('Job creation error:', errorData);
          throw new Error(errorData.detail || 'Failed to create job');
        }

        const job = await jobResponse.json();
        console.log('Job created:', job);
        createdJobId = job._id || job.id;
      }
      // If no job selected and not creating new, jobId remains empty string

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
      // Get job title and description from selected job or form data
      let invoiceTitle = formData.jobTitle || '';
      let invoiceDescription = formData.jobDescription || '';
      
      // If job is selected, fetch job details to get title
      if (formData.selectedJobId && !showCreateNewJob) {
        try {
          const jobResponse = await fetch(`${API_URL}/jobs/${formData.selectedJobId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (jobResponse.ok) {
            const job = await jobResponse.json();
            invoiceTitle = job.title || invoiceTitle;
          }
        } catch (err) {
          console.error('Error fetching job details:', err);
        }
      }

      const invoiceData = {
        userId: userProfile._id,
        clientId: createdClientId,
        jobId: createdJobId || "",
        invoiceTitle: invoiceTitle,
        invoiceDescription: invoiceDescription,
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
        invoiceResponse = await fetch(`${API_URL}/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invoiceData),
        });
      } else {
        // Create new invoice
        invoiceResponse = await fetch(`${API_URL}/invoices/`, {
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

      // If invoice was created (not edited) and has a jobId, mark the job as completed
      // IMPORTANT: Only mark as completed if it was an EXISTING job (selected from dropdown), not a newly created one
      if (!editingInvoiceId && invoice.jobId && invoice.jobId.trim() && !isNewJobCreated && formData.selectedJobId) {
        try {
          const jobId = invoice.jobId.trim();
          console.log('=== MARKING JOB AS COMPLETED ===');
          console.log('Invoice jobId:', jobId);
          console.log('Invoice data:', invoice);
          
          // Fetch the job to get its current data and check for calendar event
          const jobResponse = await fetch(`${API_URL}/jobs/${jobId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (!jobResponse.ok) {
            console.error('Failed to fetch job for completion:', jobId);
            return; // Don't fail invoice creation
          }
          
          const job = await jobResponse.json();
          
          // Delete Google Calendar event if it exists (completed jobs shouldn't have events)
          if (job.googleCalendarEventId) {
            try {
              const googleToken = localStorage.getItem('google_calendar_token');
              const calendarId = localStorage.getItem('google_calendar_selected_id') || 'primary';
              
              if (googleToken) {
                const tokenExpiry = localStorage.getItem('google_calendar_token_expiry');
                if (!tokenExpiry || Date.now() < parseInt(tokenExpiry)) {
                  await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(job.googleCalendarEventId)}`,
                    {
                      method: 'DELETE',
                      headers: {
                        Authorization: `Bearer ${googleToken}`,
                      },
                    }
                  );
                  console.log('Deleted Google Calendar event:', job.googleCalendarEventId);
                }
              }
            } catch (error) {
              console.error('Failed to delete Google Calendar event:', error);
              // Don't fail job completion if calendar event deletion fails
            }
          }
          
          // Update job status to completed - only send status
          const updatePayload = {
            status: 'completed',
            googleCalendarEventId: '' // Clear the event ID
          };
          
          console.log('Updating job status to completed:', jobId, updatePayload);
          
          const updateJobResponse = await fetch(`${API_URL}/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
          });
          
          if (updateJobResponse.ok) {
            const updatedJob = await updateJobResponse.json();
            console.log('Job successfully marked as completed:', updatedJob);
            
            // Verify the status was actually updated
            if (updatedJob.status !== 'completed') {
              console.error('ERROR: Job status was not updated to completed. Current status:', updatedJob.status);
              console.error('Job data:', updatedJob);
            } else {
              console.log('✓ Job status confirmed as completed. Job ID:', updatedJob._id || updatedJob.id);
              
              // Double-check by fetching the job again
              const verifyResponse = await fetch(`${API_URL}/jobs/${jobId}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });
              if (verifyResponse.ok) {
                const verifiedJob = await verifyResponse.json();
                console.log('Verification - Job status:', verifiedJob.status, 'Job ID:', verifiedJob._id || verifiedJob.id);
                if (verifiedJob.status !== 'completed') {
                  console.error('CRITICAL: Job status verification failed! Status is still:', verifiedJob.status);
                }
              }
            }
          } else {
            const errorData = await updateJobResponse.json().catch(() => ({}));
            console.error('Failed to update job status. Response status:', updateJobResponse.status);
            console.error('Error data:', errorData);
            // Don't fail invoice creation if job completion fails
          }
        } catch (error) {
          console.error('Failed to mark job as completed:', error);
          // Don't fail invoice creation if job completion fails
        }
      }

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
      const response = await fetch(`${API_URL}/invoices/${invoiceId}/details`, {
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
        selectedClientId: invoice.clientId || '',
        clientName: clientName,
        clientEmail: clientEmail,
        clientAddress: clientAddress,
        selectedJobId: invoice.jobId || '',
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
      
      // Fetch clients and jobs when editing (to populate dropdowns)
      await fetchClients();
      await fetchPendingJobs();

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

      const response = await fetch(`${API_URL}/invoices/${invoiceId}`, {
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

      const response = await fetch(`${API_URL}/invoices/${invoiceId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'sent' }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to send invoice');
      }

      const result = await response.json();
      
      // Remove from local state (it will appear in Sent section)
      setInvoices(prev => prev.filter(inv => inv._id !== invoiceId));
      alert('Invoice sent successfully! An email has been sent to the client.');

    } catch (error) {
      console.error('Error sending invoice:', error);
      alert('Failed to send invoice. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      selectedClientId: '',
      clientName: '',
      clientEmail: '',
      clientAddress: '',
      selectedJobId: '',
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
    setShowCreateNewClient(false);
    setShowCreateNewJob(false);
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
          <h1>Draft Invoices</h1>
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
                  <span className="invoice-icon"></span>
                  <h3>{invoice.invoiceNumber || 'Draft'}</h3>
                </div>
                <div className="invoice-status status-draft">
                  Draft
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
                  onClick={() => handleSendInvoice(invoice._id)}
                >
                  <span>Send</span>
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
                  Edit
                </button>
                <button 
                  className="invoice-action-btn"
                  onClick={() => handleDownloadPDF(invoice._id)}
                >
                  Download PDF
                </button>
                <button 
                  className="invoice-action-btn delete"
                  onClick={() => handleDeleteInvoice(invoice._id)}
                >
                  Delete
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
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading invoice data...</p>
              </div>
            ) : (
            <form onSubmit={handleCreateInvoice} className="invoice-form">
              {/* Job Information */}
              <div className="form-section">
                <h3>Job Details</h3>
                
                {!showCreateNewJob ? (
                  <>
                    <div className="form-group">
                      <label>Select Job (Optional)</label>
                      <select
                        name="selectedJobId"
                        value={formData.selectedJobId}
                        onChange={async (e) => {
                          handleInputChange(e);
                          // If a job is selected, fetch its details to populate title and auto-select client
                          if (e.target.value) {
                            const selectedJob = pendingJobs.find(j => (j._id || j.id) === e.target.value);
                            if (selectedJob) {
                              const updates = {
                                selectedJobId: e.target.value,
                                jobTitle: selectedJob.title || formData.jobTitle
                              };
                              
                              // If job has a clientId, automatically select that client
                              if (selectedJob.clientId) {
                                const clientId = selectedJob.clientId.toString();
                                // Check if this client exists in the clients list
                                const clientExists = clients.some(c => (c._id || c.id) === clientId);
                                if (clientExists) {
                                  updates.selectedClientId = clientId;
                                  setShowCreateNewClient(false); // Make sure we're not in "create new" mode
                                } else {
                                  // If client not in list, fetch it or log a warning
                                  console.warn('Job has clientId but client not found in clients list:', clientId);
                                }
                              }
                              
                              setFormData(prev => ({ ...prev, ...updates }));
                            }
                          } else {
                            // If job is deselected, clear the job-related fields
                            setFormData(prev => ({
                              ...prev,
                              selectedJobId: '',
                              jobTitle: ''
                            }));
                          }
                        }}
                        disabled={loadingJobs}
                      >
                        <option value="">-- Select a job (optional) --</option>
                        {loadingJobs ? (
                          <option value="" disabled>Loading jobs...</option>
                        ) : pendingJobs.length === 0 ? (
                          <option value="" disabled>No pending jobs found</option>
                        ) : (
                          pendingJobs.map((job) => (
                            <option key={job._id || job.id} value={job._id || job.id}>
                              {job.title || 'Untitled Job'} {job.clientId ? '(with client)' : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                      <button
                      type="button"
                      className="btn-create-new-job"
                      onClick={() => {
                        setShowCreateNewJob(true);
                        setFormData(prev => ({ ...prev, selectedJobId: '' }));
                      }}
                    >
                      + Create New Job
                    </button>
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Job Title *</label>
                      <input
                        type="text"
                        name="jobTitle"
                        value={formData.jobTitle}
                        onChange={handleInputChange}
                        placeholder="e.g., Website Building"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Job Description</label>
                      <input
                        type="text"
                        name="jobDescription"
                        value={formData.jobDescription}
                        onChange={handleInputChange}
                        placeholder="e.g., built a full stack website"
                      />
                    </div>

                    <button
                      type="button"
                      className="btn-cancel-new-job"
                      onClick={() => {
                        setShowCreateNewJob(false);
                        setFormData(prev => ({
                          ...prev,
                          jobTitle: '',
                          jobDescription: ''
                        }));
                      }}
                    >
                      Cancel - Select Existing Job
                    </button>
                  </>
                )}

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

              {/* Client Information */}
              <div className="form-section">
                <h3>Client Information</h3>
                {editingInvoiceId && !clientInfo && (
                  <div className="info-banner">
                    <span>ℹ️</span> Client information not available for this invoice. Fields are disabled.
                  </div>
                )}
                
                {!showCreateNewClient ? (
                  <>
                    <div className="form-group">
                      <label>Select Client *</label>
                      <select
                        name="selectedClientId"
                        value={formData.selectedClientId}
                        onChange={handleInputChange}
                        required={!editingInvoiceId}
                        disabled={!!editingInvoiceId || loadingClients}
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
                      {editingInvoiceId && <small>Client cannot be changed when editing</small>}
                    </div>

                    {!editingInvoiceId && (
                      <button
                        type="button"
                        className="btn-create-new-client"
                        onClick={() => {
                          setShowCreateNewClient(true);
                          setFormData(prev => ({ ...prev, selectedClientId: '' }));
                        }}
                      >
                        + Add New Client
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <div className="form-group">
                      <label>Client Name *</label>
                      <input
                        type="text"
                        name="clientName"
                        value={formData.clientName}
                        onChange={handleInputChange}
                        required
                        placeholder="Enter client name"
                      />
                    </div>

                    <div className="form-group">
                      <label>Client Email</label>
                      <input
                        type="email"
                        name="clientEmail"
                        value={formData.clientEmail}
                        onChange={handleInputChange}
                        placeholder="client@example.com"
                      />
                    </div>

                    <div className="form-group">
                      <label>Client Address</label>
                      <input
                        type="text"
                        name="clientAddress"
                        value={formData.clientAddress}
                        onChange={handleInputChange}
                        placeholder="Enter client address"
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
                    >
                      Cancel - Select Existing Client
                    </button>
                  </>
                )}
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
