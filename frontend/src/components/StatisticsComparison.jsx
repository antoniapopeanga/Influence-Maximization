import React from 'react';
import { Card, Table, Tag, Progress, Tooltip } from 'antd';
import '../css/StatisticsComparison.css';

const StatisticsComparison = ({ algorithmResults }) => {
  if (!algorithmResults) return (
    <Card className="empty-state">
      <div className="empty-message">
        <i className="icon-data" />
        <p>Run algorithms to see comparison results</p>
      </div>
    </Card>
  );

  // Prepare data for table
  const dataSource = Object.entries(algorithmResults).map(([algorithm, data]) => ({
    key: algorithm,
    algorithm: (
      <Tag color={getAlgorithmColor(algorithm)}>
        {algorithm.replace(/_/g, ' ')}
      </Tag>
    ),
    spread: data.metrics.spread,
    runtime: `${data.metrics.runtime}ms`,
    efficiency: (
      <Tooltip title={`Spread/Runtime ratio`}>
        <Progress 
          percent={Math.min(100, (data.metrics.spread / data.metrics.runtime) * 1000)}
          status="active"
          showInfo={false}
        />
      </Tooltip>
    ),
    seeds: (
      <Tooltip title={data.metrics.seed_nodes.join(', ')}>
        <span className="seed-count">
          {data.metrics.seed_nodes.length} nodes
        </span>
      </Tooltip>
    )
  }));

  const columns = [
    {
      title: 'Algorithm',
      dataIndex: 'algorithm',
      key: 'algorithm',
      sorter: (a, b) => a.key.localeCompare(b.key),
    },
    {
      title: 'Spread',
      dataIndex: 'spread',
      key: 'spread',
      sorter: (a, b) => a.spread - b.spread,
      render: (value) => <strong>{value}</strong>
    },
    {
      title: 'Runtime',
      dataIndex: 'runtime',
      key: 'runtime',
      sorter: (a, b) => parseInt(a.runtime) - parseInt(b.runtime)
    },
    {
      title: 'Efficiency',
      dataIndex: 'efficiency',
      key: 'efficiency',
      sorter: (a, b) => (a.spread/a.runtime) - (b.spread/b.runtime)
    },
    {
      title: 'Seed Nodes',
      dataIndex: 'seeds',
      key: 'seeds'
    }
  ];

// StatisticsComparison.js (updated return statement)
return (
  <Table
    dataSource={dataSource}
    columns={columns}
    pagination={false}
    size="small"
    className="comparison-table"
  />
);
};

// Helper function
const getAlgorithmColor = (algorithm) => {
  const colors = {
    classic_greedy: 'magenta',
    random_selection: 'red',
    degree_heuristic: 'volcano',
    centrality_heuristic: 'orange',
    celf: 'gold',
    celf_plus: 'lime'
  };
  return colors[algorithm] || 'geekblue';
};

export default StatisticsComparison;