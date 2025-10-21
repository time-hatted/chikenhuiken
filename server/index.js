require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase, getUser, createUser, addCoins, claimDailyBonus, saveRun } = require('./db');
const { validateTelegramWebAppData } = require('./telegram');

const app = express();
const PORT = process.env.PORT || 8080;
const BOT_TOKEN = process.env.BOT_TOKEN;

// Check for --migrate flag
if (process.argv.includes('--migrate')) {
  console.log('Running database migration...');
  initDatabase();
  console.log('Migration completed successfully');
  process.exit(0);
}

// Initialize database on startup
initDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS only for development
if (process.env.NODE_ENV === 'development') {
  app.use(cors());
}

// Serve static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// Middleware to validate Telegram data for protected routes
function requireTelegramAuth(req, res, next) {
  const initData = req.body.initData || req.headers['x-init-data'];
  
  if (!initData) {
    return res.status(401).json({ ok: false, error: 'Missing initData' });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: 'BOT_TOKEN not configured' });
  }

  const validation = validateTelegramWebAppData(initData, BOT_TOKEN);
  
  if (!validation.valid) {
    return res.status(401).json({ ok: false, error: validation.error });
  }

  req.telegramUser = validation.user;
  next();
}

// API Routes

/**
 * POST /api/auth/telegram
 * Authenticates user via Telegram WebApp initData
 */
app.post('/api/auth/telegram', (req, res) => {
  try {
    const { initData } = req.body;
    
    if (!initData) {
      return res.status(400).json({ ok: false, error: 'Missing initData' });
    }

    if (!BOT_TOKEN) {
      return res.status(500).json({ ok: false, error: 'BOT_TOKEN not configured' });
    }

    const validation = validateTelegramWebAppData(initData, BOT_TOKEN);
    
    if (!validation.valid) {
      return res.status(401).json({ ok: false, error: validation.error });
    }

    const { id: tgId, firstName, username } = validation.user;
    
    let user = getUser(tgId);
    if (!user) {
      user = createUser(tgId, username, firstName);
    }

    res.json({
      ok: true,
      user: {
        tgId: user.tg_id,
        username: user.username,
        firstName: user.first_name,
        totalCoins: user.total_coins,
        lastDailyClaimAt: user.last_daily_claim_at
      }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/bonus/claim
 * Claims daily bonus (50 coins every 24 hours)
 */
app.post('/api/bonus/claim', requireTelegramAuth, (req, res) => {
  try {
    const tgId = req.telegramUser.id;
    const result = claimDailyBonus(tgId);
    
    if (result.ok) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Bonus claim error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/sessions/complete
 * Saves game session and adds points to user's total
 */
app.post('/api/sessions/complete', requireTelegramAuth, (req, res) => {
  try {
    const tgId = req.telegramUser.id;
    const { runPoints } = req.body;
    
    // Sanity check
    if (typeof runPoints !== 'number' || runPoints < 0 || runPoints > 100000) {
      return res.status(400).json({ ok: false, error: 'Invalid runPoints value' });
    }

    // Save run to history
    saveRun(tgId, runPoints);
    
    // Add points to user's total
    const updatedUser = addCoins(tgId, runPoints);
    
    if (!updatedUser) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({
      ok: true,
      totalCoins: updatedUser.total_coins
    });
  } catch (error) {
    console.error('Session complete error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/me
 * Returns current user info
 */
app.get('/api/me', requireTelegramAuth, (req, res) => {
  try {
    const tgId = req.telegramUser.id;
    const user = getUser(tgId);
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }

    res.json({
      ok: true,
      user: {
        tgId: user.tg_id,
        username: user.username,
        firstName: user.first_name,
        totalCoins: user.total_coins,
        lastDailyClaimAt: user.last_daily_claim_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'production'}`);
  if (!BOT_TOKEN) {
    console.warn('WARNING: BOT_TOKEN not set. Authentication will not work!');
  }
});
