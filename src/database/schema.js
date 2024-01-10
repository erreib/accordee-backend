const usersTable = `
  CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE,
      uploadedMedia TEXT[]
  );
`;

const dashboardsTable = `
  CREATE TABLE IF NOT EXISTS dashboards (
      dashboardId SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES users(id) ON DELETE CASCADE,
      dashboardURL VARCHAR(255),
      dashboardThumbnailUrl VARCHAR(255),
      dashboardTitle VARCHAR(255),
      dashboardLayout VARCHAR(255) DEFAULT 'basic',
      backgroundStyle VARCHAR(255) DEFAULT 'style1',
      customDomain VARCHAR(255),
      verificationToken VARCHAR(255),
      isDomainVerified BOOLEAN DEFAULT false
  );
`;

const sectionsTable = `
  CREATE TABLE IF NOT EXISTS sections (
      id SERIAL PRIMARY KEY,
      dashboardId INTEGER REFERENCES dashboards(dashboardId) ON DELETE CASCADE,
      title VARCHAR(255),
      color VARCHAR(50),
      content TEXT,
      orderNum INTEGER,
      thumbnailUrl VARCHAR(255)
  );
`;

module.exports = {
  usersTable,
  dashboardsTable,
  sectionsTable
};
