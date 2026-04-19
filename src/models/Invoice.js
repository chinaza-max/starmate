const { DataTypes, Model } = require('sequelize');

class Invoice extends Model {}

const initInvoice = (sequelize) => {
  Invoice.init(
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
      invoiceNumber: {
        type: DataTypes.STRING,
        unique: true,
      },
      amountDue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('UNPAID', 'PAID', 'OVERDUE', 'CANCELLED'),
        defaultValue: 'UNPAID',
      },
    },
    {
      sequelize,
      modelName: 'Invoice',
      tableName: 'invoices',
      timestamps: true,
      indexes: [
        { fields: ['bookingId'] },
        { fields: ['status'] },
        { fields: ['invoiceNumber'] },
      ],
    }
  );

  return Invoice;
};

module.exports = initInvoice;