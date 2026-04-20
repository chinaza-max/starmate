
const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User, Client } = models;


exports.getAll = async (req, res) => {
  try {
    const clients = await Client.findAll({
      include: [
        {
          model: User,
          as: 'User',
          attributes: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      data: clients,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};