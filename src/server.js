const express = require('express');
const cors = require('cors');
const authRoutes = require('./models/auth');
const dashboardRoutes = require('./models/dashboard/dashboardMain');
const { initializeDb } = require('./database');

require('dotenv').config();

const app = express();
const port = process.env.PORT;

initializeDb();

// Middleware setup
app.use(express.json());
app.use(cors());
app.use('/auth', authRoutes);
app.use('/', dashboardRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
