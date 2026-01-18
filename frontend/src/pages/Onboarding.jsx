import { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css'; 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function Onboarding() {
  const { getAccessTokenSilently, user } = useAuth0();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [useSameEmail, setUseSameEmail] = useState(false);
  
  // Initialize all fields required by your Python UserBase model
  const [formData, setFormData] = useState({
    firstName: user?.given_name || '',
    lastName: user?.family_name || '',
    personalEmail: user?.email || '', // Prefilled from Auth0
    businessName: '',
    businessEmail: '',
    businessPhone: '', 
    businessAddress: '',
    businessCategory: 'Consulting',
    hourlyRate: 0
  });

  // Handle standard text inputs
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle the "Same as Personal Email" checkbox
  const handleCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    setUseSameEmail(isChecked);

    if (isChecked) {
      setFormData(prev => ({ ...prev, businessEmail: prev.personalEmail }));
    } else {
      // Optional: Clear it when unchecked, or leave it. Clearing is usually better UX here.
      setFormData(prev => ({ ...prev, businessEmail: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently({
        authorizationParams: {
          audience: "https://personalcfo.com"
        }
      });

      // Note: formData already contains personalEmail, so it will be sent automatically
      const response = await fetch(`${API_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      navigate('/');

    } catch (error) {
      console.error("Onboarding failed:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-wrapper" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      
      <div className="onboarding-card" style={{ maxWidth: '600px', width: '100%', backgroundColor: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#333' }}>Welcome to Your CFO 🚀</h2>
          <p style={{ color: '#666', marginTop: '8px' }}>Let's get your profile set up so we can generate your first invoice.</p>
        </div>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* --- Section 1: Personal Details --- */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#444', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Personal Details</h3>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>First Name</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Last Name</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required style={inputStyle} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Personal Email (Login Email)</label>
              <input 
                type="email" 
                name="personalEmail" 
                value={formData.personalEmail} 
                onChange={handleChange} 
                readOnly // Usually safer to keep this read-only if it comes from Auth0
                style={{ ...inputStyle, backgroundColor: '#f0f2f5', color: '#666', cursor: 'not-allowed' }} 
              />
            </div>
          </div>

          {/* --- Section 2: Business Details --- */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#444', marginBottom: '15px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Business Details</h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Business Name</label>
              <input type="text" name="businessName" value={formData.businessName} onChange={handleChange} placeholder="e.g. Acme Consulting Inc." required style={inputStyle} />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Business Email</label>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                 <input 
                  type="checkbox" 
                  id="sameEmail" 
                  checked={useSameEmail} 
                  onChange={handleCheckboxChange}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <label htmlFor="sameEmail" style={{ fontSize: '14px', color: '#666', cursor: 'pointer' }}>Use same as personal email</label>
              </div>
              
              <input 
                type="email" 
                name="businessEmail" 
                value={formData.businessEmail} 
                onChange={handleChange} 
                required 
                disabled={useSameEmail} // Disable typing if the checkbox is checked
                placeholder="invoices@acme.com"
                style={useSameEmail ? { ...inputStyle, backgroundColor: '#f0f2f5' } : inputStyle} 
              />
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Business Phone</label>
                <input type="tel" name="businessPhone" value={formData.businessPhone} onChange={handleChange} placeholder="+1 (555) 000-0000" required style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Hourly Rate ($)</label>
                <input type="number" name="hourlyRate" min="0" value={formData.hourlyRate} onChange={handleChange} required style={inputStyle} />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={labelStyle}>Business Address</label>
              <input type="text" name="businessAddress" value={formData.businessAddress} onChange={handleChange} placeholder="123 Business Rd, Montreal, QC" required style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Industry / Category</label>
              <select name="businessCategory" value={formData.businessCategory} onChange={handleChange} style={inputStyle}>
                <option value="">Select a category</option>
                <option value="Consulting">Consulting</option>
                <option value="Construction">Construction</option>
                <option value="Design">Design</option>
                <option value="Development">Development</option>
                <option value="Electrician">Electrician</option>
                <option value="Marketing">Marketing</option>
                <option value="Photography">Photography</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Retail">Retail</option>
                <option value="Software">Software Development</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            style={{ 
              marginTop: '10px',
              padding: '14px', 
              backgroundColor: '#2563EB', // Nice blue
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              fontSize: '16px',
              fontWeight: '600',
              cursor: isLoading ? 'wait' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Setting up Profile...' : 'Complete Setup & Go to Dashboard →'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Simple internal styles to keep the file self-contained
const labelStyle = {
  display: 'block',
  fontSize: '14px',
  fontWeight: '500',
  color: '#374151',
  marginBottom: '6px'
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '6px',
  border: '1px solid #D1D5DB',
  fontSize: '15px',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box' // Important for padding
};

export default Onboarding;