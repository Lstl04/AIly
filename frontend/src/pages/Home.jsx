import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import './Home.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function Home() {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const [isSyncing, setIsSyncing] = useState(true);
  const [mongoUserId, setMongoUserId] = useState(null);
  const [stats, setStats] = useState({
    jobsCount: 0,
    completedJobs: 0,
    pendingJobs: 0,
    expensesTotal: 0,
    expensesCount: 0
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);

  // Sync user on mount
  useEffect(() => {
    const syncUser = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: "https://personalcfo.com"
          }
        });

        const response = await fetch(`${API_URL}/users/sync`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log("User Sync Result:", data);

        if (data.onboarding_complete === false) {
          navigate('/onboarding');
        } else {
          setIsSyncing(false);
        }

      } catch (error) {
        console.error("Error syncing user:", error);
        setIsSyncing(false);
      }
    };

    syncUser();
  }, [getAccessTokenSilently, navigate]);

  // Fetch MongoDB user ID
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

  // Fetch dashboard data when user ID is available
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!mongoUserId) return;

      try {
        // Fetch jobs
        const jobsResponse = await fetch(`${API_URL}/jobs/?user_id=${mongoUserId}`);
        if (jobsResponse.ok) {
          const jobs = await jobsResponse.json();
          const completed = jobs.filter(j => j.status === 'completed').length;
          const pending = jobs.filter(j => j.status !== 'completed').length;
          
          setStats(prev => ({
            ...prev,
            jobsCount: jobs.length,
            completedJobs: completed,
            pendingJobs: pending
          }));
          
          // Get 3 most recent jobs
          setRecentJobs(jobs.slice(0, 3));
        }

        // Fetch expenses
        const expensesResponse = await fetch(`${API_URL}/expenses/?user_id=${mongoUserId}`);
        if (expensesResponse.ok) {
          const expenses = await expensesResponse.json();
          const total = expenses.reduce((sum, exp) => sum + (exp.totalAmount || 0), 0);
          
          setStats(prev => ({
            ...prev,
            expensesTotal: total,
            expensesCount: expenses.length
          }));
          
          // Get 3 most recent expenses
          setRecentExpenses(expenses.slice(0, 3));
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      }
    };

    fetchDashboardData();
  }, [mongoUserId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  if (isSyncing) {
    return (
      <div className="home-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Welcome back{user?.given_name ? `, ${user.given_name}` : ''}! 👋</h1>
        <p className="subtitle">Your financial management dashboard</p>
      </div>

      <div className="home-content">
        {/* Stats Cards */}
        <div className="stats-section">
          <div className="stat-card jobs">
            <div className="stat-icon">🔧</div>
            <div className="stat-info">
              <span className="stat-value">{stats.jobsCount}</span>
              <span className="stat-label">Total Jobs</span>
            </div>
            <div className="stat-breakdown">
              <span className="stat-detail pending">{stats.pendingJobs} pending</span>
              <span className="stat-detail completed">{stats.completedJobs} completed</span>
            </div>
          </div>

          <div className="stat-card expenses">
            <div className="stat-icon">🧾</div>
            <div className="stat-info">
              <span className="stat-value">{formatCurrency(stats.expensesTotal)}</span>
              <span className="stat-label">Total Expenses</span>
            </div>
            <div className="stat-breakdown">
              <span className="stat-detail">{stats.expensesCount} receipts</span>
            </div>
          </div>

          <div className="stat-card revenue">
            <div className="stat-icon">💰</div>
            <div className="stat-info">
              <span className="stat-value">Coming Soon</span>
              <span className="stat-label">Revenue</span>
            </div>
          </div>

          <div className="stat-card profit">
            <div className="stat-icon">📈</div>
            <div className="stat-info">
              <span className="stat-value">Coming Soon</span>
              <span className="stat-label">Net Profit</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="action-buttons">
            <button className="action-btn primary" onClick={() => navigate('/expenses')}>
              <span className="btn-icon">📸</span>
              Scan Receipt
            </button>
            <button className="action-btn secondary" onClick={() => navigate('/jobs')}>
              <span className="btn-icon">🔧</span>
              New Job
            </button>
            <button className="action-btn secondary" onClick={() => navigate('/calendar')}>
              <span className="btn-icon">📅</span>
              Calendar
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="recent-activity">
          <h2>Recent Activity</h2>
          
          {recentJobs.length === 0 && recentExpenses.length === 0 ? (
            <div className="activity-placeholder">
              <p>📭 No recent activity</p>
              <span className="placeholder-text">Your recent jobs and expenses will appear here</span>
            </div>
          ) : (
            <div className="activity-list">
              {recentJobs.map(job => (
                <div key={job._id} className="activity-item job">
                  <span className="activity-icon">🔧</span>
                  <div className="activity-content">
                    <span className="activity-title">{job.title}</span>
                    <span className="activity-meta">
                      {job.status} • {formatDate(job.startTime)}
                    </span>
                  </div>
                </div>
              ))}
              
              {recentExpenses.map(expense => (
                <div key={expense._id} className="activity-item expense">
                  <span className="activity-icon">🧾</span>
                  <div className="activity-content">
                    <span className="activity-title">{expense.vendorName || 'Expense'}</span>
                    <span className="activity-meta">
                      {formatCurrency(expense.totalAmount)} • {formatDate(expense.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
