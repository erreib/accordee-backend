
# Accordee Backend

## Overview
This Express API is part of my first proper web devleopment project. Most of the code as well as this readme was AI generated, and thus not very good. I will be working on a refactored version for my next project and sharing this one for archival purposes.

The file upload for the thumbnails are currently requires an encrypted json configuration file from your google cloud bucket and will not work otherwise. The domain verification also relies on nginx proxy manager which needs to be running for that to work.

For now the api should be deployed at https://backend.accord.ee .

Accordee Backend is a Node.js server application that powers the Accordee platform. It's designed to manage user authentication, dashboard configurations, and domain verification processes, alongside handling media storage via Google Cloud Storage.

## Features
- User authentication system with signup and login capabilities.
- Dashboard management including creation, update, and retrieval of user-specific dashboards.
- Domain verification for custom dashboard URLs.
- Google Cloud Storage integration for media handling.
- Secure storage and retrieval of sensitive data.

## Getting Started
### Prerequisites
- Node.js
- PostgreSQL
- Google Cloud Storage Bucket
- Nginx Proxy Manager (optional, for custom domain management)

### Installation
1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set up environment variables in `.env` file:
   - Database credentials
   - JWT secret key
   - Google Cloud credentials
   - Nginx Proxy Manager credentials (if using custom domain feature)
4. Initialize the database: Run `node src/database/index.js` to set up required tables.
5. Start the server: `npm start`.

## Documentation
### Directory Structure
- `src/`: Source code directory.
  - `models/`: Contains models for various functionalities like auth, dashboard, etc.
  - `database/`: Database configuration and schema definitions.
  - `secure-file.js`: Utility for secure file operations.
- `.keys-secure/`: Directory for storing encrypted keys and credentials.
- `server.js`: Entry point of the application.

### API Endpoints
- Auth:
  - POST `/auth/signup`: User registration.
  - POST `/auth/login`: User authentication.
- Dashboard:
  - GET `/users/:username/dashboards`: Retrieve user's dashboards.
  - POST `/:dashboardUrl/title`: Update dashboard title.
  - POST `/:dashboardUrl/layout`: Update dashboard layout.
  - POST `/:dashboardUrl/background-style`: Update dashboard background style.
  - POST `/:dashboardUrl/sections`: Update dashboard sections.
- Domain Verification:
  - GET `/:dashboardUrl/get-verification-details`: Retrieve verification details.
  - POST `/:dashboardUrl/generate-verification-token`: Generate a domain verification token.
  - POST `/:dashboardUrl/verify-dns`: Perform DNS verification for a custom domain.
- Google Cloud Storage:
  - GET `/users/:username/uploaded-media`: Fetch uploaded media for a user.
  - POST `/users/:username/upload-media`: Upload media.
  - DELETE `/users/:username/delete-media`: Delete uploaded media.

## Contribution
Contributions to the Accordee Backend are welcome. Please ensure to follow the coding standards and commit guidelines.

## License
This project is licensed under the [MIT License](LICENSE).

---

Accordee Backend © 2023 Accordee Team
