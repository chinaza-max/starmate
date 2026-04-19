// src/types/email.types.js

const EmailTemplate = Object.freeze({
  OTP_VERIFICATION: 'otp-verification',
  WELCOME: 'welcome',
  LOGIN_NOTIFICATION: 'login-notification',
  PASSWORD_RESET: 'password-reset',
  ACCOUNT_CREATED: 'account-created',
  STAFF_LOGIN_DETAILS: 'credential-staff',
});

module.exports = {
  EmailTemplate,
};
