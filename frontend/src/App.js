import React from 'react';
import Navbar from './components/Navbar';
import Main from './components/Main';
import NetworksPage from './components/NetworksPage'; // dacă folosești routing
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/networks" element={<NetworksPage />} />
      </Routes>
    </Router>
  );
};

export default App;
