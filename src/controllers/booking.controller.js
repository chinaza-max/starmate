const { sendPushNotificationToUser } = require('../services/pushNotification.service');
const { Op } = require('sequelize');
const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User, Client,Quote, Booking, Task, Invoice, Staff, BookingSchedule,DeviceToken } = models;

exports.convertToBooking = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { quoteId, bookingDate, notes } = req.body;
    const quote = await Quote.findByPk(quoteId);

    if (!quote || quote.status !== 'ACCEPTED') {
      return res.status(400).json({ success: false, message: 'Quote must be accepted first' });
    }

    const booking = await Booking.create({
      quoteId,
      clientId: quote.clientId,
      bookingDate,
      notes,
      status: 'SCHEDULED'
    }, { transaction: t });

    // Send push notification to client
    const client = await Client.findByPk(quote.clientId, { include: [{ model: User }] });
    if (client && client.User) {
      await sendPushNotificationToUser(
        client.User.id,
        'Booking Created',
        `Your booking has been created for ${new Date(bookingDate).toLocaleDateString()}`,
        { type: 'BOOKING_CREATED', bookingId: booking.id },
        DeviceToken
      );
    }

    // Auto-generate invoice
    await Invoice.create({
      bookingId: booking.id,
      invoiceNumber: `INV-${Date.now()}`,
      amountDue: quote.totalAmount,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 7)), // 7 days from now
      status: 'UNPAID'
    }, { transaction: t });

    quote.status = 'CONVERTED';
    await quote.save({ transaction: t });

    await t.commit();
    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};

/*
exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalClients,
      newClientsThisMonth,
      totalStaff,
      totalBookings,
      bookingsByStatus,
      newBookingsThisMonth,
      newBookingsLastMonth,
      upcomingSchedules,
      recentBookings,
      staffWorkload,
      taskStatusBreakdown,
    ] = await Promise.all([

      // 1. Total clients
      Client.count(),

      // 2. New clients this month
      Client.count({
        where: { createdAt: { [Op.gte]: startOfMonth } }
      }),

      // 3. Total staff
      Staff.count(),

      // 4. Total bookings
      Booking.count(),

      // 5. Bookings grouped by status
      Booking.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),

      // 6. New bookings this month
      Booking.count({
        where: { createdAt: { [Op.gte]: startOfMonth } }
      }),

      // 7. New bookings last month (for growth comparison)
      Booking.count({
        where: {
          createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] }
        }
      }),

      // 8. Upcoming schedules (next 7 days)
      BookingSchedule.findAll({
        where: {
          date: {
            [Op.between]: [
              now.toISOString().split('T')[0],
              new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            ]
          }
        },
        include: [
          {
            model: Booking,
            attributes: ['id', 'status', 'serviceType', 'address'],
            include: [
              {
                model: Client,
                attributes: ['id'],
                include: [
                  {
                    model: User,
                    attributes: ['firstName', 'lastName', 'phone']
                  }
                ]
              }
            ]
          }
        ],
        order: [['date', 'ASC'], ['startTime', 'ASC']],
        limit: 10
      }),

      // 9. Recent bookings (last 5)
      Booking.findAll({
        include: [
          {
            model: Client,
            attributes: ['id'],
            include: [{ model: User, attributes: ['firstName', 'lastName'] }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),

      // 10. Staff workload (how many tasks each staff has)
      Staff.findAll({
        attributes: ['id', 'profilePicture'],
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName']
          },
          {
            model: Task,
            attributes: ['id', 'status'],
            through: { attributes: [] },
            required: false
          }
        ]
      }),

      // 11. Task status breakdown
      Task.findAll({
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
    ]);

    // ── Format bookings by status into a clean map ───────────────
    const bookingStatusMap = {
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };
    bookingsByStatus.forEach(({ status, count }) => {
      bookingStatusMap[status] = parseInt(count);
    });

    // ── Format task status breakdown ─────────────────────────────
    const taskStatusMap = {};
    taskStatusBreakdown.forEach(({ status, count }) => {
      taskStatusMap[status] = parseInt(count);
    });

    // ── Booking growth % vs last month ───────────────────────────
    const bookingGrowth = newBookingsLastMonth === 0
      ? 100
      : Math.round(((newBookingsThisMonth - newBookingsLastMonth) / newBookingsLastMonth) * 100);

    // ── Format staff workload ────────────────────────────────────
    const formattedStaffWorkload = staffWorkload.map((s) => {
      const data = s.toJSON();
      const tasks = data.Tasks || [];
      return {
        staffId: data.id,
        name: `${data.User?.firstName || ''} ${data.User?.lastName || ''}`.trim(),
        profilePicture: data.profilePicture || null,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
        assignedTasks: tasks.filter(t => t.status === 'ASSIGNED').length,
      };
    });

    // ── Format upcoming schedules ────────────────────────────────
    const formattedUpcoming = upcomingSchedules.map((s) => {
      const data = s.toJSON();
      const clientUser = data.Booking?.Client?.User;
      return {
        scheduleId: data.id,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        booking: {
          id: data.Booking?.id,
          serviceType: data.Booking?.serviceType,
          status: data.Booking?.status,
          address: data.Booking?.address || null,
          client: {
            name: `${clientUser?.firstName || ''} ${clientUser?.lastName || ''}`.trim(),
            phone: clientUser?.phone || null
          }
        }
      };
    });

    // ── Format recent bookings ───────────────────────────────────
    const formattedRecentBookings = recentBookings.map((b) => {
      const data = b.toJSON();
      const clientUser = data.Client?.User;
      return {
        bookingId: data.id,
        serviceType: data.serviceType,
        status: data.status,
        address: data.address || null,
        createdAt: data.createdAt,
        client: {
          name: `${clientUser?.firstName || ''} ${clientUser?.lastName || ''}`.trim()
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalClients,
          newClientsThisMonth,
          totalStaff,
          totalBookings,
          newBookingsThisMonth,
          bookingGrowthVsLastMonth: `${bookingGrowth > 0 ? '+' : ''}${bookingGrowth}%`,
        },
        bookingsByStatus: bookingStatusMap,
        tasksByStatus: taskStatusMap,
        upcomingSchedules: formattedUpcoming,
        recentBookings: formattedRecentBookings,
        staffWorkload: formattedStaffWorkload,
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
*/



exports.getDashboardStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalClients,
      newClientsThisMonth,
      totalStaff,
      totalBookings,
      bookingsByStatus,
      newBookingsThisMonth,
      newBookingsLastMonth,
      upcomingSchedules,
      recentBookings,
      staffWorkload,
      taskStatusBreakdown,
    ] = await Promise.all([

      // 1. Total clients — via User role
      User.count({
        where: { role: 'CLIENT', isActive: true }
      }),

      // 2. New clients this month — via User role
      User.count({
        where: {
          role: 'CLIENT',
          createdAt: { [Op.gte]: startOfMonth }
        }
      }),

      // 3. Total staff — via User role
      User.count({
        where: { role: 'STAFF', isActive: true }
      }),

      // 4. Total bookings
      Booking.count(),

      // 5. Bookings grouped by status
      Booking.findAll({
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),

      // 6. New bookings this month
      Booking.count({
        where: { createdAt: { [Op.gte]: startOfMonth } }
      }),

      // 7. New bookings last month
      Booking.count({
        where: {
          createdAt: { [Op.between]: [startOfLastMonth, endOfLastMonth] }
        }
      }),

      // 8. Upcoming schedules (next 7 days)
      BookingSchedule.findAll({
        where: {
          date: {
            [Op.between]: [
              now.toISOString().split('T')[0],
              new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
                .toISOString().split('T')[0]
            ]
          }
        },
        include: [
          {
            model: Booking,
            attributes: ['id', 'status', 'serviceType', 'address'],
            include: [
              {
                model: Client,
                attributes: ['id'],
                include: [
                  {
                    model: User,
                    attributes: ['firstName', 'lastName', 'phone']
                  }
                ]
              }
            ]
          }
        ],
        order: [['date', 'ASC'], ['startTime', 'ASC']],
        limit: 10
      }),

      // 9. Recent bookings (last 5)
      Booking.findAll({
        include: [
          {
            model: Client,
            attributes: ['id'],
            include: [
              {
                model: User,
                attributes: ['firstName', 'lastName']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),

      // 10. Staff workload
      Staff.findAll({
        attributes: ['id', 'profilePicture'],
        include: [
          {
            model: User,
            attributes: ['firstName', 'lastName'],
            where: { isActive: true }
          },
          {
            model: Task,
            attributes: ['id', 'status'],
            through: { attributes: [] },
            required: false
          }
        ]
      }),

      // 11. Task status breakdown
      Task.findAll({
        attributes: [
          'status',
          [fn('COUNT', col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      }),
    ]);

    // ── Booking status map ───────────────────────────────────────
    const bookingStatusMap = {
      SCHEDULED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0
    };
    bookingsByStatus.forEach(({ status, count }) => {
      bookingStatusMap[status] = parseInt(count);
    });

    // ── Task status map ──────────────────────────────────────────
    const taskStatusMap = {};
    taskStatusBreakdown.forEach(({ status, count }) => {
      taskStatusMap[status] = parseInt(count);
    });

    // ── Booking growth % vs last month ───────────────────────────
    const bookingGrowth = newBookingsLastMonth === 0
      ? 100
      : Math.round(
          ((newBookingsThisMonth - newBookingsLastMonth) / newBookingsLastMonth) * 100
        );

    // ── Staff workload ───────────────────────────────────────────
    const formattedStaffWorkload = staffWorkload.map((s) => {
      const data = s.toJSON();
      const tasks = data.Tasks || [];
      return {
        staffId: data.id,
        name: `${data.User?.firstName || ''} ${data.User?.lastName || ''}`.trim(),
        profilePicture: data.profilePicture || null,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'COMPLETED').length,
        assignedTasks: tasks.filter(t => t.status === 'ASSIGNED').length,
        inProgressTasks: tasks.filter(t => t.status === 'IN_PROGRESS').length,
      };
    });

    // ── Upcoming schedules ───────────────────────────────────────
    const formattedUpcoming = upcomingSchedules.map((s) => {
      const data = s.toJSON();
      const clientUser = data.Booking?.Client?.User;
      return {
        scheduleId: data.id,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        booking: {
          id: data.Booking?.id,
          serviceType: data.Booking?.serviceType,
          status: data.Booking?.status,
          address: data.Booking?.address || null,
          client: {
            name: `${clientUser?.firstName || ''} ${clientUser?.lastName || ''}`.trim(),
            phone: clientUser?.phone || null
          }
        }
      };
    });

    // ── Recent bookings ──────────────────────────────────────────
    const formattedRecentBookings = recentBookings.map((b) => {
      const data = b.toJSON();
      const clientUser = data.Client?.User;
      return {
        bookingId: data.id,
        serviceType: data.serviceType,
        status: data.status,
        address: data.address || null,
        createdAt: data.createdAt,
        client: {
          name: `${clientUser?.firstName || ''} ${clientUser?.lastName || ''}`.trim()
        }
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalClients,
          newClientsThisMonth,
          totalStaff,
          totalBookings,
          newBookingsThisMonth,
          bookingGrowthVsLastMonth: `${bookingGrowth > 0 ? '+' : ''}${bookingGrowth}%`,
        },
        bookingsByStatus: bookingStatusMap,
        tasksByStatus: taskStatusMap,
        upcomingSchedules: formattedUpcoming,
        recentBookings: formattedRecentBookings,
        staffWorkload: formattedStaffWorkload,
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createBooking = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { clientId, quoteId, notes,address, schedules,serviceType } = req.body;

    // Basic validation
    if (!clientId || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: "clientId and at least one schedule are required",
      });
    }

    // Optional: validate quote if provided
    let quote = null;
    if (quoteId) {
      quote = await Quote.findByPk(quoteId);
      if (!quote || quote.status !== "ACCEPTED") {
        return res.status(400).json({
          success: false,
          message: "Quote must be accepted first",
        });
      }
    }

    // Create Booking
    const booking = await Booking.create(
      {
        clientId,
        quoteId: quoteId || null,
        notes,
        status: "SCHEDULED",
        serviceType,
        address
      },
      { transaction: t }
    );

    // Prepare schedules
    const scheduleData = schedules.map((s) => ({
      bookingId: booking.id,
      date: s.date,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
    }));

    await BookingSchedule.bulkCreate(scheduleData, { transaction: t });

    // Auto-generate invoice if quote exists
    /*
    if (quote) {
      await Invoice.create(
        {
          bookingId: booking.id,
          invoiceNumber: `INV-${Date.now()}`,
          amountDue: quote.totalAmount,
          dueDate: new Date(
            new Date().setDate(new Date().getDate() + 7)
          ),
          status: "UNPAID",
        },
        { transaction: t }
      );

      quote.status = "CONVERTED";
      await quote.save({ transaction: t });
    }

    */

    // Send push notification
    const client = await Client.findByPk(clientId, {
      include: [{ model: User }],
    });

    if (client && client.User) {
      await sendPushNotificationToUser(
        client.User.id,
        "Booking Created",
        "Your booking has been scheduled successfully.",
        { type: "BOOKING_CREATED", bookingId: booking.id },
        DeviceToken
      );
    }

    await t.commit();

    // Return booking with schedules
    const createdBooking = await Booking.findByPk(booking.id, {
      include: [{ model: BookingSchedule, as: "schedules" }],
    });

    return res.status(201).json({
      success: true,
      data: createdBooking,
    });

  } catch (error) {

    console.log(error)
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.updateBookingSchedules = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { bookingId } = req.params;
    const { schedules } = req.body;

    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one schedule is required",
      });
    }

    const booking = await Booking.findByPk(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    // Optional: prevent editing completed/cancelled bookings
    if (["COMPLETED", "CANCELLED"].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: "Cannot modify schedules for this booking status",
      });
    }

    // Delete old schedules
    await BookingSchedule.destroy({
      where: { bookingId },
      transaction: t,
    });

    // Prepare new schedules
    const newSchedules = schedules.map((s) => ({
      bookingId: booking.id,
      date: s.date,
      startTime: s.startTime || null,
      endTime: s.endTime || null,
    }));

    await BookingSchedule.bulkCreate(newSchedules, {
      transaction: t,
    });

    await t.commit();

    const updatedBooking = await Booking.findByPk(bookingId, {
      include: [{ model: BookingSchedule, as: "schedules" }],
    });

    return res.status(200).json({
      success: true,
      data: updatedBooking,
    });

  } catch (error) {
    await t.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


exports.getBookings = async (req, res) => {
  try {
    const {
      page,
      limit,
      sort = "DESC",
      clientId,
      staffId
    } = req.query;

    const whereCondition = {};

    if (clientId) {
      whereCondition.clientId = clientId;
    }

    const include = [
      {
        model: Client,
        include: [
          {
            model: User,
            attributes: ["id", "firstName", "lastName", "email"]
          }
        ]
      },
      {
        model: Task,
        required: staffId ? true : false,
        include: [
          {
            model: Staff,
            attributes: ["id", "profilePicture"], // ✅ removed "name" — doesn't exist on staff table
            through: { attributes: [] },           // ✅ hide StaffTask junction noise
            ...(staffId && { where: { id: staffId } }),
            include: [
              {
                model: User,                        // ✅ name lives here
                attributes: ["id", "firstName", "lastName"]
              }
            ]
          }
        ]
      }
    ];

    const queryOptions = {
      where: whereCondition,
      include,
      order: [["createdAt", sort.toUpperCase() === "ASC" ? "ASC" : "DESC"]],
      distinct: true
    };

    if (page && limit) {
      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);
      queryOptions.limit = pageSize;
      queryOptions.offset = (pageNumber - 1) * pageSize;
    }

    const bookings = await Booking.findAndCountAll(queryOptions);

    return res.status(200).json({
      success: true,
      total: bookings.count,
      page: page ? parseInt(page) : null,
      limit: limit ? parseInt(limit) : null,
      data: bookings.rows
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getBookingsWithSchedules = async (req, res) => {
  try {

    const {
      page,
      limit,
      sort = "DESC",
      clientId,
      staffId
    } = req.query;

    const whereCondition = {};

    if (clientId) {
      whereCondition.clientId = clientId;
    }

    const include = [
      {
        model: Client,
        attributes: ["id"],
        include: [
          {
            model: User,
            attributes: ["id", "firstName", "lastName", "email", "phone"]
          }
        ]
      },
      {
        model: BookingSchedule,
        as: "schedules",
        attributes: ["id", "date", "startTime", "endTime"]
      },
      {
        model: Task,
        attributes: ["id", "title", "description", "status"],
        required: !!staffId,
        include: [
          {
            model: Staff,
            attributes: [
              "id",
              "specialization",
              "hourlyRate",
              "profilePicture"
            ],
            ...(staffId && { where: { id: staffId } }),
            include: [
              {
                model: User,
                attributes: [
                  "id",
                  "firstName",
                  "lastName",
                  "email",
                  "phone"
                ]
              }
            ]
          }
        ]
      }
    ];

    const queryOptions = {
      where: whereCondition,
      include,
      order: [["createdAt", sort.toUpperCase() === "ASC" ? "ASC" : "DESC"]],
      distinct: true
    };

    // Pagination
    if (page && limit) {

      const pageNumber = parseInt(page);
      const pageSize = parseInt(limit);

      queryOptions.limit = pageSize;
      queryOptions.offset = (pageNumber - 1) * pageSize;

    }

    const bookings = await Booking.findAndCountAll(queryOptions);

    // Extract unique staff for each booking
    const formattedBookings = bookings.rows.map((booking) => {

      const bookingData = booking.toJSON();
      const uniqueStaff = new Map();

      if (bookingData.Tasks && bookingData.Tasks.length > 0) {
        bookingData.Tasks.forEach((task) => {

          if (task.Staffs && task.Staffs.length > 0) {
            task.Staffs.forEach((staff) => {

              if (!uniqueStaff.has(staff.id)) {
                uniqueStaff.set(staff.id, {
                  id: staff.id,
                  profilePicture: staff.profilePicture
                });
              }

            });
          }

        });
      }

      bookingData.assignedStaff = Array.from(uniqueStaff.values());

      return bookingData;

    });

    return res.status(200).json({
      success: true,
      total: bookings.count,
      page: page ? parseInt(page) : null,
      limit: limit ? parseInt(limit) : null,
      data: formattedBookings
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

// controllers/booking.controller.js

exports.getAllStaffCalendar = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const staffs = await Staff.findAll({
      attributes: ["id", "profilePicture"], // ✅ include profile picture
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName", "email", "phone"]
        },
        {
          model: Task,
          attributes: ["id", "title", "status", "bookingId"],
          required: false,
          include: [
            {
              model: Booking,
              attributes: ["id", "status", "serviceType"],
              required: false,
              include: [
                {
                  model: BookingSchedule,
                  as: "schedules",
                  attributes: ["id", "date", "startTime", "endTime"],
                  required: false,
                  where: {
                    ...(startDate && endDate && {
                      date: {
                        [Op.between]: [startDate, endDate]
                      }
                    })
                  }
                },
                {
                  model: Client,
                  include: [
                    {
                      model: User,
                      attributes: ["firstName", "lastName", "phone"]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    // 🔥 FORMAT RESPONSE (calendar-friendly)
    const formattedData = staffs.map((staff) => {
      const s = staff.toJSON();

      const calendar = [];

      if (s.Tasks && s.Tasks.length > 0) {
        s.Tasks.forEach((task) => {
          if (task.Booking && task.Booking.schedules) {
            task.Booking.schedules.forEach((schedule) => {
              calendar.push({
                bookingId: task.Booking.id,
                taskId: task.id,

                title: task.title,
                status: task.status,

                date: schedule.date,
                startTime: schedule.startTime,
                endTime: schedule.endTime,

                clientName: `${task.Booking.Client?.User?.firstName || ""} ${task.Booking.Client?.User?.lastName || ""}`,
                clientPhone: task.Booking.Client?.User?.phone || null
              });
            });
          }
        });
      }

      return {
        staffId: s.id,
        name: `${s.User?.firstName || ""} ${s.User?.lastName || ""}`,
        email: s.User?.email || null,
        phone: s.User?.phone || null,
        profilePicture: s.profilePicture || null, // ✅ added
        totalEvents: calendar.length, // ✅ helpful for frontend
        calendar
      };
    });

    return res.status(200).json({
      success: true,
      totalStaff: formattedData.length,
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
// GET /api/bookings/:id

/*
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    // Fetch booking with related schedules, client, and quote
    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: BookingSchedule,
          as: "schedules", // make sure association has 'as' defined
        },
        {
          model: Client,
          include: [{ model: User }], // client details with user info
        },
        {
          model: Quote,
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
*/
exports.getBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Booking ID is required",
      });
    }

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: BookingSchedule,
          as: "schedules",
          attributes: ["id", "date", "startTime", "endTime"],
        },
        {
          model: Client,
          attributes: ["id", "address", "companyName"],
          include: [
            {
              model: User,
              attributes: ["id", "firstName", "lastName", "email", "phone"],
            },
          ],
        },
        {
          model: Task,
          attributes: ["id", "title", "description", "status", "startTime", "endTime"],
          include: [
            {
              model: Staff,
              attributes: ["id", "profilePicture"],
              through: { attributes: [] },
              include: [
                {
                  model: User,
                  attributes: ["id", "firstName", "lastName", "phone"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

// controllers/booking.controller.js

/*
exports.getCalendarData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const staffs = await Staff.findAll({
      attributes: ["id", "profilePicture"], // ✅ include profile picture
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName", "email", "phone"]
        },
        {
          model: Task,
          attributes: ["id", "title", "status", "bookingId"],
          required: false,
          include: [
            {
              model: Booking,
              attributes: ["id", "status", "serviceType"],
              required: false,
              include: [
                {
                  model: BookingSchedule,
                  as: "schedules",
                  attributes: ["id", "date", "startTime", "endTime"],
                  required: false,
                  where: {
                    ...(startDate && endDate && {
                      date: {
                        [Op.between]: [startDate, endDate]
                      }
                    })
                  }
                },
                {
                  model: Client,
                  include: [
                    {
                      model: User,
                      attributes: ["firstName", "lastName", "phone"]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    // 🔥 FORMAT RESPONSE (calendar-friendly)
    const formattedData = staffs.map((staff) => {
      const s = staff.toJSON();

      const calendar = [];

      if (s.Tasks && s.Tasks.length > 0) {
        s.Tasks.forEach((task) => {
          if (task.Booking && task.Booking.schedules) {
            task.Booking.schedules.forEach((schedule) => {
              calendar.push({
                bookingId: task.Booking.id,
                taskId: task.id,

                title: task.title,
                status: task.status,

                date: schedule.date,
                startTime: schedule.startTime,
                endTime: schedule.endTime,

                clientName: `${task.Booking.Client?.User?.firstName || ""} ${task.Booking.Client?.User?.lastName || ""}`,
                clientPhone: task.Booking.Client?.User?.phone || null
              });
            });
          }
        });
      }

      return {
        staffId: s.id,
        name: `${s.User?.firstName || ""} ${s.User?.lastName || ""}`,
        email: s.User?.email || null,
        phone: s.User?.phone || null,
        profilePicture: s.profilePicture || null, // ✅ added
        totalEvents: calendar.length, // ✅ helpful for frontend
        calendar
      };
    });

    return res.status(200).json({
      success: true,
      totalStaff: formattedData.length,
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
*/
exports.getCalendarData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const staffs = await Staff.findAll({
      attributes: ["id", "profilePicture"],
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName", "email", "phone"]
        },
        {
          model: Task,
          attributes: ["id", "title", "status", "bookingId"],
          required: false,
          include: [
            {
              model: Booking,
              attributes: ["id", "status", "serviceType", "address"],
              required: false,
              include: [
                {
                  model: BookingSchedule,
                  as: "schedules",
                  attributes: ["id", "date", "startTime", "endTime"],
                  required: false,
                  where: {
                    ...(startDate && endDate && {
                      date: { [Op.between]: [startDate, endDate] }
                    })
                  }
                },
                {
                  model: Client,
                  include: [
                    {
                      model: User,
                      attributes: ["firstName", "lastName", "phone"]
                    }
                  ]
                },
                {
                  model: Task,
                  attributes: ["id"],
                  required: false,
                  include: [
                    {
                      model: Staff,
                      attributes: ["id", "profilePicture"],
                      through: { attributes: [] },
                      include: [
                        {
                          model: User,
                          attributes: ["firstName", "lastName"]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const formattedData = staffs.map((staff) => {
      const s = staff.toJSON();
      const calendar = [];

      // ✅ Track unique bookings to avoid duplicate calendar entries
      const seenBookingIds = new Set();

      if (s.Tasks && s.Tasks.length > 0) {
        s.Tasks.forEach((task) => {
          const booking = task.Booking;
          if (!booking) return;

          // ✅ Skip if we've already processed this booking for this staff
          if (seenBookingIds.has(booking.id)) return;
          seenBookingIds.add(booking.id);

          const schedules = booking.schedules || [];
          const clientUser = booking.Client?.User;

          // ✅ Deduplicate assigned staff across all tasks in this booking
          const staffMap = {};
          (booking.Tasks || []).forEach((t) => {
            (t.Staffs || []).forEach((st) => {
              if (!staffMap[st.id]) {
                staffMap[st.id] = {
                  staffId: st.id,
                  name: `${st.User?.firstName || ""} ${st.User?.lastName || ""}`.trim(),
                  profilePicture: st.profilePicture || null
                };
              }
            });
          });

          const assignedStaff = Object.values(staffMap);

          calendar.push({
            bookingId: booking.id,
            taskId: task.id,
            taskTitle: task.title,
            taskStatus: task.status,

            booking: {
              id: booking.id,
              status: booking.status,
              serviceType: booking.serviceType,
              address: booking.address || null,
              client: {
                name: `${clientUser?.firstName || ""} ${clientUser?.lastName || ""}`.trim(),
                phone: clientUser?.phone || null
              },
              // ✅ Staff count is per booking
              totalAssignedStaff: assignedStaff.length,
              assignedStaff,
              schedules: schedules.map((sch) => ({
                scheduleId: sch.id,
                date: sch.date,
                startTime: sch.startTime,
                endTime: sch.endTime
              }))
            }
          });
        });
      }

      return {
        staffId: s.id,
        name: `${s.User?.firstName || ""} ${s.User?.lastName || ""}`.trim(),
        email: s.User?.email || null,
        phone: s.User?.phone || null,
        profilePicture: s.profilePicture || null,
        // ✅ Total unique bookings this staff is involved in
        totalBookings: calendar.length,
        calendar
      };
    });

    return res.status(200).json({
      success: true,
      totalStaff: formattedData.length,
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/*

exports.getBookingHistory = async (req, res) => {
  try {
    let filter = {};
    
    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      filter.clientId = client.id;
    } else if (req.user.role === 'STAFF') {
      const staff = await Staff.findOne({ where: { userId: req.user.id } });
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff profile not found' });
      }
      const tasks = await Task.findAll({
        include: [
          {
            model: Staff,
            where: { id: staff.id },
            through: { attributes: [] }
          }
        ]
      });
      filter.id = tasks.map(t => t.bookingId).filter(Boolean);
    }

    const bookings = await Booking.findAll({
      where: {
        ...filter,
        status: { [Op.in]: ['COMPLETED', 'CANCELLED'] }
      },
      include: [
        Quote,
        {
          model: Task,
          include: [
            {
              model: Staff,
              include: [{ model: User }]
            }
          ]
        },
        Invoice,
        {
          model: Client,
          include: [{ model: User }]
        }
      ],
      order: [['bookingDate', 'DESC']]
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

*/


exports.getBookingHistory = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      filter.clientId = client.id;

    } else if (req.user.role === 'STAFF') {
      const staff = await Staff.findOne({ where: { userId: req.user.id } });
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff profile not found' });
      }

      const tasks = await Task.findAll({
        include: [
          {
            model: Staff,
            where: { id: staff.id },
            through: { attributes: [] }
          }
        ]
      });

      filter.id = tasks.map(t => t.bookingId).filter(Boolean);
    }

    const bookings = await Booking.findAll({
      where: {
        ...filter,
        status: { [Op.in]: ['COMPLETED', 'CANCELLED'] }
      },
      include: [
        {
          model: Quote
        },
        {
          model: Task,
          include: [
            {
              model: Staff,
              attributes: ["id", "profilePicture"],
              through: { attributes: [] }, // ✅ hide junction table noise
              include: [
                {
                  model: User,
                  attributes: ["id", "firstName", "lastName", "email", "phone"]
                }
              ]
            }
          ]
        },
        {
          model: Invoice
        },
        {
          model: Client,
          include: [
            {
              model: User,
              attributes: ["id", "firstName", "lastName", "email", "phone"]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']] // ✅ was 'bookingDate' which doesn't exist
    });

    return res.status(200).json({ success: true, data: bookings });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addTaskToBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { title, description, startTime, endTime } = req.body;

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const task = await Task.create({
      bookingId,
      title,
      description,
      startTime,
      endTime,
      status: 'PENDING'
    });

    const fullTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Booking,
          include: [
            {
              model: Client,
              include: [{ model: User }]
            }
          ]
        }
      ]
    });

    // Send push notification to client
    if (fullTask.Booking && fullTask.Booking.Client && fullTask.Booking.Client.User) {
      await sendPushNotificationToUser(
        fullTask.Booking.Client.User.id,
        'Task Added to Booking',
        `A new task "${title}" has been added to your booking`,
        { type: 'TASK_ADDED', taskId: task.id, bookingId: bookingId },
        DeviceToken
      );
    }

    res.status(201).json({
      success: true,
      message: 'Task added to booking successfully',
      data: fullTask
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignStaffToTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { staffId } = req.body;

    const task = await Task.findByPk(taskId, {
      include: [{ model: Booking }]
    });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    // Check if staff is assigned to the booking first
    const bookingTasks = await Task.findAll({
      where: { bookingId: task.bookingId },
      include: [
        {
          model: Staff,
          where: { id: staffId },
          through: { attributes: [] }
        }
      ]
    });

    if (bookingTasks.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Staff must be assigned to at least one task in this booking first'
      });
    }

    // Assign staff to task
    const staff = await Staff.findByPk(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    await task.addStaff(staff);
    task.status = 'ASSIGNED';
    await task.save();

    // Send push notification to staff
    await sendPushNotificationToUser(
      staff.userId,
      'New Task Assigned',
      `You have been assigned to task: ${task.title}`,
      { type: 'TASK_ASSIGNED', taskId: task.id, bookingId: task.bookingId },
      DeviceToken
    );

    const fullTask = await Task.findByPk(task.id, {
      include: [
        {
          model: Staff,
          include: [{ model: User }]
        },
        {
          model: Booking
        }
      ]
    });

    res.json({
      success: true,
      message: 'Staff assigned to task successfully',
      data: fullTask
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const booking = await Booking.findByPk(id, {
      include: [
        {
          model: Client,
          include: [{ model: User }],
        },
      ],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Prevent invalid transitions
    const invalidTransitions = {
      COMPLETED: ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
      CANCELLED: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'],
    };

    if (invalidTransitions[booking.status]?.includes(status) === false) {
      // Allow the transition
    }

    // Block going backwards: e.g. COMPLETED -> SCHEDULED
    const statusOrder = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    const currentIndex = statusOrder.indexOf(booking.status);
    const newIndex = statusOrder.indexOf(status);

    /*
    if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot change status of a ${booking.status} booking`,
      });
    }
*/
    const previousStatus = booking.status;
    booking.status = status;
    await booking.save();

    // Send push notification to client
    if (booking.Client && booking.Client.User) {
      const statusMessages = {
        IN_PROGRESS: 'Your booking is now in progress.',
        COMPLETED: 'Your booking has been completed. Thank you!',
        CANCELLED: 'Your booking has been cancelled.',
        SCHEDULED: 'Your booking has been rescheduled.',
      };

      await sendPushNotificationToUser(
        booking.Client.User.id,
        'Booking Status Updated',
        statusMessages[status] || `Your booking status changed to ${status}`,
        { type: 'BOOKING_STATUS_UPDATED', bookingId: booking.id, status },
        DeviceToken
      );
    }

    return res.status(200).json({
      success: true,
      message: `Booking status updated from ${previousStatus} to ${status}`,
      data: {
        id: booking.id,
        previousStatus,
        currentStatus: booking.status,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.removeStaffFromBooking = async (req, res) => {
  try {
    const { bookingId, staffId } = req.params;

    // Get booking with tasks that include this staff
    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Task,
          include: [
            {
              model: Staff,
              where: { id: staffId },
              required: false, // important so tasks without this staff are still returned
              through: { attributes: [] }
            }
          ]
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Fetch staff once
    const staff = await Staff.findByPk(staffId);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff not found'
      });
    }

    // Loop through tasks and remove staff
    await Promise.all(
      booking.Tasks.map(async (task) => {
        // Remove staff from task
        await task.removeStaff(staff);

        // Check if any staff remains
        const remainingStaff = await task.getStaffs();

        // If no staff left → set status to PENDING
        if (remainingStaff.length === 0) {
          await task.update({ status: 'PENDING' });
        }
      })
    );

    // Send push notification
    await sendPushNotificationToUser(
      staff.userId,
      'Removed from Booking',
      `You have been removed from booking #${booking.id}`,
      { type: 'STAFF_REMOVED', bookingId: booking.id },
      DeviceToken
    );

    return res.json({
      success: true,
      message: 'Staff removed from booking successfully'
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
/*
exports.removeStaffFromBooking = async (req, res) => {
  try {
    const { bookingId, staffId } = req.params;

    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: Task,
          include: [
            {
              model: Staff,
              where: { id: staffId },
              through: { attributes: [] }
            }
          ]
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Remove staff from all tasks in this booking
    for (const task of booking.Tasks) {
      const staff = await Staff.findByPk(staffId);
      if (staff) {
        await task.removeStaff(staff);
      }
    }

    // Send push notification
    const staff = await Staff.findByPk(staffId);
    if (staff) {
      await sendPushNotificationToUser(
        staff.userId,
        'Removed from Booking',
        `You have been removed from booking #${booking.id}`,
        { type: 'STAFF_REMOVED', bookingId: booking.id },
        DeviceToken
      );
    }

    res.json({
      success: true,
      message: 'Staff removed from booking successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
*/