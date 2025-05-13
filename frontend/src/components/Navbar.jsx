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
      <button className="navbar-button" onClick={() => navigate('/networks')}>
        Vezi rețelele
      </button>
    </nav>
  );
};

export default Navbar;
