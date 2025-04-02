import React from 'react';
import { Card, Empty, Tabs } from 'antd';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import '../css/InfluenceSpreadChart.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Color palette for different algorithms
const algorithmColors = {
    classic_greedy: "rgb(255, 105, 180)", // hot pink
    random_selection: "rgb(50, 205, 50)", // lime green
    degree_heuristic: "rgb(79, 15, 206)", // medium purple
    centrality_heuristic: "rgb(255, 215, 0)", // gold
    celf: "rgb(255, 105, 180)", // hot pink
    celf_plus: "rgb(0, 191, 255)" // deep sky blue
};

const getAlgorithmColor = (algorithm) => {
  return algorithmColors[algorithm] || '#8c8c8c'; 
};

const prepareSpreadData = (algorithmResults) => {
  if (!algorithmResults || Object.keys(algorithmResults).length === 0) {
    return { labels: [], datasets: [] };
  }

  // Collect all unique seed sizes across all algorithms
  const allSeedSizes = new Set();
  Object.values(algorithmResults).forEach(algorithmData => {
    algorithmData.results?.forEach(result => {
      allSeedSizes.add(result.seed_size);
    });
  });
  const sortedSeedSizes = Array.from(allSeedSizes).sort((a, b) => a - b);

  const datasets = Object.entries(algorithmResults).map(([algorithm, algorithmData]) => {
    // Create a map of seed size to spread for this algorithm
    const spreadBySeedSize = {};
    algorithmData.results?.forEach(result => {
      spreadBySeedSize[result.seed_size] = result.metrics.spread;
    });

    // Fill in data points for all seed sizes
    const data = sortedSeedSizes.map(size => spreadBySeedSize[size] || null);

    return {
      label: algorithm.replace(/_/g, ' '),
      data,
      borderColor: getAlgorithmColor(algorithm),
      backgroundColor: getAlgorithmColor(algorithm),
      fill: false,
      tension: 0.1
    };
  });

  return {
    labels: sortedSeedSizes.map(size => `${size} nodes`),
    datasets
  };
};

const prepareStagesData = (algorithmResults) => {
  if (!algorithmResults || Object.keys(algorithmResults).length === 0) {
    return { labels: [], datasets: [] };
  }

  const datasets = Object.entries(algorithmResults).map(([algorithm, algorithmData]) => {
    // We'll show the stages for the largest seed size by default
    const resultsBySeedSize = algorithmData.results || [];
    const largestSeedSizeResult = resultsBySeedSize.reduce((max, result) => 
      result.seed_size > (max?.seed_size || 0) ? result : max, null);
    
    const stages = largestSeedSizeResult?.stages || [];
    const data = stages.map(stage => stage.total_activated);
    const labels = stages.map((_, index) => `Stage ${index + 1}`);

    return {
      label: `${algorithm.replace(/_/g, ' ')} (${largestSeedSizeResult?.seed_size || '?'} seeds)`,
      data,
      borderColor: getAlgorithmColor(algorithm),
      backgroundColor: getAlgorithmColor(algorithm),
      fill: false,
      tension: 0.1
    };
  });

  // Get the maximum number of stages to determine labels
  const maxStages = Math.max(...Object.values(algorithmResults).map(algorithmData => {
    const results = algorithmData.results || [];
    return Math.max(...results.map(result => result.stages?.length || 0));
  }));

  return {
    labels: Array.from({ length: maxStages }, (_, i) => `Stage ${i + 1}`),
    datasets
  };
};

const InfluenceSpreadChart = ({ algorithmResults }) => {
  if (!algorithmResults || typeof algorithmResults !== 'object' || Object.keys(algorithmResults).length === 0) {
    return (
      <Card className="chart-card">
        <Empty description="No data available for visualization" />
      </Card>
    );
  }

  const spreadData = prepareSpreadData(algorithmResults);
  const stagesData = prepareStagesData(algorithmResults);
  const hasSpreadData = spreadData.datasets.length > 0 && spreadData.labels.length > 0;
  const hasStagesData = stagesData.datasets.length > 0 && stagesData.labels.length > 0;

  if (!hasSpreadData && !hasStagesData) {
    return (
      <Card className="chart-card">
        <Empty description="No data available for visualization" />
      </Card>
    );
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.dataset.label || '';
            const value = context.raw !== null ? context.raw : 'N/A';
            return `${label}: ${value}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Activated Nodes'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Seed Set Size'
        }
      }
    }
  };

  const tabItems = [];

  if (hasSpreadData) {
    tabItems.push({
      key: '1',
      label: 'Spread by Seed Set Size',
      children: (
        <Line 
          data={spreadData} 
          options={{
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              x: {
                ...chartOptions.scales.x,
                title: {
                  display: true,
                  text: 'Seed Set Size'
                }
              }
            }
          }} 
        />
      ),
    });
  }

  if (hasStagesData) {
    tabItems.push({
      key: '2',
      label: 'Influence Propagation by Stage',
      children: (
        <Line 
          data={stagesData} 
          options={{
            ...chartOptions,
            scales: {
              ...chartOptions.scales,
              x: {
                ...chartOptions.scales.x,
                title: {
                  display: true,
                  text: 'Propagation Stage'
                }
              }
            }
          }} 
        />
      ),
    });
  }

  return (
    <div className="influence-spread-charts">
      <Tabs defaultActiveKey={tabItems[0]?.key} items={tabItems} />
    </div>
  );
};

export default InfluenceSpreadChart;