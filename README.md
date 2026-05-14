# Get Connected

Secure file & folder sharing app. Upload files protected with a PIN, share the Host ID, and let receivers access, preview, and download them.

## Tech Stack

- **Frontend:** Next.js (App Router) + Tailwind CSS (Glassmorphism UI)
- **Backend:** Firebase Firestore (metadata) + Firebase Storage (file blobs)
- **Auth:** bcryptjs PIN hashing + cookie-based session tokens
- **Archiving:** JSZip (client + server-side folder zipping)

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Firestore and Storage enabled

### 1. Clone & Install

```bash
git clone https://github.com/novahbyshahzaib/Get-Connected-.git
cd Get-Connected-
npm install
```

### 2. Environment Variables

The `.env.local` file is pre-configured for the Firebase project. If using your own Firebase project, update:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-key.json
```

Save your Firebase Admin SDK service account JSON as `firebase-service-key.json` in the project root.

### 3. Firebase Setup

- Enable **Firestore Database** in your Firebase project
- Enable **Firebase Storage** (start in test mode, then configure rules)
- Generate a **Service Account** key from Project Settings > Service Accounts

### 4. Run Locally

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Deploy to Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

For production with server actions, configure Firebase Cloud Functions:

```bash
npm install -g firebase-tools
firebase init hosting
firebase deploy
```

## Usage

### Share Files (Host)
1. Click "Share Files" on the home page
2. Drag & drop files or folders (or click to browse)
3. Set a PIN for protection
4. Click "Upload & Generate Link"
5. Share the displayed **Host ID** with your receiver

### Access Files (Receiver)
1. Enter the **Host ID** on the home page
2. Enter the **PIN**
3. Browse and preview files in the dashboard
4. Download individual files or click "Download All" to get a ZIP

## Security

- PINs are hashed with bcrypt before storage
- File access requires PIN verification via server actions
- Download URLs are time-limited signed URLs (1 hour expiry)
- Session tokens stored in httpOnly cookies
- Cleanup routine auto-deletes expired sessions

## License

MIT
