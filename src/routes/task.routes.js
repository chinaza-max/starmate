const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.post('/', protect, authorize('ADMIN'), taskController.createTask);
router.post('/assign', protect, authorize('ADMIN'), taskController.assignTask);
router.get('/my-tasks', protect, authorize('STAFF'), taskController.getStaffTasks);
router.patch('/:id/status', protect, authorize('STAFF', 'ADMIN'), taskController.updateTaskStatus);
router.post('/unassign', protect, authorize('ADMIN'), taskController.unassignTask);

module.exports = router;
