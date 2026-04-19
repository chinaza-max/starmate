const { DataTypes, Model } = require('sequelize');

class Client extends Model {}

const initClient = (sequelize) => {
  Client.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      address: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      companyName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userId: { // foreign key to User
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'Client',
      tableName: 'clients',
      timestamps: true,
      indexes: [{ fields: ['userId'] }],
    }
  );

  return Client;
};

module.exports = initClient;