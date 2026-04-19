const { DataTypes, Model } = require('sequelize');

class Service extends Model {}

const initService = (sequelize) => {
  Service.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      basePrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      }
    },
    {
      sequelize,
      modelName: 'Service',
      tableName: 'services',
      timestamps: true,
    }
  );

  return Service;
};

module.exports = initService;