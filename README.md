# Chicken Huiken - Telegram Mini App

A Crossy Road-style 3D game integrated as a Telegram Mini App with coin collection, daily bonuses, and profile management.

## 🎮 Features

- **3D Game**: Classic chicken crossing the road gameplay with Three.js
- **Coin System**: Earn coins by moving forward in the game
- **Daily Bonus**: Claim +50 coins every 24 hours
- **Telegram Integration**: Full WebApp authentication and profile sharing
- **Bottom Navigation**: Easy switching between Game, Tasks, and Profile tabs
- **Mobile-First Design**: Optimized for Telegram mobile experience

## 🎯 Game Rules

- **Scoring**: Points are earned ONLY when the chicken moves forward (up)
- **Movement**: Left/right/backward movements do NOT award points
- **Game Over**: Hit by vehicles, trains, or fall into water
- **Coins**: Your score is added to your total coins when the game ends

## 📁 Project Structure

```
chikenhuiken/
├── index.html          # Main HTML with tabs structure
├── style.css           # Mobile-first responsive styles
├── script.js           # Game logic + Telegram integration
├── server/             # Backend server
│   ├── index.js        # Express server with API routes
│   ├── db.js           # SQLite database functions
│   ├── telegram.js     # Telegram auth validation
│   ├── package.json    # Server dependencies
│   ├── .env.example    # Environment variables template
│   └── README.md       # Server-specific documentation
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Setup Backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` and add your Telegram bot token:
```
BOT_TOKEN=your_telegram_bot_token_here
PORT=8080
DATABASE_URL=./data.sqlite
```

### 2. Initialize Database

```bash
npm run migrate
```

### 3. Start Server

```bash
# Production
npm start

# Development (with CORS)
npm run dev
```

The server will:
- Serve the game at `http://localhost:8080`
- Handle API requests at `http://localhost:8080/api/*`
- Create/manage SQLite database automatically

## 🔌 API Endpoints

### POST /api/auth/telegram
Authenticates user via Telegram WebApp initData
- **Body**: `{ initData: string }`
- **Returns**: User profile with coins and bonus status

### POST /api/bonus/claim
Claims daily bonus (50 coins every 24 hours)
- **Auth**: Requires valid initData
- **Returns**: Updated total coins and next claim time

### POST /api/sessions/complete
Completes game session and adds points
- **Auth**: Requires valid initData
- **Body**: `{ runPoints: number }`
- **Returns**: Updated total coins

### GET /api/me
Gets current user information
- **Auth**: Requires valid initData
- **Returns**: User profile

## 🎨 Frontend Components

### Tabs
- **Game**: Main gameplay with Play button and 3D canvas
- **Tasks**: Daily bonus claiming interface
- **Profile**: Display coins, Telegram ID, and share button

### UI Elements
- **Coin Overlay**: Top-right corner showing current coins (session + total)
- **Bottom Navigation**: Fixed navigation bar for tab switching
- **Play/Restart Buttons**: Game control buttons

## 🔐 Security

The backend validates all requests using Telegram's WebApp authentication:
1. Validates HMAC-SHA256 signature
2. Checks initData is not older than 24 hours
3. Extracts and verifies user information

**Never trust client-side data**. All sensitive operations are validated server-side.

### Production Recommendations
- Implement rate limiting (e.g., `express-rate-limit`)
- Use HTTPS with valid certificates
- Add security headers (e.g., `helmet.js`)
- Set up monitoring and logging
- Regular security audits

## 🎮 Controls

- **Desktop**: Arrow keys (←↑→↓)
- **Mobile**: Swipe in the direction you want to move

## 🛠️ Development

### Server Development
```bash
cd server
npm run dev
```

### Testing API
```bash
# Test authentication
curl -X POST http://localhost:8080/api/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"initData":"..."}'

# Test bonus claim
curl -X POST http://localhost:8080/api/bonus/claim \
  -H "Content-Type: application/json" \
  -d '{"initData":"..."}'
```

## 📝 Database Schema

### users
- `id`: Primary key
- `tg_id`: Telegram user ID (unique)
- `username`: Telegram username
- `first_name`: User's first name
- `total_coins`: Total coins earned
- `last_daily_claim_at`: Last daily bonus claim timestamp
- `created_at`: Account creation timestamp
- `updated_at`: Last update timestamp

### runs
- `id`: Primary key
- `tg_id`: Telegram user ID
- `points`: Points earned in run
- `created_at`: Run timestamp

## 🚀 Deployment

### As Telegram Mini App

1. Create a Telegram bot via [@BotFather](https://t.me/botfather)
2. Set up Mini App with `/newapp` command
3. Deploy server to a hosting service (Heroku, Railway, VPS, etc.)
4. Configure bot token in server environment
5. Set Mini App URL to your deployed server

### Environment Variables for Production
```
BOT_TOKEN=your_real_bot_token
PORT=8080
DATABASE_URL=./data.sqlite
NODE_ENV=production
```

## 📦 Dependencies

### Frontend
- Three.js (via CDN)
- Telegram WebApp SDK (via CDN)

### Backend
- express: Web server framework
- better-sqlite3: SQLite database driver
- dotenv: Environment variables
- cors: Cross-origin resource sharing

## 🎯 Key Implementation Details

### Forward Movement Scoring
The game logic specifically checks if a movement is "up" (forward) before awarding points:

```javascript
case 'up':
    // ...
    isForwardMove = true; // Only this direction awards points
    break;
```

### Daily Bonus Timing
The bonus system uses 24-hour intervals calculated in milliseconds:

```javascript
const dayInMs = 24 * 60 * 60 * 1000;
if (now - lastClaim < dayInMs) {
    // Bonus not yet available
}
```

### Telegram Authentication
Uses HMAC-SHA256 validation as per [Telegram's documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is based on the original Crossy Road game concept by Moses Odhiambo.

## 🐛 Troubleshooting

### Server won't start
- Check that BOT_TOKEN is set in `.env`
- Ensure port 8080 is not in use
- Run `npm run migrate` if database doesn't exist

### Authentication fails
- Verify BOT_TOKEN is correct
- Check that initData is being sent correctly
- Ensure initData is not older than 24 hours

### Game not loading
- Check browser console for errors
- Verify Three.js CDN is accessible
- Ensure Telegram WebApp SDK is loading

## 📞 Support

For issues or questions, please open an issue on GitHub.
