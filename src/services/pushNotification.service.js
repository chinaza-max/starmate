const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '../config/firebase-service-account.json');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    console.log('Push notifications will be disabled. Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH environment variable.');
  }
}

const sendPushNotification = async (token, title, body, data = {}) => {
  if (!admin.apps.length) {
    console.log('Firebase not initialized, skipping push notification');
    return false;
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      token
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    // If token is invalid, mark it as inactive
    if (error.code === 'messaging/invalid-registration-token' || 
        error.code === 'messaging/registration-token-not-registered') {
      return 'INVALID_TOKEN';
    }
    return false;
  }
};

const sendPushNotificationToMultiple = async (tokens, title, body, data = {}) => {
  if (!admin.apps.length || !tokens.length) {
    return { success: 0, failure: tokens.length };
  }

  try {
    const message = {
      notification: {
        title,
        body
      },
      data: {
        ...data,
        timestamp: new Date().toISOString()
      },
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      success: response.successCount,
      failure: response.failureCount,
      responses: response.responses
    };
  } catch (error) {
    console.error('Error sending multicast push notification:', error);
    return { success: 0, failure: tokens.length };
  }
};

const sendPushNotificationToUser = async (userId, title, body, data = {}, DeviceToken) => {
  const deviceTokens = await DeviceToken.findAll({
    where: {
      userId,
      isActive: true
    }
  });

  if (deviceTokens.length === 0) {
    return { success: 0, failure: 0 };
  }

  const tokens = deviceTokens.map(dt => dt.token);
  return await sendPushNotificationToMultiple(tokens, title, body, data);
};

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendPushNotificationToUser
};

