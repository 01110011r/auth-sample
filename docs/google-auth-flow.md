# Google Authentication Flow

## OAuth Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant G as Google
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Click Continue with Google
    F->>B: GET /auth/google
    B->>G: Redirect to Google consent
    U->>G: Approve login
    G->>B: GET /auth/google/callback
    B->>G: Exchange code and retrieve profile
    B->>B: Require a verified provider email
    B->>DB: Create/find SocialAccount
    B->>DB: Create refresh-token record
    B-->>F: Set HttpOnly refresh_token cookie
    B-->>F: Redirect to frontend callback
    F->>B: POST /auth/refresh
    B-->>F: Access token and public user
```

## Required Configuration

```env
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:4000/auth/google/callback"
FRONTEND_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000"
```

Register the callback in Google Cloud:

```text
http://localhost:4000/auth/google/callback
```

Google must return a verified email. If verification is absent or a trusted identity cannot be established, the callback rejects authentication.
