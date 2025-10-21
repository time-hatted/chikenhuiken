# Chicken Huiken - Backend Server

Backend server for the Chicken Huiken Telegram Mini App game.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your bot token:
```bash
cp .env.example .env
```

3. Edit `.env` and add your Telegram bot token:
```
BOT_TOKEN=your_bot_token_here
PORT=8080
DATABASE_URL=./data.sqlite
```

## Running the Server

### Production mode:
```bash
npm start
```

### Development mode:
```bash
npm run dev
```

### Run database migration only:
```bash
npm run migrate
```

## API Endpoints

### POST /api/auth/telegram
Authenticates a user via Telegram WebApp initData.
- Body: `{ initData: string }`
- Returns: User profile with coins and daily bonus status

### POST /api/bonus/claim
Claims daily bonus (50 coins, available every 24 hours).
- Requires: Valid initData in body or X-Init-Data header
- Returns: Updated total coins and next claim time

### POST /api/sessions/complete
Completes a game session and adds points to user's total.
- Requires: Valid initData in body or X-Init-Data header
- Body: `{ runPoints: number }`
- Returns: Updated total coins

### GET /api/me
Returns current user information.
- Requires: Valid initData in X-Init-Data header
- Returns: User profile

## Database Schema

### users table
- `id`: Primary key
- `tg_id`: Telegram user ID (unique)
- `username`: Telegram username
- `first_name`: User's first name
- `total_coins`: Total coins earned
- `last_daily_claim_at`: Timestamp of last daily bonus claim
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

### runs table
- `id`: Primary key
- `tg_id`: Telegram user ID
- `points`: Points earned in run
- `created_at`: Run timestamp

## Security

The server validates all incoming requests using Telegram's WebApp authentication:
1. Validates HMAC-SHA256 signature
2. Checks that initData is not older than 24 hours
3. Extracts and verifies user information

Never trust data sent directly from the client. Always validate via initData.

### Production Security Recommendations
- Add rate limiting (e.g., express-rate-limit) to prevent abuse
- Use HTTPS in production
- Set secure headers (e.g., helmet.js)
- Monitor for suspicious activity
- Implement request logging
