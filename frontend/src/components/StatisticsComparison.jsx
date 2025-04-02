import React from 'react';
import { Table, Tag, Tooltip, Collapse } from 'antd';
import '../css/StatisticsComparison.css';

const { Panel } = Collapse;

const StatisticsComparison = ({ algorithmResults }) => {
  if (!algorithmResults) return (
    <div className="empty-state">
      <i className="icon-data" />
      <p>Run algorithms to see comparison results</p>
    </div>
  );

  // Prepare data structure for nested tables
  const algorithmData = Object.entries(algorithmResults).map(([algorithm, results]) => {
    // Group results by seed size
    const seedSizeGroups = results.results.reduce((acc, result) => {
      const seedSize = result.seed_size;
      if (!acc[seedSize]) {
        acc[seedSize] = [];
      }
      acc[seedSize].push(result);
      return acc;
    }, {});

    return {
      algorithm,
      seedSizeGroups
    };
  });

  // Columns for the main table
  const mainColumns = [
    {
      title: 'Algorithm',
      dataIndex: 'algorithm',
      key: 'algorithm',
      render: (text) => (
        <Tag color={getAlgorithmColor(text)}>
          {text.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Seed Sizes Tested',
      dataIndex: 'seedSizes',
      key: 'seedSizes',
      render: (_, record) => (
        <div>
          {Object.keys(record.seedSizeGroups).map(size => (
            <Tag key={size} style={{ marginBottom: 4 }}>
              {size} nodes
            </Tag>
          ))}
        </div>
      ),
    },
  ];

  // Columns for the nested tables (per seed size)
  const nestedColumns = [
    {
      title: 'Seed Size',
      dataIndex: 'seed_size',
      key: 'seed_size',
      render: (size) => `${size} nodes`
    },
    {
      title: 'Spread',
      dataIndex: ['metrics', 'spread'],
      key: 'spread',
      sorter: (a, b) => a.metrics.spread - b.metrics.spread,
    },
    {
      title: 'Runtime (ms)',
      dataIndex: ['metrics', 'runtime'],
      key: 'runtime',
      sorter: (a, b) => a.metrics.runtime - b.metrics.runtime,
    },
    {
      title: 'Efficiency',
      key: 'efficiency',
      render: (_, record) => (
        <Tooltip title={`Spread/Runtime ratio`}>
          {(record.metrics.spread / record.metrics.runtime).toFixed(6)}
        </Tooltip>
      ),
      sorter: (a, b) => 
        (a.metrics.spread / a.metrics.runtime) - 
        (b.metrics.spread / b.metrics.runtime)
    },
    {
      title: 'Seed Nodes',
      dataIndex: ['metrics', 'seed_nodes'],
      key: 'seed_nodes',
      render: (nodes) => (
        <Tooltip title={nodes.join(', ')}>
          <span className="seed-count">
            {nodes.length} nodes
          </span>
        </Tooltip>
      )
    }
  ];

  return (
    <Collapse ghost defaultActiveKey={algorithmData.map((_, index) => index.toString())}>
      {algorithmData.map((algorithm, index) => (
        <Panel 
          header={
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Tag color={getAlgorithmColor(algorithm.algorithm)}>
                {algorithm.algorithm.replace(/_/g, ' ')}
              </Tag>
              <span style={{ marginLeft: 8 }}>
                ({Object.keys(algorithm.seedSizeGroups).length} seed sizes tested)
              </span>
            </div>
          }
          key={index.toString()}
        >
          {Object.entries(algorithm.seedSizeGroups).map(([seedSize, results]) => (
            <div key={seedSize} style={{ marginBottom: 16 }}>
              <h4>Seed Size: {seedSize} nodes</h4>
              <Table
                columns={nestedColumns}
                dataSource={results}
                rowKey={(record) => `${record.seed_size}-${record.metrics.spread}`}
                pagination={false}
                size="small"
                bordered
              />
            </div>
          ))}
        </Panel>
      ))}
    </Collapse>
  );
};

// Helper function
const getAlgorithmColor = (algorithm) => {
  const colors = {
    classic_greedy: "rgb(255, 105, 180)", // hot pink
    random_selection: "rgb(50, 205, 50)", // lime green
    degree_heuristic: "rgb(79, 15, 206)", // medium purple
    centrality_heuristic: "rgb(255, 215, 0)", // gold
    celf: "rgb(255, 105, 180)", // hot pink
    celf_plus: "rgb(0, 191, 255)" // deep sky blue
  };
  return colors[algorithm] || 'geekblue';
};

export default StatisticsComparison;