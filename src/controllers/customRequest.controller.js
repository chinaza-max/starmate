const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User,Client,CustomRequest } = models;


const { Op } = require('sequelize');

exports.createRequest = async (req, res) => {
  try {
    const { subject, message } = req.body;

    // Get client for the logged-in user
    const client = await Client.findOne({ where: { userId: req.user.id } });

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client profile not found' });
    }

    const customRequest = await CustomRequest.create({
      clientId: client.id,
      subject,
      message,
      status: 'PENDING'
    });

    const fullRequest = await CustomRequest.findByPk(customRequest.id, {
      include: [{ model: Client, include: [{ model: User }] }]
    });

    res.status(201).json({
      success: true,
      message: 'Custom request created successfully',
      data: fullRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status;

    let where = {};
    let clientWhere = {};

    // If client, only show their requests
    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      where.clientId = client.id;
    }

    // Filter by status if provided
    if (status) {
      where.status = status;
    }

    const { count, rows } = await CustomRequest.findAndCountAll({
      where,
      include: [
        {
          model: Client,
          include: [{ model: User }],
          where: clientWhere
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
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRequest = async (req, res) => {
  try {
    let where = { id: req.params.id };

    // If client, ensure they can only see their own requests
    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      where.clientId = client.id;
    }

    const customRequest = await CustomRequest.findOne({
      where,
      include: [
        {
          model: Client,
          include: [{ model: User }]
        }
      ]
    });

    if (!customRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    res.json({
      success: true,
      data: customRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateRequest = async (req, res) => {
  try {
    const { status, response } = req.body;

    const customRequest = await CustomRequest.findByPk(req.params.id);

    if (!customRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Only admin can update requests
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized to update requests' });
    }

    if (status) customRequest.status = status;
    if (response !== undefined) customRequest.response = response;

    await customRequest.save();

    const fullRequest = await CustomRequest.findByPk(customRequest.id, {
      include: [
        {
          model: Client,
          include: [{ model: User }]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Request updated successfully',
      data: fullRequest
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

