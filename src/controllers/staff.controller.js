
const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { Staff, User,Booking ,BookingSchedule,Task,Client,Quote,Invoice} = models;
const { Op } = require('sequelize');


const multer = require('multer');
const path = require('path');
const fs = require('fs');




// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/staff-profiles/';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'staff-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
}).single('profilePicture');

exports.uploadProfilePicture = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      const staffId = req.params.id || req.body.staffId;
      const staff = await Staff.findByPk(staffId);

      if (!staff) {
        // Delete uploaded file if staff not found
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, message: 'Staff not found' });
      }

      // Delete old profile picture if exists
      if (staff.profilePicture && fs.existsSync(staff.profilePicture)) {
        fs.unlinkSync(staff.profilePicture);
      }

      const oldPath = `${process.env.DOMAIN}/${req.file.path}`;
      staff.profilePicture = oldPath;
      await staff.save();

      res.json({
        success: true,
        message: 'Profile picture uploaded successfully',
        data: {
          profilePicture: staff.profilePicture,
          url: oldPath
        }
      });
    } catch (error) {
      // Delete uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ success: false, message: error.message });
    }
  });
};

exports.getProfilePicture = async (req, res) => {
  try {
    const staff = await Staff.findByPk(req.params.id);
    if (!staff || !staff.profilePicture) {
      return res.status(404).json({ success: false, message: 'Profile picture not found' });
    }

    if (!fs.existsSync(staff.profilePicture)) {
      return res.status(404).json({ success: false, message: 'Profile picture file not found' });
    }

    res.sendFile(path.resolve(staff.profilePicture));
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStaffAmount = async (req, res) => {
  try {
    const { staffId, hourlyRate } = req.body;

    const staff = await Staff.findByPk(staffId, {
      include: [{ model: User }]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    staff.hourlyRate = hourlyRate;
    await staff.save();

    res.json({
      success: true,
      message: 'Staff hourly rate updated successfully',
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllStaff = async (req, res) => {
  try {
    const staff = await Staff.findAll({
      include: [{
        model: User,
        attributes: { 
          exclude: ['password', 'resetToken', 'createdAt', 'updatedAt'] 
        }
      }],
      attributes: { 
        exclude: ['createdAt', 'updatedAt'] // optional: exclude from Staff too
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getStaff = async (req, res) => {
  try {
    const staff = await Staff.findByPk(req.params.id, {
      include: [{ model: User }]
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.queryStaff = async (req, res) => {
  try {
    const { specialization, minHourlyRate, maxHourlyRate, search } = req.query;
    const { Op } = require('sequelize');

    let where = {};
    let userWhere = {};

    if (specialization) {
      where.specialization = { [Op.like]: `%${specialization}%` };
    }

    if (minHourlyRate || maxHourlyRate) {
      where.hourlyRate = {};
      if (minHourlyRate) where.hourlyRate[Op.gte] = parseFloat(minHourlyRate);
      if (maxHourlyRate) where.hourlyRate[Op.lte] = parseFloat(maxHourlyRate);
    }

    if (search) {
      userWhere = {
        [Op.or]: [
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } }
        ]
      };
    }

    const staff = await Staff.findAll({
      where,
      include: [
        {
          model: User,
          where: userWhere,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'isActive']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: staff
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getStaffBookings = async (req, res) => {
  try {

    const staff = await Staff.findOne({
      where: { userId: req.user.id }
    });

    const id =req.user.id

    console.log("idjjjdd jjx")
        console.log(id)
    console.log("id jxjxj")

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff not found' });
    }

    const bookings = await Booking.findAll({
      include: [
        {
          model: BookingSchedule,
          as: "schedules",
          attributes: ["id", "date", "startTime", "endTime"]
        },
        {
          model: Task,
          required: true, // ✅ only bookings where staff is assigned
          attributes: ["id", "title", "status"],
          include: [
            {
              model: Staff,
              where: { userId:id },
              attributes: ["id", "profilePicture","userId"],
              through: { attributes: [] }
            }
          ]
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
      ],
      order: [["createdAt", "DESC"]],
      distinct: true
    });

    res.json({
      success: true,
      total: bookings.length,
      data: bookings
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffBookingDetails = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          model: BookingSchedule,
          as: "schedules"
        },
        {
          model: Task,
          include: [
            {
              model: Staff,
              attributes: ["id", "profilePicture","userId"],
              include: [
                {
                  model: User,
                  attributes: ["firstName", "lastName"]
                }
              ],
              through: { attributes: [] }
            }
          ]
        },
        {
          model: Client,
          include: [
            {
              model: User,
              attributes: ["firstName", "lastName", "phone", "email"]
            }
          ]
        },
        {
          model: Quote
        },
        {
          model: Invoice
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found"
      });
    }

    res.json({
      success: true,
      data: booking
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.getStaffBookingsByStatus = async (req, res) => {
  try {
    const { status } = req.query;

    const staff = await Staff.findOne({
      where: { userId: req.user.id }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff profile not found"
      });
    }

    const bookings = await Booking.findAll({
      where: {
        ...(status && { status })
      },
      include: [
        {
          model: Task,
          required: true,
          include: [
            {
              model: Staff,
              where: { id: staff.id },
              through: { attributes: [] }
            }
          ]
        },
        {
          model: BookingSchedule,
          as: "schedules"
        }
      ],
      order: [["createdAt", "DESC"]],
      distinct: true
    });

    res.json({
      success: true,
      total: bookings.length,
      data: bookings
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const staff = await Staff.findOne({
      where: { userId: req.user.id },
      include: [
        {
          model: User,
          attributes: ["id", "firstName", "lastName", "email", "phone", "isActive"]
        }
      ],
      attributes: {
        exclude: ["createdAt", "updatedAt"]
      }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff profile not found"
      });
    }

    

    res.json({
      success: true,
      data: {
        id: staff.id,
        profilePicture:staff.profilePicture || null, 
        hourlyRate: staff.hourlyRate,
        specialization: staff.specialization,
        user: {
          firstName: staff.User?.firstName,
          lastName: staff.User?.lastName,
          email: staff.User?.email,
          phone: staff.User?.phone,
          isActive: staff.User?.isActive
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.getMyStats = async (req, res) => {
  try {
    // 🔹 Get logged-in staff
    const staff = await Staff.findOne({
      where: { userId: req.user.id }
    });

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff profile not found"
      });
    }

    // 🔥 BASE INCLUDE (reuse everywhere)
    const staffTaskInclude = {
      model: Staff,
      where: { id: staff.id },
      through: { attributes: [] }
    };

    // =========================================
    // ✅ 1. TOTAL BOOKINGS (DISTINCT bookingId)
    // =========================================
    const totalBookings = await Task.count({
      distinct: true,
      col: 'bookingId',
      include: [staffTaskInclude]
    });

    // =========================================
    // ✅ 2. COMPLETED BOOKINGS
    // =========================================
    const completedBookings = await Task.count({
      distinct: true,
      col: 'bookingId',
      include: [
        staffTaskInclude,
        {
          model: Booking,
          where: { status: "COMPLETED" }
        }
      ]
    });

    // =========================================
    // ✅ 3. PENDING BOOKINGS
    // =========================================
    const pendingBookings = await Task.count({
      distinct: true,
      col: 'bookingId',
      include: [
        staffTaskInclude,
        {
          model: Booking,
          where: { status: { [Op.in]: ["PENDING", "SCHEDULED"] } }
        }
      ]
    });

    // =========================================
    // ✅ 4. CANCELLED BOOKINGS
    // =========================================
    const cancelledBookings = await Task.count({
      distinct: true,
      col: 'bookingId',
      include: [
        staffTaskInclude,
        {
          model: Booking,
          where: { status: "CANCELLED" }
        }
      ]
    });

    // =========================================
    // ✅ 5. TOTAL EARNINGS
    // =========================================
    const completedTasks = await Task.findAll({
      attributes: ['id', 'bookingId'],
      include: [
        {
          model: Staff,
          where: { id: staff.id },
          attributes: ['hourlyRate'],
          through: { attributes: [] }
        },
        {
          model: Booking,
          where: { status: "COMPLETED" },
          attributes: ['id'],
          include: [
            {
              model: BookingSchedule,
              as: "schedules",
              attributes: ['startTime', 'endTime']
            }
          ]
        }
      ]
    });

    let totalEarnings = 0;

    completedTasks.forEach(task => {
      const rate = task.Staffs[0]?.hourlyRate || 0;

      task.Booking?.schedules?.forEach(schedule => {
        const start = new Date(`1970-01-01T${schedule.startTime}`);
        const end = new Date(`1970-01-01T${schedule.endTime}`);

        const hours = (end - start) / (1000 * 60 * 60);

        totalEarnings += hours * rate;
      });
    });

    // =========================================
    // ✅ 6. TODAY BOOKINGS (OPTIONAL)
    // =========================================
    const today = new Date().toISOString().split('T')[0];

    const todayBookings = await Task.count({
      distinct: true,
      col: 'bookingId',
      include: [
        staffTaskInclude,
        {
          model: Booking,
          include: [
            {
              model: BookingSchedule,
              as: "schedules",
              where: { date: today }
            }
          ]
        }
      ]
    });

    // =========================================
    // ✅ FINAL RESPONSE
    // =========================================
    res.json({
      success: true,
      data: {
        totalBookings,
        completedBookings,
        pendingBookings,
        cancelledBookings,
        todayBookings,
        totalEarnings
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};