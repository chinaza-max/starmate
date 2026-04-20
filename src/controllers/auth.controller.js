// server.js
const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User, Client, Staff } = models;


// Now pass `User` into your controller or make it available globally

const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../services/email.service');
const EmailService = require('../services/email.service2');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, address, companyName, specialization, hourlyRate , phone} = req.body;

    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      phone
    });

    if (role === 'CLIENT') {
      await Client.create({ userId: user.id, address, companyName ,isEmailVerified:true});
    } else if (role === 'STAFF') {
      await Staff.create({ userId: user.id, specialization, hourlyRate ,isEmailVerified:true});

      await EmailService.sendStaffLoginDetails({
        to: email,
        username:firstName,
        firstName: firstName,
        password,
        loginUrl: `${process.env.APP_URL}/staff/login`,
      });
    }

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        token: generateToken(user.id)
      }
    });
  } catch (error) {
    console.log(error)
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (user && (await user.validPassword(password))) {
      if (!user.isEmailVerified) {
        return res.status(403).json({ 
          success: false, 
          message: 'Please verify your email before logging in' 
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          token: generateToken(user.id),

        }
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Client },
        { model: Staff }
      ]
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    const emailSent = await sendOTPEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send OTP email' });
    }

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ success: false, message: 'Email already verified' });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (new Date() > new Date(user.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    user.isEmailVerified = true;
    user.otp = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
