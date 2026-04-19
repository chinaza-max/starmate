
const initUser = require('./User');
const initClient = require('./Client');
const initStaff = require('./Staff');
const initQuote = require('./Quote');
const initItem = require('./Item');
const initQuoteItem = require('./QuoteItem');
const initBooking = require('./Booking');
const initTask = require('./Task');
const initStaffTask = require('./StaffTask');
const initInvoice = require('./Invoice');
const initCustomRequest = require('./CustomRequest');
const initDeviceToken = require('./DeviceToken');
const initMessage = require('./Message');
const initEmailLog = require('./email-log.model');
const initService = require("./Services")
const initBookingSchedule = require('./BookingSchedule');

const initModels = (sequelize) => {
  // ── Initialize all models ─────────────────────────
  const User = initUser(sequelize);
  const Client = initClient(sequelize);
  const Staff = initStaff(sequelize);
  const Quote = initQuote(sequelize);
  const Item = initItem(sequelize);
  const QuoteItem = initQuoteItem(sequelize);
  const Booking = initBooking(sequelize);
  const Task = initTask(sequelize);
  const StaffTask = initStaffTask(sequelize);
  const Invoice = initInvoice(sequelize);
  const CustomRequest = initCustomRequest(sequelize);
  const DeviceToken = initDeviceToken(sequelize);
  const Message = initMessage(sequelize);
  const EmailLog = initEmailLog(sequelize);
  const Service =initService(sequelize)
  const BookingSchedule = initBookingSchedule(sequelize);
  // ── User & Client (One-to-One) ────────────────────
  User.hasOne(Client, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Client.belongsTo(User, { foreignKey: 'userId' });
  
  // ── Quote & QuoteItem (One-to-Many) — needed for direct include ──
Quote.hasMany(QuoteItem, { foreignKey: 'quoteId' });
QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' }); // already exists, no duplicate harm
  // ── User & Staff (One-to-One) ─────────────────────
  User.hasOne(Staff, { foreignKey: 'userId', onDelete: 'CASCADE' });
  Staff.belongsTo(User, { foreignKey: 'userId' });

  // ── Client & Quote (One-to-Many) ──────────────────
  Client.hasMany(Quote, { foreignKey: 'clientId' });
  Quote.belongsTo(Client, { foreignKey: 'clientId' });

  // ── Client & Booking (One-to-Many) ────────────────
  Client.hasMany(Booking, { foreignKey: 'clientId' });
  Booking.belongsTo(Client, { foreignKey: 'clientId' });

  // ── Quote & Item (Many-to-Many via QuoteItem) ─────
  Quote.belongsToMany(Item, {
    through: QuoteItem,
    foreignKey: 'quoteId',
  });

  Item.belongsToMany(Quote, {
    through: QuoteItem,
    foreignKey: 'itemId',
  });


  Quote.hasMany(QuoteItem, { foreignKey: 'quoteId' });
  Item.hasMany(QuoteItem, { foreignKey: 'itemId' });


  // ── QuoteItem direct relationships ────────────────
  QuoteItem.belongsTo(Quote, { foreignKey: 'quoteId' });
  QuoteItem.belongsTo(Item, { foreignKey: 'itemId' });

  // ── Quote & Booking (One-to-One) ──────────────────
  Quote.hasOne(Booking, { foreignKey: 'quoteId' });
  Booking.belongsTo(Quote, { foreignKey: 'quoteId' });

  // ── Booking & Task (One-to-Many) ──────────────────
  Booking.hasMany(Task, { foreignKey: 'bookingId' });
  Task.belongsTo(Booking, { foreignKey: 'bookingId' });

  // ── Staff & Task (Many-to-Many via StaffTask) ─────
  Staff.belongsToMany(Task, {
    through: StaffTask,
    foreignKey: 'staffId',
  });

  Task.belongsToMany(Staff, {
    through: StaffTask,
    foreignKey: 'taskId',
  });

  // ── Booking & Invoice (One-to-One) ────────────────
  Booking.hasOne(Invoice, { foreignKey: 'bookingId' });
  Invoice.belongsTo(Booking, { foreignKey: 'bookingId' });

  // ── Client & CustomRequest (One-to-Many) ──────────
  Client.hasMany(CustomRequest, { foreignKey: 'clientId' });
  CustomRequest.belongsTo(Client, { foreignKey: 'clientId' });

  // ── User & DeviceToken (One-to-Many) ──────────────
  User.hasMany(DeviceToken, {
    foreignKey: 'userId',
    onDelete: 'CASCADE',
  });
  DeviceToken.belongsTo(User, { foreignKey: 'userId' });

  // ── User & Message (Sender / Receiver) ────────────
  User.hasMany(Message, {
    foreignKey: 'senderId',
    as: 'sentMessages',
  });

  User.hasMany(Message, {
    foreignKey: 'receiverId',
    as: 'receivedMessages',
  });

  Message.belongsTo(User, {
    foreignKey: 'senderId',
    as: 'sender',
  });

  Message.belongsTo(User, {
    foreignKey: 'receiverId',
    as: 'receiver',
  });

  // ── Booking & BookingSchedule (One-to-Many) ──────────
Booking.hasMany(BookingSchedule, {
  foreignKey: 'bookingId',
  as: 'schedules',
  onDelete: 'CASCADE',
});

BookingSchedule.belongsTo(Booking, {
  foreignKey: 'bookingId',
});

  return {
    User,
    Client,
    Staff,
    Quote,
    Item,
    QuoteItem,
    Booking,
    Task,
    StaffTask,
    Invoice,
    CustomRequest,
    DeviceToken,
    Message,
    EmailLog,
    Service,
    BookingSchedule
  };
};

module.exports = initModels;