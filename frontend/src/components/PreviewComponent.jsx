import React from 'react';

const PreviewComponent = ({ graphData }) => {
  if (!graphData) {
    return <div>Please select options and run the algorithm to see the results.</div>;
  }

  return (
    <div style={{ padding: '20px', flexGrow: 1, backgroundColor: '#ecf0f1' }}>
      <h2>Graph Preview</h2>
      <div>
        <h3>Nodes:</h3>
        <pre>{JSON.stringify(graphData.nodes, null, 2)}</pre>
      </div>
      <div>
        <h3>Edges:</h3>
        <pre>{JSON.stringify(graphData.edges, null, 2)}</pre>
      </div>
    </div>
  );
};

export default PreviewComponent;
