# Authentication Implementation

## Overview

Token-based authentication using JWT (JSON Web Tokens) has been implemented for the Panon API.

## Environment Variables

Add the following to your `.env` file:

```bash
JWT_SECRET=your-secret-key-change-in-production
```

## API Endpoints

### POST /login

Authenticate user and receive a JWT token.

**Request Body:**
```json
{
  "username": "your-username",
  "password": "your-password"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "your-username"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid username or password"
}
```

### Protected Routes

All other API routes require authentication via the `Authorization` header:

```
Authorization: Bearer <token>
```

**Protected Endpoints:**
- `GET /workspace/:workspaceId`
- `POST /derive-address`
- `POST /save`
- `GET /load?workspaceId=:id`
- `POST /workspace`
- `PUT /workspace/:workspaceId`
- `GET /workspaces`
- `GET /wallets`

## Token Details

- **Algorithm:** HS256
- **Expiration:** 24 hours
- **Claims:**
  - `user_id`: User ID
  - `username`: Username
  - `exp`: Expiration time
  - `iat`: Issued at time

## Usage Example

```bash
# Login
curl -X POST http://localhost:3333/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# Use token in protected route
curl -X GET http://localhost:3333/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Files Created/Modified

- `internal/service/token.go` - JWT token service (new)
- `internal/handlers/auth.go` - Auth handlers including login (new)
- `internal/middleware/auth.go` - Updated auth middleware
- `internal/handlers/handlers.go` - Updated to include login route
- `main.go` - Updated to wire up auth system
