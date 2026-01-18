// API URL configuration
// In development, use relative path to leverage Vite proxy
// In production, use full URL from environment variable
const getApiUrl = () => {
  // If VITE_API_URL is set, use it (for production or custom setup)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, use relative path which will be proxied by Vite
  // The proxy in vite.config.js will forward /api to http://localhost:8000/api
  if (import.meta.env.DEV) {
    return '/api';
  }
  
  // Fallback for production if no env var is set
  return 'http://localhost:8000/api';
};

export const API_URL = getApiUrl();
