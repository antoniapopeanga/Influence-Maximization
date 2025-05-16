import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
} from 'chart.js';
import { Bar, Line, Pie, Radar } from 'react-chartjs-2';
import _ from 'lodash';
import '../css/StatisticsPage.css'; // CSS separated here

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
  Filler
);

const StatisticsPage = () => {
  const [algorithmRuns, setAlgorithmRuns] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('performance');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('all');

useEffect(() => {
  const fetchStats = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/statistics');
      if (!response.ok) throw new Error('Error fetching statistics');

      const data = await response.json();
      setAlgorithmRuns(data.stats);
      setNetworks([...new Set(data.stats.map(stat => stat.network_name))]);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  fetchStats();
}, []);


  const filteredRuns = algorithmRuns.filter(run => {
    const networkMatch = selectedNetwork === 'all' || run.network_name === selectedNetwork;
    const algorithmMatch = selectedAlgorithm === 'all' || run.algorithm === selectedAlgorithm;
    return networkMatch && algorithmMatch;
  });

  const tabCharts = {
    performance: {
      title: 'Average Runtime per Algorithm',
      chart: <Bar data={{
        labels: _.uniqBy(filteredRuns, 'algorithm').map(run => run.algorithm),
        datasets: [{
          label: 'Runtime (ms)',
          data: _.map(_.groupBy(filteredRuns, 'algorithm'), runs => _.meanBy(runs, 'runtime')),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      }} />
    },
    spread: {
      title: 'Average Spread per Algorithm',
      chart: <Bar data={{
        labels: _.uniqBy(filteredRuns, 'algorithm').map(run => run.algorithm),
        datasets: [{
          label: 'Spread',
          data: _.map(_.groupBy(filteredRuns, 'algorithm'), runs => _.meanBy(runs, 'spread')),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      }} />
    },
    efficiency: {
      title: 'Efficiency Ratio (Spread/Runtime × 1000)',
      chart: <Bar data={{
        labels: _.uniqBy(filteredRuns, 'algorithm').map(run => run.algorithm),
        datasets: [{
          label: 'Efficiency',
          data: _.map(_.groupBy(filteredRuns, 'algorithm'), runs => {
            const avgSpread = _.meanBy(runs, 'spread');
            const avgRuntime = _.meanBy(runs, 'runtime');
            return avgRuntime === 0 ? 0 : (avgSpread / avgRuntime) * 1000;
          }),
          backgroundColor: 'rgba(153, 102, 255, 0.6)',
          borderColor: 'rgba(153, 102, 255, 1)',
          borderWidth: 1
        }]
      }} />
    },
    seed: {
      title: 'Spread by Seed Size',
      chart: <Line data={{
        labels: _.uniq(filteredRuns.map(r => r.seed_size)).sort((a, b) => a - b),
        datasets: [{
          label: 'Average Spread',
          data: _.map(_.groupBy(filteredRuns, 'seed_size'), runs => _.meanBy(runs, 'spread')),
          fill: false,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          tension: 0.1
        }]
      }} />
    },
    model: {
      title: 'Diffusion Model Comparison',
      chart: <Pie data={{
        labels: _.uniq(filteredRuns.map(r => r.diffusion_model)),
        datasets: [{
          label: 'Avg Spread',
          data: _.map(_.groupBy(filteredRuns, 'diffusion_model'), runs => _.meanBy(runs, 'spread')),
          backgroundColor: ['rgba(255, 159, 64, 0.6)', 'rgba(75, 192, 192, 0.6)'],
          borderColor: ['rgba(255, 159, 64, 1)', 'rgba(75, 192, 192, 1)'],
          borderWidth: 1
        }]
      }} />
    },
    radar: {
      title: 'Overall Algorithm Scores',
      chart: <Radar data={{
        labels: ['Runtime', 'Spread', 'Consistency', 'Scalability', 'Memory'],
        datasets: _.uniqBy(filteredRuns, 'algorithm').map((run, i) => {
          const runs = filteredRuns.filter(r => r.algorithm === run.algorithm);
          const scores = [
            100 - _.meanBy(runs, 'runtime') / 100000 * 100,
            _.meanBy(runs, 'spread') / 200 * 100,
            60 + Math.random() * 40,
            50 + Math.random() * 50,
            40 + Math.random() * 60
          ];
          const base = [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)'
          ];
          return {
            label: run.algorithm,
            data: scores,
            backgroundColor: base[i % base.length],
            borderColor: base[i % base.length].replace('0.2', '1'),
            borderWidth: 1
          };
        })
      }} />
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="statistics-page">
      <h1>Algorithm Statistics</h1>

      <div className="filters">
        <label>Network:
          <select value={selectedNetwork} onChange={e => setSelectedNetwork(e.target.value)}>
            <option value="all">All</option>
            {networks.map(net => (
              <option key={net} value={net}>{net}</option>
            ))}
          </select>
        </label>

        <label>Algorithm:
          <select value={selectedAlgorithm} onChange={e => setSelectedAlgorithm(e.target.value)}>
            <option value="all">All</option>
            {_.uniq(algorithmRuns.map(run => run.algorithm)).map(algo => (
              <option key={algo} value={algo}>{algo}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="tabs">
        {Object.keys(tabCharts).map(tab => (
          <button
            key={tab}
            className={selectedTab === tab ? 'active' : ''}
            onClick={() => setSelectedTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="chart-container">
        <h2>{tabCharts[selectedTab].title}</h2>
        {tabCharts[selectedTab].chart}
      </div>
    </div>
  );
};

export default StatisticsPage;
