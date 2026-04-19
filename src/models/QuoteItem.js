const { DataTypes, Model } = require('sequelize');

class QuoteItem extends Model {}

const initQuoteItem = (sequelize) => {
  QuoteItem.init(
    {id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      quoteId: { // foreign key to Quote
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      itemId: { // foreign key to Item
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      unitPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      totalPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'QuoteItem',
      tableName: 'quote_items',
      timestamps: true,
      indexes: [
        { fields: ['quoteId'] },
        { fields: ['itemId'] },
      ],
    }
  );

  return QuoteItem;
};

module.exports = initQuoteItem;