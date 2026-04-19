const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { Item } = models;





exports.addItem = async (req, res) => {
  try {
    const { name, description, basePrice } = req.body;

    const item = await Item.create({
      name,
      description,
      basePrice
    });

    res.status(201).json({
      success: true,
      message: 'Item added successfully',
      data: item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getItems = async (req, res) => {
  try {
    const items = await Item.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, basePrice } = req.body;

    const item = await Item.findByPk(id);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    // Update only the provided fields
    if (name !== undefined) item.name = name;
    if (description !== undefined) item.description = description;
    if (basePrice !== undefined) item.basePrice = basePrice;

    await item.save();

    res.json({
      success: true,
      message: 'Item updated successfully',
      data: item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};