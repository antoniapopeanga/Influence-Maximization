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
import networkLabels from '../utils/networkLabels';

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

const getAlgorithmColor = (algorithm) => {
  const colors = {
    classic_greedy: "rgb(255, 105, 180)", // hot pink
    random_selection: "rgb(50, 205, 50)", // lime green
    degree_heuristic: "rgb(79, 15, 206)", // medium purple
    centrality_heuristic: "rgb(255, 215, 0)", // gold
    celf: "rgb(19, 192, 169)", // turquoise
  };
  return algorithm ? colors[algorithm] : null;
};

    const algoLabels = {
      'centrality_heuristic': 'Centrality Heuristic',
      'degree_heuristic': 'Degree Heuristic',
      'celf': 'CELF Optimization',
      'classic_greedy': 'Classic Greedy',
      'random_selection': 'Random Selection'
    };


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

// grupam simularile in functie de model ic(pe fiecare prob) si lt
const processRunsWithCoverage = () => {
  const maxSpread = Math.max(...algorithmRuns.map(run => run.spread || 0));
  const maxRuntime = Math.max(...algorithmRuns.map(run => run.runtime || 1));

  const uniqueModels = [...new Set(algorithmRuns.map(run => run.diffusion_model))];
  console.log("All diffusion models in data:", uniqueModels);

  return algorithmRuns.map(run => {
    let avgPropagationProb = null;
    try {
      let modelParams = run.model_params || '{}';
      
      // parsam parametrii modelelor de 2 ori
      if (typeof modelParams === 'string' && modelParams.startsWith('"')) {
        modelParams = JSON.parse(modelParams);
      }
      
      const params = JSON.parse(modelParams);
      
      if (run.diffusion_model === 'IndependentCascadeModel' && params.probabilities) {
        const probs = Object.values(params.probabilities);
        if (probs.length > 0) {
          avgPropagationProb = probs.reduce((a, b) => a + b, 0) / probs.length;
          const probLabel = avgPropagationProb.toFixed(3);
          run.diffusion_model = `IndependentCascadeModel (p=${probLabel})`;
          console.log(`IC Model - avgPropagationProb: ${avgPropagationProb}`);
        }
       }
   
    } catch (err) {
      console.warn(`Error parsing model_params for run ${run.id} (${run.diffusion_model}):`, err);
      console.warn("model_params value:", run.model_params);
    }

    const totalNodes = run.num_nodes || 1;
    const coverage = (run.spread / totalNodes) * 100;

    const spreadNorm = (run.spread || 0) / maxSpread;
    const runtimeNorm = (run.runtime || 1) / maxRuntime;

    const alpha = 2;
    const beta = 0.1;
    const enhancedEfficiency = Math.pow(spreadNorm, alpha) / Math.pow(runtimeNorm, beta);

    return {
      ...run,
      totalNodes,
      coverage,
      efficiency: enhancedEfficiency,
      avgPropagationProb
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
        backgroundColor: uniqueAlgorithms.map(algo => getAlgorithmColor(algo)),
        borderColor: uniqueAlgorithms.map(algo => getAlgorithmColor(algo)),
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
        legend: {
          display: false
        },
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
        backgroundColor: uniqueAlgorithms.map(algo => getAlgorithmColor(algo)),
        borderColor: uniqueAlgorithms.map(algo => getAlgorithmColor(algo)),
        borderWidth: 1
      }]
    }} options={{
      plugins: {
        legend: {
          display: false
        }
      },
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
modelCoverage: {
  title: 'Coverage Comparison: IC (by probability) vs LT',
  chart: (() => {
    // grupam simularile in functie de probabilitati pt IC
    const icRuns = filteredRuns.filter(run => 
      run.diffusion_model.includes('IndependentCascadeModel')
    );
    
    const icByProb = _.groupBy(icRuns, run => {
      // extragem probabilitatea
      const probMatch = run.diffusion_model.match(/p=([0-9.]+)/);
      if (probMatch) {
        return parseFloat(probMatch[1]);
      }
      if (run.avgPropagationProb) {
        return Math.round(run.avgPropagationProb * 1000) / 1000;
      }
      return 'unknown';
    });
    
    // recuperam simularile facute cu LT
    const ltRuns = filteredRuns.filter(run => 
      run.diffusion_model.toLowerCase().includes('threshold')
    );
    
    const labels = [];
    const coverageData = [];
    const backgroundColors = [];
    const borderColors = [];
    

    const sortedProbs = Object.keys(icByProb)
      .filter(prob => prob !== 'unknown')
      .sort((a, b) => parseFloat(a) - parseFloat(b));
    
    // modelele IC colorate in functie de probabilitate
    const redShades = [
        {bg: 'rgba(255, 153, 153, 0.7)', border: 'rgba(255, 102, 102, 1)'}, // lightest red (0.01)
        {bg: 'rgba(255, 102, 102, 0.7)', border: 'rgba(255, 71, 71, 1)'},   // medium red (0.05)
        {bg: 'rgba(255, 51, 51, 0.7)', border: 'rgba(255, 0, 0, 1)'}        // darkest red (0.1)
    ];

    sortedProbs.forEach((prob, index) => {
        labels.push(`IC (p=${prob})`);
        coverageData.push(_.meanBy(icByProb[prob], 'coverage') || 0);
        

        const shadeIndex = Math.min(index, redShades.length - 1);
        backgroundColors.push(redShades[shadeIndex].bg);
        borderColors.push(redShades[shadeIndex].border);
    });
    
    //LT model
    if (ltRuns.length > 0) {
      labels.push('LT');
      coverageData.push(_.meanBy(ltRuns, 'coverage') || 0);
      backgroundColors.push('rgba(54, 162, 235, 0.6)');
      borderColors.push('rgba(54, 162, 235, 1)');
    }
    
    return <Bar data={{
      labels: labels,
      datasets: [{
        label: 'Coverage (%)',
        data: coverageData,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
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
        },
        x: {
          title: {
            display: true,
            text: 'Diffusion Model'
          }
        }
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw.toFixed(2)}%`;
            },
            afterLabel: function(context) {
              const label = context.label;
              if (label.includes('IC')) {
                const probMatch = label.match(/p=([0-9.]+)/);
                if (probMatch) {
                  const prob = parseFloat(probMatch[1]);
                  const runsForThisProb = icRuns.filter(run => {
                    const runProbFromLabel = run.diffusion_model.match(/p=([0-9.]+)/);
                    const runProb = runProbFromLabel ? parseFloat(runProbFromLabel[1]) : run.avgPropagationProb;
                    return runProb && Math.abs(runProb - prob) < 1e-4;
                  });
                  return `Number of runs: ${runsForThisProb.length}`;
                }
              } else if (label === 'LT') {
                return `Number of runs: ${ltRuns.length}`;
              }
              return null;
            }
          }
        }
      }
    }} />;
  })()
},
    clusteringImpact: {
    title: 'Algorithm Performance vs. Clustering Coefficient',
    chart: <Scatter data={{
      datasets: uniqueAlgorithms.map(algo => {
        const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
        return {
          label: algo,
          data: algoRuns.map(run => ({
            x: run.clustering_coeff || 0,
            y: run.coverage
          })),
          backgroundColor: getAlgorithmColor(algo)
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
      datasets: uniqueAlgorithms.map(algo => {
        const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
        return {
          label: algo,
          data: algoRuns.map(run => ({
            x: run.average_degree || 0,
            y: run.coverage
          })),
          backgroundColor: getAlgorithmColor(algo)
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
    performanceMetrics: {
    title: 'Algorithm Performance Metrics',
    chart: <Radar data={{
      labels: ['Coverage', 'Runtime Efficiency', 'Scalability', 'Saturation Score', 'Consistency'],
      datasets: uniqueAlgorithms.map(algo => {
        const algoRuns = filteredRuns.filter(run => run.algorithm === algo);
        const color = getAlgorithmColor(algo);

          const avgCoverage = _.meanBy(algoRuns, 'coverage') / 100;
          const avgRuntime = _.meanBy(algoRuns, 'runtime');
          const maxRuntime = _.max(filteredRuns.map(run => run.runtime)) || 1;
          const logAvg = Math.log(avgRuntime + 1);
          const logMax = Math.log(maxRuntime + 1);
          const runtimeEff = 1 - (logAvg / logMax);
          const runtimePerNode = avgRuntime / _.meanBy(algoRuns, 'num_nodes');
          const logScalability = 1 - (Math.log(runtimePerNode + 1) / Math.log(_.max(filteredRuns.map(r => r.runtime / r.num_nodes)) + 1));
          const avgSpread = _.meanBy(algoRuns, 'spread');
          const avgNumNodes = _.meanBy(algoRuns, 'num_nodes') || 1;
          const maxSaturation = _.max(filteredRuns.map(run => run.spread / (run.num_nodes || 1))) || 1;
          const saturationScore = (avgSpread / avgNumNodes) / maxSaturation;

          const coverageStdDev = Math.sqrt(_.sumBy(algoRuns, run => 
                                Math.pow(run.coverage - _.meanBy(algoRuns, 'coverage'), 2)) / algoRuns.length);
          const consistency = coverageStdDev === 0 ? 1 : 1 - (coverageStdDev / 100);
          
          const scores = [
            avgCoverage,
            runtimeEff,
            logScalability,
            saturationScore,
            consistency
          ];

        return {
          label: algo,
          data: scores,
          backgroundColor: color.replace(')', ', 0.2)').replace('rgb', 'rgba'),
          borderColor: color,
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

      <div className="filters-networks">
        <label>Network:
          <select value={selectedNetwork} onChange={e => setSelectedNetwork(e.target.value)}>
            <option value="all">All</option>
            {networks.map(net => (
              <option key={net} value={net}>
                {networkLabels[net] || net}
              </option>
            ))}
          </select>
        </label>

        <label>Algorithm:
          <select value={selectedAlgorithm} onChange={e => setSelectedAlgorithm(e.target.value)}>
            <option value="all">All</option>
            {_.uniq(algorithmRuns.map(run => run.algorithm)).map(algo => (
              <option key={algo} value={algo}>{algoLabels[algo]}</option>
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
              <code>(spread / maxSpread)<sup>2</sup> / (runtime / maxRuntime)<sup>0.1</sup></code>.
              It prioritizes solutions with better spread while accounting for computational cost. 
              Values are comparable across algorithms and networks.
            </p>

        </div>
      )}

      {selectedTab === 'performanceMetrics' && (
        <div className="metric-explanation">
          <h3>About Performance Metrics</h3>
          <p>
            This radar chart compares algorithm performance across five dimensions:
          </p>
          <ul>
            <li><strong>Coverage</strong>: Fraction of nodes influenced in the network.</li>
            <li><strong>Runtime Efficiency</strong>: Normalized runtime performance (higher is better).</li>
            <li><strong>Scalability</strong>: Efficiency as the network grows, based on runtime per node.</li>
            <li><strong>Saturation Score</strong>: How well the algorithm fills the network relative to the best possible performance observed.</li>
            <li><strong>Consistency</strong>: How stable the algorithm’s results are across runs.</li>
          </ul>
        </div>
      )}

        {selectedTab === 'modelCoverage' && (
          <div className="metric-explanation">
            <h3>About Diffusion Model Coverage</h3>
            <p>
              This chart compares coverage performance between two diffusion models:
            </p>
            <ul>
              <li><strong>Independent Cascade (IC)</strong>: Each activated node attempts to activate 
              its neighbors independently with a fixed probability (0.01, 0.05, or 0.1). Higher 
              probabilities lead to more aggressive spreading but may cause rapid saturation.</li>
              <li><strong>Linear Threshold (LT)</strong>: Nodes are activated when the cumulative 
              influence from their activated neighbors exceeds a threshold. This model captures 
              social reinforcement effects where multiple influences are needed for activation.</li>
            </ul>
            <p>
              The different IC probabilities show how activation likelihood affects overall network 
              coverage, while LT represents a fundamentally different spreading mechanism based on 
              cumulative social pressure.
            </p>
          </div>
        )}

        {selectedTab === 'clusteringImpact' && (
          <div className="metric-explanation">
            <h3>About Clustering Coefficient Impact</h3>
            <p>
              The clustering coefficient measures how densely connected a node's neighbors are to 
              each other, ranging from 0 (no connections between neighbors) to 1 (all neighbors 
              are connected).
            </p>
            <ul>
              <li><strong>High clustering</strong>: Creates tight-knit communities where information 
              spreads quickly within groups but may struggle to bridge between communities.</li>
              <li><strong>Low clustering</strong>: Indicates more diverse connections that can 
              facilitate broader information spread across different network regions.</li>
            </ul>
            <p>
              Different algorithms may perform better in high vs. low clustering environments 
              depending on their selection strategy and ability to identify bridge nodes between 
              communities.
            </p>
          </div>
        )}

        {selectedTab === 'degreeImpact' && (
          <div className="metric-explanation">
            <h3>About Average Degree Impact</h3>
            <p>
              Average degree represents the typical number of connections each node has in the 
              network. It's a fundamental measure of network connectivity.
            </p>
            <ul>
              <li><strong>High degree networks</strong>: Offer more paths for information spread, 
              potentially leading to faster and more extensive diffusion, but may also create 
              redundant coverage.</li>
              <li><strong>Low degree networks</strong>: Have fewer connections, making strategic 
              node selection more critical. Each connection becomes more valuable for bridging 
              different parts of the network.</li>
            </ul>
            <p>
              Algorithm performance often varies with network density - some excel in sparse 
              networks by finding key connectors, while others leverage the redundancy in 
              dense networks for robust spreading.
            </p>
          </div>
        )}

    </div>
  );
};

export default StatisticsPage;