const { DataTypes, Model } = require('sequelize');

class Task extends Model {}

const initTask = (sequelize) => {
  Task.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      bookingId: { // foreign key to Booking
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      title: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'ASSIGNED', 'COMPLETED'),
        defaultValue: 'PENDING',
      },
      startTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      endTime: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Task',
      tableName: 'tasks',
      timestamps: true,
      underscored: false,
      indexes: [
        { fields: ['bookingId'] },
        { fields: ['status'] },
        { fields: ['startTime'] },
        { fields: ['endTime'] },
      ],
    }
  );

  return Task;
};

module.exports = initTask;