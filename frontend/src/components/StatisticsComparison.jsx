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

  const firstAlgorithmKey = Object.keys(algorithmResults)[0];
  const totalNodes = algorithmResults[firstAlgorithmKey]?.nodes?.length || 1;

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
      key: 'runtime',
      sorter: (a, b) => a.metrics.runtime - b.metrics.runtime,
      render: (_, record) => record.metrics.runtime.toFixed(2),
    },
{
  title: "Efficiency = (Spread / N)% / log₁₀(Runtime)",
  render: (_, record) => {
    const spread = record.metrics.spread;
    const runtime = record.metrics.runtime;
    const coverage = (spread / totalNodes) * 100;
    const eff = coverage / Math.log10(runtime + 10);
    return (
      <Tooltip title={`Efficiency = ${coverage.toFixed(2)}% / log₁₀(${(runtime + 10).toFixed(2)})`}>
        {eff.toFixed(2)}
      </Tooltip>
    );
  },
  sorter: (a, b) => {
    const covA = (a.metrics.spread / totalNodes) * 100;
    const covB = (b.metrics.spread / totalNodes) * 100;
    const effA = covA / Math.log10(a.metrics.runtime + 10);
    const effB = covB / Math.log10(b.metrics.runtime + 10);
    return effA - effB;
  }
}

]

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
    celf: "rgb(19, 192, 169)", // turqoise
  };
  return colors[algorithm] || 'geekblue';
};

export default StatisticsComparison;
