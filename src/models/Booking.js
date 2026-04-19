// src/models/Booking.js
const { DataTypes, Model } = require('sequelize');

class Booking extends Model {}

const initBooking = (sequelize) => {
  Booking.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      serviceType:{
          type: DataTypes.STRING,
          allowNull:false
      },
      clientId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      quoteId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'SCHEDULED',
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
        
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'Booking',
      tableName: 'bookings',
      timestamps: true,
      indexes: [
        { fields: ['clientId'] },
        { fields: ['status'] },
        { fields: ['quoteId'] },
      ],
    }
  );

  return Booking;
};

module.exports = initBooking;