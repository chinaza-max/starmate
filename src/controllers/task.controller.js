//const { Task, Staff, User, Booking } = require('../models');
const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { Task, Staff, User, Booking } = models;


exports.createTask = async (req, res) => {
  try {
    const task = await Task.create(req.body);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignTask = async (req, res) => {
  try {
    const { taskId, staffId } = req.body;
    const task = await Task.findByPk(taskId);
    const staff = await Staff.findByPk(staffId);

    if (!task || !staff) return res.status(404).json({ success: false, message: 'Task or Staff not found' });

    await task.addStaff(staff);
    task.status = 'ASSIGNED';
    await task.save();

    res.json({ success: true, message: 'Task assigned successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStaffTasks = async (req, res) => {
  try {
    const staff = await Staff.findOne({ where: { userId: req.user.id } });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff profile not found' });

    const tasks = await Task.findAll({
      include: [{
        model: Staff,
        where: { id: staff.id },
        attributes: []
      }, Booking]
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findByPk(req.params.id);
    
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    task.status = status;
    await task.save();

    res.json({ success: true, data: task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



exports.unassignTask = async (req, res) => {
  try {
    const { taskId, staffId } = req.body;

    const task = await Task.findByPk(taskId, {
      include: [{ model: Staff, through: { attributes: [] } }]
    });

    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const staff = await Staff.findByPk(staffId);
    if (!staff) return res.status(404).json({ success: false, message: 'Staff not found' });

    // Check if staff is actually assigned to this task
    const isAssigned = task.Staffs.some(s => s.id === staff.id);
    if (!isAssigned) {
      return res.status(400).json({ success: false, message: 'Staff is not assigned to this task' });
    }

    await task.removeStaff(staff);

    // Reload to get updated staff list
    await task.reload({
      include: [{ model: Staff, through: { attributes: [] } }]
    });

    // Set task back to PENDING if no staff remain
    if (task.Staffs.length === 0) {
      task.status = 'PENDING';
      await task.save();
    }

    res.json({
      success: true,
      message: 'Staff unassigned from task successfully',
      data: {
        taskId: task.id,
        status: task.status,
        remainingStaff: task.Staffs.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};