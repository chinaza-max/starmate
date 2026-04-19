const { DataTypes, Model } = require('sequelize');

class Message extends Model {}

const initMessage = (sequelize) => {
  Message.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      senderId: { // foreign key to User
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      receiverId: { // foreign key to User
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      messageType: {
        type: DataTypes.ENUM('COMPLAINT', 'INQUIRY', 'GENERAL', 'REPLY'),
        defaultValue: 'GENERAL',
      },
    },
    {
      sequelize,
      modelName: 'Message',
      tableName: 'messages',
      timestamps: true,
      underscored: false,
      indexes: [
        { fields: ['senderId'] },
        { fields: ['receiverId'] },
        { fields: ['isRead'] },
        { fields: ['createdAt'] },
        { fields: ['messageType'] },
      ],
    }
  );

  return Message;
};

module.exports = initMessage;