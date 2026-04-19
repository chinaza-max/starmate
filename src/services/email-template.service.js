// ============================================
// src/services/email-template.service.js
// ============================================
const ejs = require('ejs');
const path = require('path');
const { transporter, emailConfig } = require('../config/email');
const { EmailTemplate } = require('../types/email.types');

const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { EmailLog } = models;


const { Op } = require('sequelize');

module.exports = class {
  static templatePath = path.join(__dirname, '../templates/emails');

  static async renderTemplate(template, data) {
    const templateFile = path.join(this.templatePath, `${template}.ejs`);

    const templateData = {
      ...data,
      appName: process.env.APP_NAME || 'MVC App',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@yourapp.com',
      currentYear: new Date().getFullYear(),
    };

    return ejs.renderFile(templateFile, templateData);
  }

  static async sendEmail(payload) {
    let logId;

   // console.log('Preparing to send email:', payload);
    try {
      const log = await EmailLog.create({
        recipient: payload.to,
        template: payload.template,
        subject: payload.subject,
        status: 'pending',
        payload: payload.data,
        attempts: 1,
      });

      logId = log.id;

      const html = await this.renderTemplate(payload.template, payload.data);

      const info = await transporter.sendMail({
        from: emailConfig.from,
        to: payload.to,
        subject: payload.subject,
        html,
      });

      await EmailLog.update(
        {
          status: 'sent',
          messageId: info.messageId,
          sentAt: new Date(),
        },
        { where: { id: logId } }
      );

      return {
        success: true,
        messageId: info.messageId,
        recipient: payload.to,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Email send error:', error);

      if (logId) {
        await EmailLog.update(
          { status: 'failed', errorMessage: error.message },
          { where: { id: logId } }
        );
      }

      return {
        success: false,
        error: error.message,
        recipient: payload.to,
        timestamp: new Date(),
      };
    }
  }

  static sendOTPEmail(email, firstName, lastName, otp) {
    return this.sendEmail({
      to: email,
      subject: 'Email Verification - OTP Code',
      template: EmailTemplate.OTP_VERIFICATION,
      data: { firstName, lastName, otp },
    });
  }

  static sendWelcomeEmail(email, firstName) {
    return this.sendEmail({
      to: email,
      subject: 'Welcome!',
      template: EmailTemplate.WELCOME,
      data: { firstName },
    });
  }

  static sendLoginNotification(email, firstName, ipAddress, device, location) {
    return this.sendEmail({
      to: email,
      subject: 'New Login Detected',
      template: EmailTemplate.LOGIN_NOTIFICATION,
      data: { firstName, ipAddress, device, location },
    });
  }

  static sendPasswordResetEmail(email, firstName, resetCode) {
    return this.sendEmail({
      to: email,
      subject: 'Password Reset',
      template: EmailTemplate.PASSWORD_RESET,
      data: { firstName, resetCode },
    });
  }

  static sendStaffLoginDetails(payload) {
    return this.sendEmail({
      to: payload.to,
      subject: 'Your Login Details',
      template: EmailTemplate.STAFF_LOGIN_DETAILS,
      data: payload,
    });
  }

  static async getEmailStats() {
    const [total, sent, failed, pending] = await Promise.all([
      EmailLog.count(),
      EmailLog.count({ where: { status: 'sent' } }),
      EmailLog.count({ where: { status: 'failed' } }),
      EmailLog.count({ where: { status: 'pending' } }),
    ]);

    return { total, sent, failed, pending };
  }

  static async retryFailedEmails(maxAttempts = 3) {
    const failed = await EmailLog.findAll({
      where: {
        status: 'failed',
        attempts: { [Op.lt]: maxAttempts },
      },
    });

    for (const log of failed) {
      await EmailLog.update(
        { attempts: log.attempts + 1 },
        { where: { id: log.id } }
      );

      await this.sendEmail({
        to: log.recipient,
        subject: log.subject,
        template: log.template,
        data: log.payload,
      });
    }
  }
};
