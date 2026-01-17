import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // TODO: Replace with Auth0 logout later
    navigate('/');
  };

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h1>💰 My Personal CFO</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome back! 👋</h2>
          <p>Your financial dashboard is ready</p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3>Financial Overview</h3>
            <p>Coming soon: View your spending patterns and insights</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">💳</div>
            <h3>Transactions</h3>
            <p>Coming soon: Track all your transactions</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🎯</div>
            <h3>Budgets</h3>
            <p>Coming soon: Set and manage your budgets</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">🤖</div>
            <h3>AI Insights</h3>
            <p>Coming soon: Get personalized financial advice</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
