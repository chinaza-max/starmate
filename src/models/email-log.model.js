const { DataTypes, Model } = require('sequelize');

class EmailLog extends Model {}

const initEmailLog = (sequelize) => {
  EmailLog.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      recipient: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      template: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('sent', 'failed', 'pending'),
        allowNull: false,
        defaultValue: 'pending',
      },
      messageId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      payload: {
        type: DataTypes.JSON,
        allowNull: false,
      },
      attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      sentAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'EmailLog',
      tableName: 'email_logs',
      timestamps: true,
      updatedAt: false,
      underscored: false,
      indexes: [
        { fields: ['recipient'] },
        { fields: ['template'] },
        { fields: ['status'] },
        { fields: ['createdAt'] },
      ],
    }
  );

  return EmailLog;
};

module.exports = initEmailLog;