const { DataTypes, Model } = require('sequelize');

class DeviceToken extends Model {}

const initDeviceToken = (sequelize) => {
  DeviceToken.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      userId: { // foreign key to User
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      platform: {
        type: DataTypes.ENUM('IOS', 'ANDROID', 'WEB'),
        allowNull: false,
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'DeviceToken',
      tableName: 'device_tokens',
      timestamps: true,
      indexes: [
        { fields: ['userId'] },
        { fields: ['isActive'] },
        { fields: ['platform'] },
      ],
    }
  );

  return DeviceToken;
};

module.exports = initDeviceToken;