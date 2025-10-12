import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, LogOut, User, Shield, Upload, History, Users, DollarSign } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-white/10 backdrop-blur-md border-b border-white/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/dashboard" className="flex items-center space-x-2 text-white font-bold text-xl">
              <Shield className="h-6 w-6" />
              <span className="hidden md:block">Project Catalyst</span>
            </Link>
            
            <div className="hidden md:flex space-x-4">
              <Link to="/dashboard" className="flex items-center space-x-1 text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>
              
              <Link to="/ngos" className="flex items-center space-x-1 text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                <Users className="h-4 w-4" />
                <span>NGOs</span>
              </Link>
              
              {user.role === 'ngo_admin' && (
                <>
                  <Link to="/ngo/register" className="text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                    Register NGO
                  </Link>
                  <Link to="/proof-upload" className="flex items-center space-x-1 text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                    <Upload className="h-4 w-4" />
                    <span>Upload Proof</span>
                  </Link>
                </>
              )}
              
              {user.role === 'donor' && (
                <Link to="/donate" className="flex items-center space-x-1 text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                  <DollarSign className="h-4 w-4" />
                  <span>Donate</span>
                </Link>
              )}
              
              <Link to="/donations" className="flex items-center space-x-1 text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                <History className="h-4 w-4" />
                <span>History</span>
              </Link>
              
              {user.role === 'admin' && (
                <Link to="/admin" className="text-white/80 hover:text-white px-3 py-2 rounded-md transition">
                  Admin
                </Link>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-white">
              <User className="h-5 w-5" />
              <span className="hidden md:block">{user.fullName}</span>
              <span className="text-xs bg-white/20 px-2 py-1 rounded">{user.role}</span>
            </div>
            
            <button onClick={handleLogout} className="flex items-center space-x-2 bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-md transition">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:block">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
