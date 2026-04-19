const { DataTypes, Model } = require('sequelize');

class Staff extends Model {}

const initStaff = (sequelize) => {
  Staff.init(
    {
      id: {
  type: DataTypes.INTEGER.UNSIGNED,
  autoIncrement: true,
  primaryKey: true,
},
      userId: { // foreign key to User
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      specialization: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      hourlyRate: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.0,
      },
      profilePicture: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'Staff',
      tableName: 'staff',
      timestamps: true,
      underscored: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['specialization'] },
      ],
    }
  );

  return Staff;
};

module.exports = initStaff;