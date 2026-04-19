const { DeviceToken, User } = require('../models');

exports.saveToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.id;

    // Check if token already exists for this user
    let deviceToken = await DeviceToken.findOne({
      where: {
        userId,
        token
      }
    });

    if (deviceToken) {
      // Update existing token
      deviceToken.platform = platform;
      deviceToken.isActive = true;
      await deviceToken.save();
    } else {
      // Create new token
      deviceToken = await DeviceToken.create({
        userId,
        token,
        platform,
        isActive: true
      });
    }

    res.json({
      success: true,
      message: 'Device token saved successfully',
      data: deviceToken
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateToken = async (req, res) => {
  try {
    const { token, platform, isActive } = req.body;
    const userId = req.user.id;

    const deviceToken = await DeviceToken.findOne({
      where: {
        userId,
        token
      }
    });

    if (!deviceToken) {
      return res.status(404).json({ success: false, message: 'Device token not found' });
    }

    if (platform !== undefined) deviceToken.platform = platform;
    if (isActive !== undefined) deviceToken.isActive = isActive;

    await deviceToken.save();

    res.json({
      success: true,
      message: 'Device token updated successfully',
      data: deviceToken
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteToken = async (req, res) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;

    const deviceToken = await DeviceToken.findOne({
      where: {
        userId,
        token
      }
    });

    if (!deviceToken) {
      return res.status(404).json({ success: false, message: 'Device token not found' });
    }

    await deviceToken.destroy();

    res.json({
      success: true,
      message: 'Device token deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserTokens = async (req, res) => {
  try {
    const userId = req.user.id;

    const deviceTokens = await DeviceToken.findAll({
      where: {
        userId,
        isActive: true
      }
    });

    res.json({
      success: true,
      data: deviceTokens
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

