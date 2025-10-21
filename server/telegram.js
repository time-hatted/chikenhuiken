const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData according to official documentation
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' };
  }

  try {
    // Parse the initData string
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    
    if (!hash) {
      return { valid: false, error: 'Hash not found in initData' };
    }

    // Remove hash from params and sort remaining keys
    urlParams.delete('hash');
    
    // Create data-check-string
    const dataCheckArr = [];
    for (const [key, value] of urlParams.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join('\n');

    // Create secret key: HMAC-SHA256(bot_token, "WebAppData")
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // Calculate hash: HMAC-SHA256(data-check-string, secret_key)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false, error: 'Hash validation failed' };
    }

    // Check auth_date (should be within 24 hours)
    const authDate = parseInt(urlParams.get('auth_date'));
    if (!authDate) {
      return { valid: false, error: 'auth_date not found' };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = currentTime - authDate;
    const oneDayInSeconds = 86400;

    if (timeDiff > oneDayInSeconds) {
      return { valid: false, error: 'initData is too old (> 24 hours)' };
    }

    // Parse user data
    const userJson = urlParams.get('user');
    if (!userJson) {
      return { valid: false, error: 'user data not found' };
    }

    const user = JSON.parse(userJson);
    
    return {
      valid: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        languageCode: user.language_code
      }
    };
  } catch (error) {
    return { valid: false, error: `Validation error: ${error.message}` };
  }
}

module.exports = {
  validateTelegramWebAppData
};
