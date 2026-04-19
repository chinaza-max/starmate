const { DataTypes, Model } = require('sequelize');

class CustomRequest extends Model {}

const initCustomRequest = (sequelize) => {
  CustomRequest.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      clientId: { // foreign key to Client
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
        defaultValue: 'PENDING',
      },
      response: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'CustomRequest',
      tableName: 'custom_requests',
      timestamps: true,
      indexes: [{ fields: ['clientId'] }, { fields: ['status'] }],
    }
  );

  return CustomRequest;
};

module.exports = initCustomRequest;