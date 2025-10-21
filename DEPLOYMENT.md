# Deployment Guide - Telegram Mini App

This guide walks you through deploying Chicken Huiken as a Telegram Mini App.

## Prerequisites

- A Telegram account
- A server with Node.js installed (or cloud hosting service)
- Your server must be accessible via HTTPS

## Step 1: Create a Telegram Bot

1. Open Telegram and find [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Save your **bot token** (looks like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`)
4. Note your bot's username

## Step 2: Create the Mini App

1. Still in BotFather, send `/newapp`
2. Select your bot
3. Provide app details:
   - **Title**: Chicken Huiken
   - **Description**: Cross the Road game with coin collection!
   - **Photo**: Upload a 640x360 screenshot (use the game screenshot)
   - **Demo GIF/Video**: Optional
   - **Short name**: Choose a unique name (e.g., `chickenhuiken`)
4. BotFather will give you a URL like: `https://t.me/YourBotName/chickenhuiken`

## Step 3: Deploy the Server

### Option A: Deploy to Railway

1. Create account at [Railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables:
   ```
   BOT_TOKEN=your_bot_token_here
   PORT=8080
   DATABASE_URL=/app/data.sqlite
   NODE_ENV=production
   ```
5. Set start command: `cd server && npm install && npm start`
6. Railway will provide a public URL (e.g., `https://your-app.railway.app`)

### Option B: Deploy to Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set BOT_TOKEN=your_bot_token_here
   heroku config:set NODE_ENV=production
   ```
5. Create `Procfile` in server directory:
   ```
   web: node index.js
   ```
6. Deploy:
   ```bash
   git subtree push --prefix server heroku main
   ```

### Option C: Deploy to VPS (Ubuntu)

1. SSH into your server
2. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. Install PM2:
   ```bash
   sudo npm install -g pm2
   ```
4. Clone your repository:
   ```bash
   git clone https://github.com/yourusername/chikenhuiken.git
   cd chikenhuiken/server
   ```
5. Install dependencies:
   ```bash
   npm install
   ```
6. Create `.env` file:
   ```bash
   nano .env
   # Add your BOT_TOKEN and other variables
   ```
7. Run database migration:
   ```bash
   npm run migrate
   ```
8. Start with PM2:
   ```bash
   pm2 start index.js --name chicken-game
   pm2 save
   pm2 startup
   ```
9. Set up Nginx as reverse proxy:
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/chicken-game
   ```
   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8080;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
10. Enable site and restart Nginx:
    ```bash
    sudo ln -s /etc/nginx/sites-available/chicken-game /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    ```
11. Install SSL with Let's Encrypt:
    ```bash
    sudo apt install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

## Step 4: Configure BotFather

1. Go back to BotFather in Telegram
2. Send `/myapps`
3. Select your bot and app
4. Click "Edit" → "Web App URL"
5. Enter your deployed server URL (HTTPS required!)
   - Railway: `https://your-app.railway.app`
   - Heroku: `https://your-app-name.herokuapp.com`
   - VPS: `https://your-domain.com`

## Step 5: Test Your Mini App

1. Open the bot URL in Telegram: `https://t.me/YourBotName/chickenhuiken`
2. The app should open in Telegram's Mini App viewer
3. Test features:
   - ✅ Game loads and plays
   - ✅ Coins are tracked
   - ✅ Daily bonus works
   - ✅ Profile displays correctly
   - ✅ Share button works

## Step 6: Optional Enhancements

### Add Bot Commands

In BotFather, set commands:
```
start - Start playing Chicken Huiken
play - Open the game
stats - View your statistics
```

### Add a Start Message

Create a handler in your bot (optional separate bot script):
```javascript
bot.command('start', (ctx) => {
  ctx.reply('Welcome to Chicken Huiken! 🐔', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 Play Game', web_app: { url: 'https://your-app.com' } }
      ]]
    }
  });
});
```

### Enable Rate Limiting

Install express-rate-limit:
```bash
npm install express-rate-limit
```

Add to `server/index.js`:
```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

### Add Monitoring

Install logging:
```bash
npm install morgan
```

Add to `server/index.js`:
```javascript
const morgan = require('morgan');
app.use(morgan('combined'));
```

## Troubleshooting

### App doesn't load
- Check that your server is running: `curl https://your-domain.com`
- Verify BOT_TOKEN is set correctly
- Check server logs for errors
- Ensure database file has write permissions

### Authentication fails
- Verify BOT_TOKEN matches your actual bot token
- Check that Telegram can reach your server
- Look for validation errors in server logs

### Coins not saving
- Check database file exists and is writable
- Verify initData is being sent from client
- Check server logs for database errors

### Daily bonus not working
- Verify server time is correct (important for 24h calculation)
- Check that last_daily_claim_at is being saved
- Test with database query:
  ```bash
  sqlite3 data.sqlite "SELECT * FROM users WHERE tg_id=YOUR_TG_ID;"
  ```

## Production Checklist

Before going live:

- [ ] HTTPS is properly configured
- [ ] BOT_TOKEN is set via environment variables (not in code)
- [ ] Database backups are configured
- [ ] Rate limiting is enabled
- [ ] Security headers are set (helmet.js)
- [ ] Error logging is configured
- [ ] Server monitoring is set up
- [ ] Test on both mobile and desktop Telegram
- [ ] Verify all tabs work correctly
- [ ] Test daily bonus timing
- [ ] Confirm coin system accuracy

## Maintenance

### Database Backups

Set up automatic backups:
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
cp server/data.sqlite backups/backup_$DATE.sqlite
# Keep only last 30 days
find backups/ -name "backup_*.sqlite" -mtime +30 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 3 AM)
crontab -e
# Add: 0 3 * * * /path/to/backup.sh
```

### Monitor Server Health

Check server status:
```bash
pm2 status
pm2 logs chicken-game
```

Check database size:
```bash
du -h server/data.sqlite
```

### Update Application

```bash
cd chikenhuiken
git pull
cd server
npm install
pm2 restart chicken-game
```

## Support

For issues or questions:
- Check server logs first
- Review [README.md](README.md)
- Check [server/README.md](server/README.md)
- Open an issue on GitHub

## Success!

Your Telegram Mini App is now live! 🎉

Share it with friends: `https://t.me/YourBotName/chickenhuiken`
