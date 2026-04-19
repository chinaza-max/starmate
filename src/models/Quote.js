const { DataTypes, Model } = require('sequelize');

class Quote extends Model {}

const initQuote = (sequelize) => {
  Quote.init(
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
      quoteNumber: {
        type: DataTypes.STRING,
        unique: true,
      },
      note : {
  type: DataTypes.TEXT,
  allowNull:true
      },
      subtotal: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      serviceCharge: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      vat: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'),
        defaultValue: 'PENDING',
      },
      expiryDate: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Quote',
      tableName: 'quotes',
      timestamps: true,
      indexes: [
        { fields: ['clientId'] },
        { fields: ['status'] },
        { fields: ['quoteNumber'] },
        { fields: ['expiryDate'] },
      ],
    }
  );

  return Quote;
};

module.exports = initQuote;