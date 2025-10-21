const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_URL || './data.sqlite';
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

function initDatabase() {
  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id INTEGER UNIQUE NOT NULL,
      username TEXT,
      first_name TEXT,
      total_coins INTEGER NOT NULL DEFAULT 0,
      last_daily_claim_at INTEGER NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // Create runs table (optional, for tracking game sessions)
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_id INTEGER NOT NULL,
      points INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  console.log('Database initialized successfully');
}

function getUser(tgId) {
  const stmt = db.prepare('SELECT * FROM users WHERE tg_id = ?');
  return stmt.get(tgId);
}

function createUser(tgId, username, firstName) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO users (tg_id, username, first_name, total_coins, last_daily_claim_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, NULL, ?, ?)
  `);
  const result = stmt.run(tgId, username, firstName, now, now);
  return getUser(tgId);
}

function updateUser(tgId, updates) {
  const now = Date.now();
  const fields = [];
  const values = [];
  
  if (updates.totalCoins !== undefined) {
    fields.push('total_coins = ?');
    values.push(updates.totalCoins);
  }
  if (updates.lastDailyClaimAt !== undefined) {
    fields.push('last_daily_claim_at = ?');
    values.push(updates.lastDailyClaimAt);
  }
  
  fields.push('updated_at = ?');
  values.push(now);
  values.push(tgId);
  
  const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE tg_id = ?`);
  stmt.run(...values);
  return getUser(tgId);
}

function addCoins(tgId, coins) {
  const user = getUser(tgId);
  if (!user) return null;
  return updateUser(tgId, { totalCoins: user.total_coins + coins });
}

function claimDailyBonus(tgId) {
  const user = getUser(tgId);
  if (!user) return { ok: false, reason: 'user_not_found' };
  
  const now = Date.now();
  const lastClaim = user.last_daily_claim_at;
  const dayInMs = 24 * 60 * 60 * 1000;
  
  if (lastClaim && (now - lastClaim) < dayInMs) {
    const nextClaimAt = lastClaim + dayInMs;
    return { ok: false, reason: 'already_claimed', nextClaimAt };
  }
  
  const updatedUser = updateUser(tgId, {
    totalCoins: user.total_coins + 50,
    lastDailyClaimAt: now
  });
  
  return {
    ok: true,
    totalCoins: updatedUser.total_coins,
    nextClaimAt: now + dayInMs
  };
}

function saveRun(tgId, points) {
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO runs (tg_id, points, created_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(tgId, points, now);
}

module.exports = {
  db,
  initDatabase,
  getUser,
  createUser,
  updateUser,
  addCoins,
  claimDailyBonus,
  saveRun
};
