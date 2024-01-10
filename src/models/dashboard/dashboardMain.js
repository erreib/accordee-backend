const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../auth.js'); // Adjust path as needed

const { generateVerificationToken, verifyDNS, getVerificationDetails } = require('./domainVerification.js');
const { upload, getUploadedMedia, deleteMedia, uploadMedia } = require('./googleCloudStorage');

require('dotenv').config();
const { pool } = require('../../database/index.js'); // Adjust the path as necessary

// Route to get a user's dashboards
router.get('/users/:username/dashboards', async (req, res) => {
  const { username } = req.params;

  try {
    // Query to get all dashboards associated with the username
    const query = 'SELECT * FROM dashboards WHERE userId = (SELECT id FROM users WHERE username = $1)';
    const result = await pool.query(query, [username]);

    // Send the dashboards data as the response
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user dashboards:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Define the maximum number of dashboards allowed
const MAX_DASHBOARDS_PER_USER = 5; // Set your desired limit

router.post('/users/:username/dashboards/new-dashboard', authenticateJWT, async (req, res) => {
  const { username } = req.params;
  const { dashboardUrl, title, layout } = req.body;

  // Check for existing dashboard with the same URL
  const existingDashboard = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
  if (existingDashboard.rowCount > 0) {
    return res.status(409).json({ message: 'Dashboard URL already exists' });
  }

  try {
    // Get the user's ID based on the username
    const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userId = userResult.rows[0].id;

    // Check the current number of dashboards the user has
    const dashboardsCountQuery = 'SELECT COUNT(*) FROM dashboards WHERE userId = $1';
    const dashboardsCountResult = await pool.query(dashboardsCountQuery, [userId]);
    const dashboardsCount = parseInt(dashboardsCountResult.rows[0].count);

    if (dashboardsCount >= MAX_DASHBOARDS_PER_USER) {
      return res.status(400).json({ message: `You can only create up to ${MAX_DASHBOARDS_PER_USER} dashboards.` });
    }

    // Create a new dashboard
    const insertDashboardQuery = 'INSERT INTO dashboards (userId, dashboardURL, dashboardTitle, dashboardLayout) VALUES ($1, $2, $3, $4) RETURNING *';
    const newDashboard = await pool.query(insertDashboardQuery, [userId, dashboardUrl, title, layout]);

    // Respond with the newly created dashboard details
    res.json({ message: 'Dashboard created successfully', dashboard: newDashboard.rows[0] });
  } catch (error) {
    console.error('Error in creating dashboard:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

router.put('/users/:username/dashboards/edit/:dashboardId', authenticateJWT, async (req, res) => {
  const { dashboardId } = req.params;
  const { newUrl } = req.body;

  // Check for conflicting dashboard URL
  const conflictCheck = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1 AND dashboardId != $2', [newUrl, dashboardId]);
  if (conflictCheck.rowCount > 0) {
    return res.status(409).json({ message: 'Dashboard URL conflict' });
  }

  try {
    // Update dashboard details in the database
    const updateQuery = 'UPDATE dashboards SET dashboardURL = $1 WHERE dashboardId = $2 RETURNING *';
    const updatedDashboard = await pool.query(updateQuery, [newUrl, dashboardId]);

    if (updatedDashboard.rowCount === 0) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }

    // Respond with the updated dashboard details
    res.json({ message: 'Dashboard updated successfully', dashboard: updatedDashboard.rows[0] });
  } catch (error) {
    console.error('Error in updating dashboard:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Delete a dashboard
router.delete('/users/:username/dashboards/delete/:dashboardId', authenticateJWT, async (req, res) => {
  const { dashboardId } = req.params;

  // Delete dashboard
  await pool.query('DELETE FROM dashboards WHERE dashboardId = $1', [dashboardId]);

  res.json({ message: 'Dashboard deleted successfully' });
});

// Get a specific user's dashboard by its URL
router.get('/:dashboardUrl', async (req, res) => {
  const { dashboardUrl } = req.params;

  try {
    // Fetch the specific dashboard details from the database
    const dashboardRes = await pool.query(
      'SELECT * FROM dashboards WHERE dashboardURL = $1', 
      [dashboardUrl]
    );

    if (dashboardRes.rowCount === 0) {
      return res.status(404).json({ message: "Dashboard not found" });
    }

    const dashboardData = dashboardRes.rows[0];

    // Fetch sections for this dashboard from the database
    const sectionsRes = await pool.query(
      'SELECT title, color, content, orderNum, thumbnailUrl FROM sections WHERE dashboardId = $1 ORDER BY orderNum', 
      [dashboardData.dashboardid]
    );

    // Map the sections data
    const sections = sectionsRes.rows.map(row => ({
      title: row.title,
      color: row.color,
      content: row.content,
      order: row.ordernum,
      sectionThumbnailUrl: row.thumbnailurl // Include thumbnail URL for each section
    }));

    // Construct the response object with the dashboard and its sections
    const response = {
      dashboard: {
        dashboardUserId: dashboardData.userid,
        thumbnailUrl: dashboardData.dashboardthumbnailurl, // Include thumbnail URL for the dashboard
        title: dashboardData.dashboardtitle,
        layout: dashboardData.dashboardlayout,
        backgroundStyle: dashboardData.backgroundstyle,
        customDomain: dashboardData.customdomain,
        isDomainVerified: dashboardData.isdomainverified,
        sections: sections
      }
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Route for updating a specific dashboard's title
router.post('/:dashboardUrl/title', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { title } = req.body;

  try {
    // Fetch the dashboard by its URL
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }

    // Update the dashboard title in the database
    await pool.query('UPDATE dashboards SET dashboardTitle = $1 WHERE dashboardURL = $2', [title, dashboardUrl]);

    // Send a response indicating success
    res.json({ message: 'Dashboard title updated', title: title });
  } catch (error) {
    console.error('Error updating dashboard title:', error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint to update the thumbnail URL for a specific dashboard
router.post('/:dashboardUrl/thumbnail', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { thumbnailUrl } = req.body; // URL of the already uploaded thumbnail

  try {
    // Update the dashboard's thumbnail URL in the database
    const updateThumbnailQuery = 'UPDATE dashboards SET dashboardThumbnailUrl = $1 WHERE dashboardURL = $2 RETURNING *';
    const updatedDashboard = await pool.query(updateThumbnailQuery, [thumbnailUrl, dashboardUrl]);

    if (updatedDashboard.rowCount === 0) {
      return res.status(404).json({ message: 'Dashboard not found' });
    }

    // Respond with the updated dashboard information
    res.status(200).json({ message: 'Thumbnail updated successfully', dashboard: updatedDashboard.rows[0] });
  } catch (error) {
    console.error('Error in updating thumbnail:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Update the dashboard's layout
router.post('/:dashboardUrl/layout', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { layout } = req.body;
  const userId = req.user.id; // Assuming req.user.id contains the authenticated user's ID

  try {
    // Fetch dashboard by URL
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ message: "Dashboard not found" });
    }
    const dashboardData = dashboardRes.rows[0];

    // Check if the logged-in user is the owner of the dashboard
    if (dashboardData.userid !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update the dashboard's layout in the database
    await pool.query('UPDATE dashboards SET dashboardLayout = $1 WHERE dashboardId = $2', [layout, dashboardData.dashboardid]);

    res.json({ message: 'Dashboard layout updated', layout: layout });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update the dashboard's background style
router.post('/:dashboardUrl/background-style', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { backgroundStyle } = req.body;
  const userId = req.user.id; // Assuming req.user.id contains the authenticated user's ID

  try {
    // Fetch dashboard by URL
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ message: "Dashboard not found" });
    }
    const dashboardData = dashboardRes.rows[0];

    // Check if the logged-in user is the owner of the dashboard
    if (dashboardData.userid !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update the dashboard's background style in the database
    await pool.query('UPDATE dashboards SET backgroundStyle = $1 WHERE dashboardId = $2', [backgroundStyle, dashboardData.dashboardid]);

    res.json({ message: 'Background style updated successfully', backgroundStyle });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Define the maximum number of sections allowed
const MAX_SECTIONS_PER_DASHBOARD = 10; // Set your desired limit

// Update the sections for a specific dashboard
router.post('/:dashboardUrl/sections', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { sections } = req.body;
  const userId = req.user.id;  // User ID from JWT

  try {
    // Fetch the dashboard by URL
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ message: "Dashboard not found" });
    }
    const dashboard = dashboardRes.rows[0];

    // Verify the logged-in user is the owner of the dashboard
    if (dashboard.userid !== userId) {
      return res.status(403).json({ message: "Unauthorized to modify this dashboard's sections" });
    }

    // Begin a transaction
    await pool.query('BEGIN');

    // Delete existing sections for the dashboard
    await pool.query('DELETE FROM sections WHERE dashboardId = $1', [dashboard.dashboardid]);

    // Check if the number of sections being added exceeds the limit
    if (sections.length > MAX_SECTIONS_PER_DASHBOARD) {
      return res.status(400).json({ message: `You can only add up to ${MAX_SECTIONS_PER_DASHBOARD} sections per dashboard.` });
    }    

    // Insert new sections
    for (const section of sections) {
      const insertQuery = 'INSERT INTO sections (dashboardId, title, color, content, orderNum) VALUES ($1, $2, $3, $4, $5)';
      await pool.query(insertQuery, [dashboard.dashboardid, section.title, section.color, section.content, section.orderNum]);
    }

    // Commit the transaction
    await pool.query('COMMIT');

    // Fetch updated sections to return in response
    const updatedSections = await pool.query('SELECT * FROM sections WHERE dashboardId = $1 ORDER BY orderNum', [dashboard.dashboardid]);

    return res.json({ status: 'Updated', sections: updatedSections.rows });
  } catch (error) {
    // Rollback in case of error
    await pool.query('ROLLBACK');
    console.error('Error updating sections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// START DOMAIN VERIFICATION STUFF ----------------

// Route for getting verification details for a specific dashboard
router.get('/:dashboardUrl/get-verification-details', async (req, res) => {
  const { dashboardUrl } = req.params;

  try {
    const result = await getVerificationDetails(dashboardUrl);

    if (result.success) {
      return res.json(result.data);
    } else {
      return res.status(result.error === 'Dashboard not found' ? 404 : 500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in getting verification details:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route for generating a verification token for a specific dashboard
router.post('/:dashboardUrl/generate-verification-token', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;
  const { verificationToken, customDomain } = req.body;

  try {
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    const dashboardId = dashboardRes.rows[0].dashboardid;

    const result = await generateVerificationToken(dashboardId, verificationToken, customDomain);

    if (result.success) {
      return res.json({ message: 'Token, custom domain, and verification status reset saved to database' });
    } else {
      return res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error in generating verification token:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route for DNS verification of a specific dashboard
router.post('/:dashboardUrl/verify-dns', authenticateJWT, async (req, res) => {
  const { dashboardUrl } = req.params;

  try {
    // Fetch the dashboard from the database using dashboardUrl
    const dashboardRes = await pool.query('SELECT * FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);
    if (dashboardRes.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    // Extract necessary details from the dashboard
    const dashboardId = dashboardRes.rows[0].dashboardid;
    const customDomain = dashboardRes.rows[0].customdomain;
    const verificationToken = dashboardRes.rows[0].verificationtoken;

    // Call verifyDNS function with the required dashboard details
    const verificationResult = await verifyDNS(dashboardId, customDomain, verificationToken);

    // Process the verification result
    if (verificationResult.success) {
      return res.json({
        message: 'Verification successful',
        isVerified: verificationResult.isVerified,
        proxyHostResponse: verificationResult.proxyHostResponse // Include additional data if needed
      });
    } else {
      // DNS verification failed
      const status = verificationResult.error === 'Dashboard not found' ? 404 : (verificationResult.error === 'Verification failed' ? 400 : 500);
      return res.status(status).json({ error: verificationResult.error });
    }
  } catch (error) {
    console.error('Error in DNS verification:', error);
    res.status(500).json({ message: 'Internal Server Error', details: error.message });
  }
});

// END DOMAIN VERIFICATION STUFF -------------


//START GOOGLE BUCKET STUFF ------------------

// Route to fetch uploaded media for a specific user
router.get('/users/:username/uploaded-media', async (req, res) => {
  const { username } = req.params;
  try {
    const uploadedMedia = await getUploadedMedia(username);
    res.status(200).json({ uploadedMedia });
  } catch (error) {
    console.error('Error fetching uploaded media:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Route to delete uploaded media for a specific user
router.delete('/users/:username/delete-media', authenticateJWT, async (req, res) => {
  const { username } = req.params;
  const { url } = req.body;
  try {
    await deleteMedia(username, url);
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting uploaded media:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Endpoint for uploading media
router.post('/users/:username/upload-media', authenticateJWT, upload.single('media'), async (req, res) => {
  const { username } = req.params;
  const file = req.file;

  try {
    await uploadMedia(username, file);
    res.status(201).json({ message: 'File uploaded successfully' });
  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

//END GOOGLE BUCKET STUFF ------------

module.exports = router;