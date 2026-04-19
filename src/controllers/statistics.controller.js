//const { User, Client, Staff, Quote, Booking, Task, Invoice, CustomRequest, StaffTask } = require('../models');

const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User, Client,Quote, Staff, Task,Invoice,CustomRequest ,Booking} = models;

const { Op } = require('sequelize');

exports.getAdminStatistics = async (req, res) => {
  try {
    const totalClients = await Client.count();
    const totalStaff = await Staff.count();
    const totalQuotes = await Quote.count();
    const totalBookings = await Booking.count();
    const totalTasks = await Task.count();
    const totalInvoices = await Invoice.count();
    const totalCustomRequests = await CustomRequest.count();

    // Revenue statistics
    const totalRevenue = await Invoice.sum('amountDue', {
      where: { status: 'PAID' }
    }) || 0;

    const pendingRevenue = await Invoice.sum('amountDue', {
      where: { status: 'UNPAID' }
    }) || 0;

    // Quote statistics
    const acceptedQuotes = await Quote.count({
      where: { status: 'ACCEPTED' }
    });

    const pendingQuotes = await Quote.count({
      where: { status: 'PENDING' }
    });

    // Booking statistics
    const completedBookings = await Booking.count({
      where: { status: 'COMPLETED' }
    });

    const inProgressBookings = await Booking.count({
      where: { status: 'IN_PROGRESS' }
    });

    // Task statistics
    const completedTasks = await Task.count({
      where: { status: 'COMPLETED' }
    });

    const pendingTasks = await Task.count({
      where: { status: 'PENDING' }
    });

    // Custom request statistics
    const pendingRequests = await CustomRequest.count({
      where: { status: 'PENDING' }
    });

    // Recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBookings = await Booking.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    const recentQuotes = await Quote.count({
      where: {
        createdAt: {
          [Op.gte]: thirtyDaysAgo
        }
      }
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalClients,
          totalStaff,
          totalQuotes,
          totalBookings,
          totalTasks,
          totalInvoices,
          totalCustomRequests
        },
        revenue: {
          totalRevenue: parseFloat(totalRevenue),
          pendingRevenue: parseFloat(pendingRevenue)
        },
        quotes: {
          total: totalQuotes,
          accepted: acceptedQuotes,
          pending: pendingQuotes
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          inProgress: inProgressBookings
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks
        },
        customRequests: {
          total: totalCustomRequests,
          pending: pendingRequests
        },
        recentActivity: {
          bookings: recentBookings,
          quotes: recentQuotes
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffStatistics = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      where: { userId: req.user.id },
      include: [{ model: User }]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff profile not found' });
    }

    // Get tasks assigned to this staff
    const staffTasks = await Task.findAll({
      include: [{
        model: Staff,
        where: { id: staff.id },
        through: { attributes: [] }
      }]
    });

    const totalTasks = staffTasks.length;
    const completedTasks = staffTasks.filter(t => t.status === 'COMPLETED').length;
    const pendingTasks = staffTasks.filter(t => t.status === 'PENDING').length;
    const inProgressTasks = staffTasks.filter(t => t.status === 'ASSIGNED').length;

    // Get bookings related to staff tasks
    const taskIds = staffTasks.map(t => t.id);
    const bookings = await Booking.findAll({
      include: [{
        model: Task,
        where: { id: taskIds }
      }]
    });

    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED').length;

    // Calculate earnings (if tasks have hours logged)
    // This is a simplified calculation - you may need to adjust based on your business logic
    const earnings = staff.hourlyRate * completedTasks * 8; // Assuming 8 hours per task

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          specialization: staff.specialization,
          hourlyRate: parseFloat(staff.hourlyRate)
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          inProgress: inProgressTasks
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings
        },
        earnings: {
          estimated: parseFloat(earnings),
          hourlyRate: parseFloat(staff.hourlyRate)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getAllStaff = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Staff.findAndCountAll({
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        pageSize: limit
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};