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
        <h1>💰 My Personal CFO</h1>
        <p>Your AI-powered financial assistant</p>
        <button onClick={() => loginWithRedirect()} className="login-button">
          Log In / Sign Up
        </button>
      </div>
    </div>
  );
}

export default Login;
