import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
  const { loginWithRedirect, isAuthenticated, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>AIly</h1>
          <p className="login-subtitle">Your AI-powered financial assistant</p>
        </div>
        <button onClick={() => loginWithRedirect()} className="login-button">
          Log In / Sign Up
        </button>
        {error && (
          <div className="login-error">
            Authentication error. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
