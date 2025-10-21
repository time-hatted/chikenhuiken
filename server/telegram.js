const crypto = require('crypto');

/**
 * Validates Telegram WebApp initData according to official documentation
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function validateTelegramWebAppData(initData, botToken) {
  if (!initData || !botToken) {
    return { valid: false, error: 'Missing initData or botToken' };
  }

  // Validate that initData is a string
  if (typeof initData !== 'string') {
    return { valid: false, error: 'initData must be a string' };
  }

  // Trim whitespace that might cause parsing issues
  initData = initData.trim();

  // Check for empty string after trim
  if (initData.length === 0) {
    return { valid: false, error: 'initData is empty' };
  }

  try {
    // Parse the initData string
    // Use a try-catch specifically for URLSearchParams as it can throw
    // "The string did not match the expected pattern" in some environments
    let urlParams;
    try {
      urlParams = new URLSearchParams(initData);
    } catch (parseError) {
      return { 
        valid: false, 
        error: `Failed to parse initData: ${parseError.message}. The initData string may be malformed or contain invalid characters.` 
      };
    }

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

    // Parse JSON with explicit error handling
    let user;
    try {
      user = JSON.parse(userJson);
    } catch (jsonError) {
      return { 
        valid: false, 
        error: `Failed to parse user data: ${jsonError.message}. The user JSON may be malformed.` 
      };
    }

    // Validate that user object has required fields
    if (!user || typeof user.id === 'undefined') {
      return { valid: false, error: 'User data is missing required fields (id)' };
    }
    
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
