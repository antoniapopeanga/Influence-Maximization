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
  Filler,
  ScatterController,
  TimeScale
} from 'chart.js';
import { Bar, Line, Pie, Radar, Scatter } from 'react-chartjs-2';
import _ from 'lodash';
import '../css/StatisticsPage.css';

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
  Filler,
  ScatterController,
  PointElement,
  TimeScale
);

const StatisticsPage = () => {
  const [algorithmRuns, setAlgorithmRuns] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [networkStats, setNetworkStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('coverage');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [selectedAlgorithm, setSelectedAlgorithm] = useState('all');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/statistics');
        if (!response.ok) throw new Error('Error fetching statistics');

        const data = await response.json();
        console.log("Fetched data:", data);
        
        if (!data.stats || data.stats.length === 0) {
          console.error("No statistics data available");
          setLoading(false);
          return;
        }
        
        setAlgorithmRuns(data.stats);
        setNetworks([...new Set(data.stats.map(stat => stat.network_name))]);
        
        const networkStatsMap = {};
        data.stats.forEach(stat => {
          if (stat.network_name && !networkStatsMap[stat.network_name]) {
            networkStatsMap[stat.network_name] = {
              name: stat.network_name,
              num_nodes: stat.num_nodes,
              num_edges: stat.num_edges,
              average_degree: stat.average_degree,
              clustering_coeff: stat.clustering_coeff
            };
          }
        });
        
        setNetworkStats(Object.values(networkStatsMap));
        setLoading(false);
      } catch (error) {
        console.error("Error in fetchStats:", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // calculam spread/nr total noduri
const processRunsWithCoverage = () => {
  const maxSpread = Math.max(...algorithmRuns.map(run => run.spread || 0));
  const maxRuntime = Math.max(...algorithmRuns.map(run => run.runtime || 1));

  return algorithmRuns.map(run => {
    const totalNodes = run.num_nodes || 1;
    const coverage = (run.spread / totalNodes) * 100;

    // normalizam
    const spreadNorm = (run.spread || 0) / maxSpread;
    const runtimeNorm = (run.runtime || 1) / maxRuntime;

    const alpha = 2; // pondere pentru spread
    const beta = 0.5; // pondere pentru timp de rulare
    const enhancedEfficiency = Math.pow(spreadNorm, alpha) / Math.pow(runtimeNorm, beta);

    return {
      ...run,
      totalNodes,
      coverage,
      efficiency: enhancedEfficiency
    };
  });
};


  const processedRuns = processRunsWithCoverage();
  
  const filteredRuns = processedRuns.filter(run => {
    const networkMatch = selectedNetwork === 'all' || run.network_name === selectedNetwork;
    const algorithmMatch = selectedAlgorithm === 'all' || run.algorithm === selectedAlgorithm;
    return networkMatch && algorithmMatch;
  });


  const uniqueAlgorithms = _.uniqBy(filteredRuns, 'algorithm').map(run => run.algorithm);

  const tabCharts = {
    coverage: {
      title: 'Node Coverage by Algorithm',
      chart: <Bar data={{
        labels: uniqueAlgorithms,
        datasets: [{
          label: 'Coverage (%)',
          data: _.map(_.groupBy(filteredRuns, 'algorithm'), runs => _.meanBy(runs, 'coverage')),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      }} options={{
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            title: {
              display: true,
              text: 'Coverage (%)'
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return `Coverage: ${context.raw.toFixed(2)}%`;
              }
            }
          }
        }
      }} />
    },
    enhancedEfficiency: {
      title: 'Enhanced Efficiency (Coverage-Weighted)',
      chart: <Bar data={{
        labels: uniqueAlgorithms,
        datasets: [{
          label: 'Efficiency',
          data: _.map(_.groupBy(filteredRuns, 'algorithm'), runs => _.meanBy(runs, 'efficiency')),
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }]
      }} options={{
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Efficiency Score'
            }
          }
        }
      }} />
    },
    clusteringImpact: {
      title: 'Algorithm Performance vs. Clustering Coefficient',
      chart: <Scatter data={{
        datasets: uniqueAlgorithms.map((algo, index) => {
          const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
          
          const dataPoints = algoRuns.map(run => {
            return {
              x: run.clustering_coeff || 0,
              y: run.coverage
            };
          });
          
          const colors = [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 206, 86)',
            'rgb(75, 192, 192)',
            'rgb(153, 102, 255)'
          ];
          
          return {
            label: algo,
            data: dataPoints,
            backgroundColor: colors[index % colors.length]
          };
        })
      }} options={{
        scales: {
          x: {
            title: {
              display: true,
              text: 'Clustering Coefficient'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Coverage (%)'
            }
          }
        }
      }} />
    },
    degreeImpact: {
      title: 'Algorithm Performance vs. Average Degree',
      chart: <Scatter data={{
        datasets: uniqueAlgorithms.map((algo, index) => {
          const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
          
          const dataPoints = algoRuns.map(run => {
            return {
              x: run.average_degree || 0,
              y: run.coverage
            };
          });
          
          const colors = [
            'rgb(255, 99, 132)',
            'rgb(54, 162, 235)',
            'rgb(255, 206, 86)',
            'rgb(75, 192, 192)',
            'rgb(153, 102, 255)'
          ];
          
          return {
            label: algo,
            data: dataPoints,
            backgroundColor: colors[index % colors.length]
          };
        })
      }} options={{
        scales: {
          x: {
            title: {
              display: true,
              text: 'Average Degree'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Coverage (%)'
            }
          }
        }
      }} />
    },
    seedSizeEffectiveness: {
      title: 'Seed Size vs. Coverage',
      chart: <Line data={{
        labels: _.uniq(filteredRuns.map(r => r.seed_size)).sort((a, b) => a - b),
        datasets: uniqueAlgorithms.map((algo, index) => {
          const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
          const groupedBySeed = _.groupBy(algoRuns, 'seed_size');
          
          const colors = [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ];
          
          return {
            label: algo,
            data: _.map(groupedBySeed, runs => _.meanBy(runs, 'coverage')),
            fill: false,
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.6', '1'),
            tension: 0.1
          };
        })
      }} options={{
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Coverage (%)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Seed Size'
            }
          }
        }
      }} />
    },
    performanceMetrics: {
      title: 'Algorithm Performance Metrics',
      chart: <Radar data={{
        labels: ['Coverage', 'Runtime Efficiency', 'Spread', 'Seed Efficiency', 'Consistency'],
        datasets: uniqueAlgorithms.map((algo, index) => {
          const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
          

          const avgCoverage = _.meanBy(algoRuns, 'coverage') / 100;
          const maxRuntime = _.maxBy(filteredRuns, 'runtime').runtime;
          const runtimeEff = 1 - (_.meanBy(algoRuns, 'runtime') / maxRuntime);
          const maxSpread = _.maxBy(filteredRuns, 'spread').spread;
          const spreadScore = _.meanBy(algoRuns, 'spread') / maxSpread;
          
          //eficienta valorilor pentru cardinalul multimii de seed
          const seedEff = _.meanBy(algoRuns, run => run.spread / run.seed_size) / 
                          _.maxBy(filteredRuns, run => run.spread / run.seed_size).spread;
          

          const coverageStdDev = Math.sqrt(_.sumBy(algoRuns, run => 
                                Math.pow(run.coverage - _.meanBy(algoRuns, 'coverage'), 2)) / algoRuns.length);
          const consistency = coverageStdDev === 0 ? 1 : 1 - (coverageStdDev / 100);
          
          const scores = [
            avgCoverage,
            runtimeEff,
            spreadScore,
            seedEff,
            consistency
          ];
          
          const colors = [
            'rgba(255, 99, 132, 0.2)',
            'rgba(54, 162, 235, 0.2)',
            'rgba(255, 206, 86, 0.2)',
            'rgba(75, 192, 192, 0.2)',
            'rgba(153, 102, 255, 0.2)'
          ];
          
          return {
            label: algo,
            data: scores,
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length].replace('0.2', '1'),
            borderWidth: 1
          };
        })
      }} options={{
        scales: {
          r: {
            min: 0,
            max: 1
          }
        }
      }} />
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="statistics-page">
      <h1>Network Algorithm Analytics</h1>

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
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace(/([A-Z])/g, ' $1')}
          </button>
        ))}
      </div>

      <div className="chart-container">
        <h2>{tabCharts[selectedTab].title}</h2>
        {tabCharts[selectedTab].chart}
      </div>

      {selectedTab === 'coverage' && (
        <div className="metric-explanation">
          <h3>About Coverage</h3>
          <p>
            Coverage represents the percentage of nodes in the network that were activated 
            by the algorithm. Higher coverage indicates a more effective algorithm for 
            information diffusion throughout the entire network.
          </p>
        </div>
      )}

      {selectedTab === 'enhancedEfficiency' && (
        <div className="metric-explanation">
          <h3>About Enhanced Efficiency</h3>
            <p>
              Enhanced Efficiency is a normalized score based on spread and runtime:
              <code>(spread / maxSpread)<sup>2</sup> / (runtime / maxRuntime)<sup>0.5</sup></code>.
              It prioritizes solutions with better spread while accounting for computational cost. 
              Values are comparable across algorithms and networks.
            </p>

        </div>
      )}
    </div>
  );
};

export default StatisticsPage;