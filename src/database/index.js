// database/index.js
const { Pool } = require('pg');
const { usersTable, dashboardsTable, sectionsTable } = require('./schema');

const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
  ssl: { rejectUnauthorized: false }
});

const initializeDb = async () => {
  try {
    // Create the users table
    await pool.query(usersTable);
    console.log('Users table created successfully.');

    // Create the dashboards table
    await pool.query(dashboardsTable);
    console.log('Dashboards table created successfully.');

    // Create the sections table
    await pool.query(sectionsTable);
    console.log('Sections table created successfully.');

    console.log('PostgresDB initialized successfully');
  } catch (err) {
    console.error('Error initializing PostgresDB:', err);
  }
};

module.exports = {
  pool,        // Export the pool for making queries elsewhere in your app
  initializeDb // Export the initialize function to run it from server.js or a separate script
};
