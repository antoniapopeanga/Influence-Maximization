import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="navbar-title" onClick={() => navigate('/')}>
        GraphNet
      </div>
      <div className="navbar-buttons">
        <button className="navbar-button" onClick={() => navigate('/networks')}>
          See the Networks
        </button>
        <button className="navbar-statistics" onClick={() => navigate('/statistics')}>
          Performance Statistics
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
