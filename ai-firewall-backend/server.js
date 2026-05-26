require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require("./config/db");
const proxyRoutes = require("./routes/proxyRoutes");

// Connect to database
connectDB();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use(proxyRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});