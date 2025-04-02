import React from 'react';
import { Card, Empty, Tabs } from 'antd';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

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
  const normalizedAlgo = algorithm.toLowerCase().replace(/_/g, '_');
  return algorithmColors[normalizedAlgo] || '#8c8c8c'; 
};

const prepareSpreadData = (algorithmResults) => {
  if (!algorithmResults || Object.keys(algorithmResults).length === 0) {
    return { labels: [], datasets: [] };
  }

  const labels = Array.from({ length: 20 }, (_, i) => i + 1);
  const datasets = Object.keys(algorithmResults).map(algorithm => {
    const result = algorithmResults[algorithm];
    const spread = result?.metrics?.spread || 0;
    const seedSetSize = result?.metrics?.seed_set_size || 1;

    const data = labels.map(i => {
      return i <= seedSetSize
        ? Math.round((i / seedSetSize) * spread * 0.9)
        : Math.min(spread + Math.round((i - seedSetSize) * 0.3 * (spread / seedSetSize)), spread * 1.5);
    });

    return {
      label: algorithm.replace(/_/g, ' '),
      data,
      borderColor: getAlgorithmColor(algorithm),
      fill: false,
    };
  });

  return { labels, datasets };
};

const prepareStagesData = (algorithmResults) => {
  if (!algorithmResults || Object.keys(algorithmResults).length === 0) {
    return { labels: [], datasets: [] };
  }

  const algorithmNames = Object.keys(algorithmResults);
  const labels = [];
  const datasets = [];

  algorithmNames.forEach(algorithm => {
    const stages = algorithmResults[algorithm]?.stages || [];
    const data = [];

    stages.forEach(stage => {
      if (stage?.stage !== undefined && stage?.total_activated !== undefined) {
        labels.push(stage.stage);
        data.push(stage.total_activated);
      }
    });

    datasets.push({
      label: algorithm.replace(/_/g, ' '),
      data,
      borderColor: getAlgorithmColor(algorithm),
      fill: false,
    });
  });

  return { labels: [...new Set(labels)], datasets };
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
  const hasSpreadData = spreadData.datasets.length > 0;
  const hasStagesData = stagesData.datasets.length > 0;

  if (!hasSpreadData && !hasStagesData) {
    return (
      <Card className="chart-card">
        <Empty description="No data available for visualization" />
      </Card>
    );
  }

  const tabItems = [];

  if (hasSpreadData) {
    tabItems.push({
      key: '1',
      label: 'Spread by Target Set Size',
      children: <Line data={spreadData} />,
    });
  }

  if (hasStagesData) {
    tabItems.push({
      key: '2',
      label: 'Influence Propagation by Stage',
      children: <Line data={stagesData} />,
    });
  }

  return (
    <div className="influence-spread-charts">
      <Tabs defaultActiveKey={tabItems[0]?.key} items={tabItems} />
    </div>
  );
};

export default InfluenceSpreadChart;
