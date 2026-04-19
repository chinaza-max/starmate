const { DataTypes, Model } = require('sequelize');

class Item extends Model {}

const initItem = (sequelize) => {
  Item.init(
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
      },
    },
    {
      sequelize,
      modelName: 'Item',
      tableName: 'items',
      timestamps: true,
    }
  );

  return Item;
};

module.exports = initItem;