import React from 'react';
import Navbar from './components/Navbar';
import Main from './components/Main';
import NetworksPage from './components/NetworksPage';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StatisticsPage from './components/StatisticsPage';

const App = () => {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/networks" element={<NetworksPage />} />
        <Route path="/statistics" element={<StatisticsPage />} />
      </Routes>
    </Router>
  );
};

export default App;
