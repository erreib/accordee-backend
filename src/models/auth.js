const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); 
const router = express.Router();

require('dotenv').config();
const { pool } = require('../database'); // Adjust the path as necessary

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

router.get('/validate-token', authenticateJWT, (req, res) => {
  // If the middleware doesn't throw an error, the token is valid
  res.status(200).json({ message: 'Token is valid.' });
});

// User Signup
router.post('/signup', async (req, res) => {
  const { email, password } = req.body; // Change to use email
  const username = email.split('@')[0]; // Use the name part of the email as username

  try {
    // Check if email already exists in PostgreSQL
    const emailCheckQuery = 'SELECT * FROM users WHERE email = $1';
    const emailCheckResult = await pool.query(emailCheckQuery, [email]);

    if (emailCheckResult.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create a new user in PostgreSQL
    const insertUserQuery = 'INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING id';
    const newUserResult = await pool.query(insertUserQuery, [username, hashedPassword, email]);

    const userId = newUserResult.rows[0].id;

    // Create a token
    const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Create the first dashboard for the user
    const dashboardUrl = username; // This might need uniqueness handling
    const insertDashboardQuery = 'INSERT INTO dashboards (userId, dashboardURL) VALUES ($1, $2)';
    await pool.query(insertDashboardQuery, [userId, dashboardUrl]);

    res.status(201).json({ message: 'User created!', userId: userId, token: token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Could not create user.' });
  }
});

// User Login
router.post('/login', async (req, res) => {
  const { login, password } = req.body; // 'login' can be either username or email

  try {
    // Determine if 'login' is a username or an email
    const isEmail = login.includes('@');

    // Construct the query based on whether 'login' is a username or an email
    const userQuery = isEmail 
      ? 'SELECT * FROM users WHERE email = $1'
      : 'SELECT * FROM users WHERE username = $1';

    const userResult = await pool.query(userQuery, [login]);

    const user = userResult.rows[0];
    if (!user) {
      return res.status(400).json({ message: 'Invalid username/email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid username/email or password.' });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ message: 'Logged in!', userId: user.id, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error logging in.' });
  }
});

// Export the router
module.exports = router;

// Export the authenticateJWT middleware separately
module.exports.authenticateJWT = authenticateJWT;
