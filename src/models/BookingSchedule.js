// src/models/BookingSchedule.js
const { DataTypes, Model } = require('sequelize');

class BookingSchedule extends Model {}

const initBookingSchedule = (sequelize) => {
  BookingSchedule.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      bookingId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      startTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
      endTime: {
        type: DataTypes.TIME,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'BookingSchedule',
      tableName: 'booking_schedules',
      timestamps: true,
      indexes: [
        { fields: ['bookingId'] },
        { fields: ['date'] },
      ],
    }
  );

  return BookingSchedule;
};

module.exports = initBookingSchedule;