# Facebook Authentication Flow

## OAuth Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant FB as Facebook
    participant B as Backend
    participant DB as PostgreSQL

    U->>F: Click Continue with Facebook
    F->>B: GET /auth/facebook
    B->>FB: Redirect with email and public_profile scopes
    U->>FB: Approve login
    FB->>B: GET /auth/facebook/callback
    B->>FB: Exchange code and retrieve profile
    B->>B: Require an email returned through email permission
    B->>DB: Create/find SocialAccount
    B->>DB: Create refresh-token record
    B-->>F: Set HttpOnly refresh_token cookie
    B-->>F: Redirect to frontend callback
    F->>B: POST /auth/refresh
    B-->>F: Access token and public user
```

## Required Configuration

```env
FACEBOOK_APP_ID="..."
FACEBOOK_APP_SECRET="..."
FACEBOOK_CALLBACK_URL="http://localhost:4000/auth/facebook/callback"
FRONTEND_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000"
```

Register the callback in Meta:

```text
http://localhost:4000/auth/facebook/callback
```

Enable Facebook Login and request these permissions:

- `public_profile`
- `email`

The Facebook callback rejects accounts for which Graph API does not return an email.
