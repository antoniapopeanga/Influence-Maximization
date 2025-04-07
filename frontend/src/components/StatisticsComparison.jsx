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

  const seedSizeMap = {};

  Object.entries(algorithmResults).forEach(([algorithm, results]) => {
    results.results.forEach(result => {
      const seedSize = result.seed_size;
      if (!seedSizeMap[seedSize]) {
        seedSizeMap[seedSize] = [];
      }
      seedSizeMap[seedSize].push({
        algorithm,
        ...result
      });
    });
  });

  const columns = [
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
        (b.metrics.spread / b.metrics.runtime),
    },
  ];

  return (
    <Collapse ghost defaultActiveKey={Object.keys(seedSizeMap)}>
      {Object.entries(seedSizeMap).map(([seedSize, records]) => (
        <Panel header={`Seed Size: ${seedSize} nodes`} key={seedSize}>
          <Table
            columns={columns}
            dataSource={records}
            rowKey={(record) => `${record.algorithm}-${record.seed_size}`}
            pagination={false}
            size="small"
            bordered
          />
        </Panel>
      ))}
    </Collapse>
  );
};

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
