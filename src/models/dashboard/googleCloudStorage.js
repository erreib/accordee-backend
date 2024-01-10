// googleCloudStorage.js
const multer = require('multer');
const { Storage } = require('@google-cloud/storage');
const { pool } = require('../../database/index.js'); // Adjust the path as necessary
const { decryptToString } = require('../../secure-file.js'); 

let storage;

const decryptGoogleCredentials = async () => {
  const secureFileName = './.keys-secure/accordee-c28233c78758.json.secure'; 
  const jsonStr = await decryptToString(secureFileName);
  return JSON.parse(jsonStr);
};

const initGCS = async () => {
  const serviceAccount = await decryptGoogleCredentials();
  storage = new Storage({
    projectId: serviceAccount.project_id,
    credentials: serviceAccount
  });
};

// Call initGCS to initialize storage during module load.
initGCS().catch(console.error);

const multerStorage = multer.memoryStorage();
const upload = multer({ storage: multerStorage });

const getUploadedMedia = async (username) => {
  const result = await pool.query('SELECT uploadedMedia FROM users WHERE username = $1', [username]);
  return result.rows.length > 0 ? result.rows[0].uploadedmedia : [];
};

// Function to delete uploaded media for a specific user
const deleteMedia = async (username, url) => {
  const filename = `${username}/${url.split('/').pop()}`;
  const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);
  await bucket.file(filename).delete();

  const userResult = await pool.query('SELECT uploadedMedia FROM users WHERE username = $1', [username]);
  let uploadedMedia = userResult.rows[0].uploadedmedia || [];
  uploadedMedia = uploadedMedia.filter(item => item !== url);

  await pool.query('UPDATE users SET uploadedMedia = $1 WHERE username = $2', [uploadedMedia, username]);
};

// Function to upload media for a specific user
const uploadMedia = async (username, file) => {
  if (!file) {
    throw new Error('No file uploaded');
  }

  const bucket = storage.bucket(process.env.GCP_BUCKET_NAME);
  const blob = bucket.file(`${username}/${file.originalname}`);
  const blobStream = blob.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
  });

  await new Promise((resolve, reject) => {
    blobStream.on('error', (err) => reject(err));
    blobStream.on('finish', resolve);
    blobStream.end(file.buffer);
  });

  const userResult = await pool.query('SELECT uploadedMedia FROM users WHERE username = $1', [username]);
  let uploadedMedia = userResult.rows[0].uploadedmedia || [];
  const fileUrl = `${process.env.GCP_BUCKET_URL}/${username}/${file.originalname}`;

  if (!uploadedMedia.includes(fileUrl)) {
    uploadedMedia.push(fileUrl);
    await pool.query('UPDATE users SET uploadedMedia = $1 WHERE username = $2', [uploadedMedia, username]);
  }
};

module.exports = { upload, getUploadedMedia, deleteMedia, uploadMedia };

