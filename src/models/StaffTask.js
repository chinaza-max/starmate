const { DataTypes, Model } = require('sequelize');

class StaffTask extends Model {}

const initStaffTask = (sequelize) => {
  StaffTask.init(
    {id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      staffId: { // foreign key to Staff
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      taskId: { // foreign key to Task
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      assignedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      modelName: 'StaffTask',
      tableName: 'staff_tasks',
      timestamps: true,
      indexes: [
        { fields: ['staffId'] },
        { fields: ['taskId'] },
        { fields: ['assignedAt'] },
      ],
    }
  );

  return StaffTask;
};

module.exports = initStaffTask;