import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/NetworksButton.css'; // importul fișierului CSS

const NetworksButton = () => {
  const navigate = useNavigate();

  const navigateToNetworksPage = () => {
    navigate('/networks');
  };

  return (
    <button className="networks-button" onClick={navigateToNetworksPage}>
      Vezi rețelele
    </button>
  );
};

export default NetworksButton;
