import { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import './Onboarding.css'; 

function Onboarding() {
  const { getAccessTokenSilently, user } = useAuth0();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // UPDATED: Keys now match your Python UserBase model (camelCase)
  const [formData, setFormData] = useState({
    firstName: user?.given_name || '',
    lastName: user?.family_name || '',
    businessName: '',
    businessPhone: '', 
    businessAddress: '',
    businessCategory: 'Consulting',
    hourlyRate: 0
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently();

      const response = await fetch('http://127.0.0.1:8000/api/users/profile', {
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

      navigate('/dashboard');

    } catch (error) {
      console.error("Onboarding failed:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="onboarding-container" style={{ maxWidth: '500px', margin: '50px auto', padding: '30px', border: '1px solid #eee', borderRadius: '10px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Setup Your Business Profile 🚀</h2>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* First Name & Last Name (Optional but good to have) */}
        <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>First Name</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
            </div>
            <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold' }}>Last Name</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required style={{ width: '100%', padding: '8px' }} />
            </div>
        </div>

        {/* Business Name */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Business Name</label>
          <input type="text" name="businessName" required value={formData.businessName} onChange={handleChange} placeholder="e.g. Acme Consulting" style={{ width: '100%', padding: '10px' }} />
        </div>

        {/* Business Phone */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Business Phone</label>
          <input type="text" name="businessPhone" required value={formData.businessPhone} onChange={handleChange} placeholder="e.g. +1 555-0199" style={{ width: '100%', padding: '10px' }} />
        </div>

        {/* Business Address */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Business Address</label>
          <input type="text" name="businessAddress" required value={formData.businessAddress} onChange={handleChange} placeholder="e.g. 123 Main St" style={{ width: '100%', padding: '10px' }} />
        </div>

        {/* Category */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Category</label>
          <select name="businessCategory" value={formData.businessCategory} onChange={handleChange} style={{ width: '100%', padding: '10px' }}>
            <option value="Consulting">Consulting</option>
            <option value="Plumbing">Plumbing</option>
            <option value="Electrician">Electrician</option>
            <option value="Retail">Retail</option>
            <option value="Software">Software Development</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Hourly Rate */}
        <div className="form-group">
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Hourly Rate ($)</label>
          <input type="number" name="hourlyRate" required min="0" value={formData.hourlyRate} onChange={handleChange} style={{ width: '100%', padding: '10px' }} />
        </div>

        <button type="submit" disabled={isLoading} style={{ marginTop: '10px', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          {isLoading ? 'Saving...' : 'Complete Setup'}
        </button>
      </form>
    </div>
  );
}

export default Onboarding;