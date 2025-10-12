import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await api.post('/auth/login', { email, password });
      
      // Save to localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      alert('✅ Login successful!');
      navigate('/dashboard');
      window.location.reload(); // Force reload to update navbar
    } catch (error) {
      console.error('Login error:', error);
      alert('❌ Login failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'}}>
      <div style={{maxWidth: '400px', width: '100%', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(255,255,255,0.2)'}}>
        <div style={{textAlign: 'center', marginBottom: '2rem'}}>
          <h2 style={{fontSize: '2rem', color: 'white'}}>Project Catalyst</h2>
          <p style={{color: 'rgba(255,255,255,0.7)'}}>Blockchain-Enabled Trust Engine</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '1rem'}}>
            <label style={{display: 'block', color: 'white', marginBottom: '0.5rem'}}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{width: '100%', padding: '0.75rem', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white'}}
              required 
            />
          </div>
          
          <div style={{marginBottom: '1.5rem'}}>
            <label style={{display: 'block', color: 'white', marginBottom: '0.5rem'}}>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{width: '100%', padding: '0.75rem', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: 'white'}}
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'}}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          
          <p style={{textAlign: 'center', marginTop: '1rem', color: 'rgba(255,255,255,0.7)'}}>
            Don't have an account? <a href="/register" style={{color: 'white', textDecoration: 'underline'}}>Register</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;
