const { Staff, Task, Booking, User, Client } = require('../models');
const { Op } = require('sequelize');

exports.getStaffAvailability = async (req, res) => {
  try {
    const { staffId, startDate, endDate } = req.query;

    let where = {};
    if (staffId) {
      where.id = staffId;
    }

    const staff = await Staff.findAll({
      where,
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    const availabilityData = await Promise.all(
      staff.map(async (s) => {
        // Get all tasks assigned to this staff
        const tasks = await Task.findAll({
          where: {
            [Op.or]: [
              { startTime: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } },
              { endTime: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } }
            ]
          },
          include: [
            {
              model: Staff,
              where: { id: s.id },
              through: { attributes: [] }
            },
            {
              model: Booking,
              include: [
                {
                  model: 'Client',
                  include: [{ model: User }]
                }
              ]
            }
          ]
        });

        // Get bookings for this staff
        const bookings = await Booking.findAll({
          include: [
            {
              model: Task,
              include: [
                {
                  model: Staff,
                  where: { id: s.id },
                  through: { attributes: [] }
                }
              ]
            }
          ],
          where: {
            [Op.or]: [
              { bookingDate: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } },
              { endDate: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } }
            ]
          }
        });

        // Calculate availability status
        const now = new Date();
        const currentTasks = tasks.filter(t => {
          const start = t.startTime ? new Date(t.startTime) : null;
          const end = t.endTime ? new Date(t.endTime) : null;
          return start && end && start <= now && end >= now;
        });

        const upcomingTasks = tasks.filter(t => {
          const start = t.startTime ? new Date(t.startTime) : null;
          return start && start > now;
        });

        return {
          staff: {
            id: s.id,
            userId: s.userId,
            specialization: s.specialization,
            hourlyRate: parseFloat(s.hourlyRate),
            profilePicture: s.profilePicture,
            user: s.User
          },
          status: currentTasks.length > 0 ? 'BUSY' : 'AVAILABLE',
          currentTasks: currentTasks.length,
          upcomingTasks: upcomingTasks.length,
          totalTasks: tasks.length,
          timeline: tasks.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            startTime: t.startTime,
            endTime: t.endTime,
            booking: t.Booking ? {
              id: t.Booking.id,
              bookingDate: t.Booking.bookingDate,
              endDate: t.Booking.endDate,
              status: t.Booking.status
            } : null
          })),
          bookings: bookings.map(b => ({
            id: b.id,
            bookingDate: b.bookingDate,
            endDate: b.endDate,
            status: b.status,
            notes: b.notes
          }))
        };
      })
    );

    res.json({
      success: true,
      data: availabilityData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffTimeline = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate } = req.query;

    const staff = await Staff.findByPk(staffId, {
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone']
        }
      ]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    // Get all tasks for this staff
    const tasks = await Task.findAll({
      where: {
        [Op.or]: [
          { startTime: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } },
          { endTime: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } }
        ]
      },
      include: [
        {
          model: Staff,
          where: { id: staffId },
          through: { attributes: ['assignedAt'] }
        },
            {
              model: Booking,
              include: [
                {
                  model: Client,
                  include: [{ model: User, attributes: ['id', 'firstName', 'lastName', 'email'] }]
                }
              ]
            }
      ],
      order: [['startTime', 'ASC']]
    });

    // Get all bookings
    const bookings = await Booking.findAll({
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
      ],
      where: {
        [Op.or]: [
          { bookingDate: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } },
          { endDate: { [Op.between]: [startDate || new Date(0), endDate || new Date('2099-12-31')] } }
        ]
      },
      order: [['bookingDate', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          specialization: staff.specialization,
          hourlyRate: parseFloat(staff.hourlyRate),
          profilePicture: staff.profilePicture,
          user: staff.User
        },
        tasks,
        bookings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

