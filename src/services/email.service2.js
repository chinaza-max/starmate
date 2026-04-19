// ============================================
// src/services/email.service.js
// ============================================

// @ts-nocheck
// ^ optional but recommended if TS still scans JS files

/**
 * Email Service - Wrapper for common email operations
 * Provides convenient methods for sending different types of emails
 */
class EmailService {
  static get templateSvc() {
    // Lazy + anonymous require avoids TS redeclaration entirely
    return require('./email-template.service');
  }

  static async sendOTP(email, firstName, lastName, otp) {
    return this.templateSvc.sendOTPEmail(
      email,
      firstName,
      lastName,
      otp
    );
  }

  static async sendWelcomeEmail(email, firstName) {
    return this.templateSvc.sendWelcomeEmail(
      email,
      firstName
    );
  }

  static async sendLoginNotification(
    email,
    firstName,
    ipAddress,
    device,
    location = 'Unknown'
  ) {
    return this.templateSvc.sendLoginNotification(
      email,
      firstName,
      ipAddress,
      device,
      location
    );
  }

  static async sendPasswordReset(email, firstName, resetCode) {
    return this.templateSvc.sendPasswordResetEmail(
      email,
      firstName,
      resetCode
    );
  }

  static sendStaffLoginDetails(payload) {
    return this.templateSvc.sendStaffLoginDetails(payload);
  }

  static async sendAccountCreated(email, firstName, lastName) {
    return this.templateSvc.sendAccountCreatedEmail(
      email,
      firstName,
  lastName
    );
}

  static async getEmailStats() {
    return this.templateSvc.getEmailStats();
  }

  static async getFailedEmails(limit = 50) {
    return this.templateSvc.getFailedEmails(limit);
  }

  static async retryFailedEmails(maxAttempts = 3) {
    return this.templateSvc.retryFailedEmails(maxAttempts);
  }

  
}

module.exports = EmailService;
