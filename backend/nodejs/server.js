const express = require('express');
const axios = require('axios');  // We'll use Axios to send HTTP requests to Flask
const cors = require('cors');  // Import cors
const app = express();
const PORT = 3000;

// Enable CORS for specific origins (React and Flask)
app.use(cors({
    origin: ['http://localhost:3001', 'http://localhost:5000'],  // Allow requests from React and Flask
    methods: ['GET', 'POST'],  // Allow GET and POST requests
    allowedHeaders: ['Content-Type'],  // Allow content-type headers
    preflightContinue: false,  // Preflight requests will return the CORS headers directly
    optionsSuccessStatus: 200  // Status code for successful OPTIONS requests
}));

app.use(express.json());  // Middleware to parse incoming JSON

// Example endpoint to trigger Flask API
app.post('/trigger-algorithm', async (req, res) => {
    const graphData = req.body.graph;
    const algorithm = req.body.algorithm;

    try {
        // Send a POST request to Flask
        const response = await axios.post('http://127.0.0.1:5000/run-algorithm', {
            graph: graphData,
            algorithm: algorithm
        });

        // Send Flask's response back to the client
        res.json(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error while calling Flask API' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Node.js server running on http://localhost:${PORT}`);
});
