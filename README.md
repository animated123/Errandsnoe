# ErrandRunner

A comprehensive errand-running platform for local tasks, laundry, and more. This application is built with React (Vite), Express, and Firebase.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) (v9 or higher)
- A Firebase project (for Firestore and Authentication)
- (Optional) Cloudinary account (for image uploads)
- (Optional) SMS API account (Talksasa)
- (Optional) SMTP server (for email notifications)

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd errand-runner-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory and copy the contents from `.env.example`. Fill in the required values.

```bash
cp .env.example .env
```

Key variables:
- `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps API key.
- `CLOUDINARY_URL`: Your Cloudinary connection string (e.g., `cloudinary://api_key:api_secret@cloud_name`).
- `TALKSASA_API_TOKEN`: Your SMS API token.
- `SMTP_*`: Your email server credentials.

### 4. Firebase Configuration

1. Create a new project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** and **Authentication** (Google sign-in).
3. Register a web app in your Firebase project and copy the configuration object.
4. Create a file named `firebase-applet-config.json` in the root directory with your Firebase config:

```json
{
  "apiKey": "YOUR_API_KEY",
  "authDomain": "YOUR_AUTH_DOMAIN",
  "projectId": "YOUR_PROJECT_ID",
  "storageBucket": "YOUR_STORAGE_BUCKET",
  "messagingSenderId": "YOUR_MESSAGING_SENDER_ID",
  "appId": "YOUR_APP_ID",
  "firestoreDatabaseId": "(default)"
}
```

### 5. Running the Application

#### Development Mode

Runs the server and frontend with hot reloading (via Vite middleware).

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

#### Production Mode

Builds the frontend and runs the server.

```bash
npm run build
npm start
```

## Project Structure

- `server.ts`: Express server entry point.
- `src/`: Frontend React application.
- `firestore.rules`: Security rules for Firestore.
- `firebase-blueprint.json`: Data structure definition.
- `api/`: Server-side API route definitions (if any).
- `services/`: Shared services for frontend and backend.

## Deployment

This application is designed to be deployed to platforms like Google Cloud Run, Heroku, or any VPS that supports Node.js. Ensure you set the environment variables in your deployment environment.
