const dns = require('dns');
const util = require('util');
const axios = require('axios');
const resolveTxtAsync = util.promisify(dns.resolveTxt); // Convert dns.resolveTxt to Promise-based

require('dotenv').config();
const { pool } = require('../../database/index.js'); // Adjust the path as necessary

const getVerificationDetails = async (dashboardUrl) => {
  try {
    const dashboardResult = await pool.query('SELECT verificationToken, customDomain, isDomainVerified FROM dashboards WHERE dashboardURL = $1', [dashboardUrl]);

    if (dashboardResult.rows.length > 0) {
      const dashboard = dashboardResult.rows[0];
      return {
        success: true,
        data: {
          verificationToken: dashboard.verificationtoken, // Match your schema's column names
          customDomain: dashboard.customdomain,
          isVerified: dashboard.isdomainverified
        }
      };
    } else {
      return { success: false, error: 'Dashboard not found' };
    }
  } catch (error) {
    console.error('Database error:', error);
    return { success: false, error: 'Internal server error', details: error.message };
  }
};

const generateVerificationToken = async (dashboardId, verificationToken, customDomain) => {
    try {
      const updateQuery = 'UPDATE dashboards SET verificationToken = $1, customDomain = $2, isDomainVerified = false WHERE dashboardId = $3';
      await pool.query(updateQuery, [verificationToken, customDomain, dashboardId]);

      return { success: true };
    } catch (err) {
      return { success: false, error: 'Internal Server Error', details: err.message };
    }
};

  
const verifyDNS = async (dashboardId, customDomain, verificationToken, dashboardUrl) => {
  try {
      console.log(`Starting DNS verification for dashboardId: ${dashboardId}, customDomain: ${customDomain}`);

      // Check if customDomain is valid
      if (!customDomain || typeof customDomain !== 'string') {
          console.error(`Custom domain not set or invalid for dashboardId: ${dashboardId}`);
          return { success: false, error: 'Custom domain not set or invalid' };
      }

      // Perform DNS TXT record check
      console.log(`Resolving TXT records for domain: ${customDomain}`);
      const records = await resolveTxtAsync(customDomain);
      console.log(`Resolved TXT records for ${customDomain}:`, records); // Added log for TXT records

      const isVerified = records.some(record => record.includes(verificationToken));
      console.log(`DNS TXT record check result for ${customDomain}: ${isVerified}`);

      // Update dashboard's verification status in the database
      const updateQuery = 'UPDATE dashboards SET isDomainVerified = $1 WHERE dashboardId = $2';
      await pool.query(updateQuery, [isVerified, dashboardId]);
      console.log(`Dashboard verification status updated in database for dashboardId: ${dashboardId}, isVerified: ${isVerified}`);

      if (isVerified) {
          console.log(`Fetching bearer token for Nginx Proxy Manager`);
          // Fetch bearer token
          let bearerToken;
          const tokenResponse = await axios.post(`${process.env.NGINX_PROXY_MANAGER_URL}/api/tokens`, {
              identity: process.env.NGINX_PROXY_MANAGER_EMAIL,
              secret: process.env.NGINX_PROXY_MANAGER_PASSWORD
          });
          bearerToken = tokenResponse.data.token;

          // Create new proxy host on Nginx Proxy Manager
          console.log(`Creating new proxy host on Nginx Proxy Manager for domain: ${customDomain}`);
          const proxyData = {
            domain_names: [customDomain],
            forward_scheme: "http",
            forward_host: "192.168.1.240", // Your application server
            forward_port: "5000", // The port your app is running on
            advanced_config: `location = / {\n\treturn 301 $scheme://$http_host/erreib/;\n}` // Redirect from root to /erreib
          };
          const response = await axios.post(`${process.env.NGINX_PROXY_MANAGER_URL}/api/nginx/proxy-hosts`, proxyData, {
              headers: {
                  'Authorization': `Bearer ${bearerToken}`
              }
          });

          console.log(`Proxy host created on Nginx Proxy Manager for domain: ${customDomain}, response: ${JSON.stringify(response.data)}`);
          return { success: true, isVerified: isVerified, proxyHostResponse: response.data };
      } else {
          console.error(`DNS verification failed for dashboardId: ${dashboardId}, customDomain: ${customDomain}`);
          return { success: false, isVerified: isVerified, error: 'Verification failed' };
      }
  } catch (error) {
      console.error(`Error in verifyDNS for dashboardId: ${dashboardId}, customDomain: ${customDomain}:`, error);
      return { success: false, error: 'Internal Server Error', details: error.message };
  }
};

module.exports = { generateVerificationToken, verifyDNS, getVerificationDetails };

  