const { Invoice, Booking, Quote, Client, User, Item, QuoteItem } = require('../models');
const { sendInvoiceEmail } = require('../services/email.service');
const PDFDocument = require('pdfkit');
const sequelize = require('../config/db.config');

exports.createInvoice = async (req, res) => {
  try {
    const { bookingId, amountDue, dueDate } = req.body;

    const booking = await Booking.findByPk(bookingId, {
      include: [{ model: Quote }]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ where: { bookingId } });
    if (existingInvoice) {
      return res.status(400).json({ success: false, message: 'Invoice already exists for this booking' });
    }

    const invoice = await Invoice.create({
      bookingId,
      invoiceNumber: `INV-${Date.now()}`,
      amountDue: amountDue || booking.Quote.totalAmount,
      dueDate: dueDate || new Date(new Date().setDate(new Date().getDate() + 7)),
      status: 'UNPAID'
    });

    const fullInvoice = await Invoice.findByPk(invoice.id, {
      include: [
        {
          model: Booking,
          include: [
            {
              model: Quote,
              include: [
                {
                  model: Item
                },
                {
                  model: Client,
                  include: [{ model: User }]
                }
              ]
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: fullInvoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    let where = {};

    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      const bookings = await Booking.findAll({ where: { clientId: client.id } });
      where.bookingId = bookings.map(b => b.id);
    }

    const invoices = await Invoice.findAll({
      where,
      include: [
        {
          model: Booking,
          include: [
            {
              model: Quote,
              include: [
                {
                  model: Client,
                  include: [{ model: User }]
                }
              ]
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: invoices
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    let where = { id: req.params.id };

    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client) {
        return res.status(404).json({ success: false, message: 'Client profile not found' });
      }
      const bookings = await Booking.findAll({ where: { clientId: client.id } });
      where.bookingId = bookings.map(b => b.id);
    }

    const invoice = await Invoice.findOne({
      where,
      include: [
        {
          model: Booking,
          include: [
            {
              model: Quote,
              include: [
                {
                  model: Item
                },
                {
                  model: Client,
                  include: [{ model: User }]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: Booking,
          include: [
            {
              model: Quote,
              include: [
                {
                  model: Item
                },
                {
                  model: Client,
                  include: [{ model: User }]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Check if client can access this invoice
    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({ where: { userId: req.user.id } });
      if (!client || invoice.Booking.clientId !== client.id) {
        return res.status(403).json({ success: false, message: 'Not authorized to access this invoice' });
      }
    }

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
    doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { align: 'right' });
    doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
    doc.moveDown();

    // Client Information
    doc.fontSize(14).text('Bill To:', { underline: true });
    doc.fontSize(12);
    doc.text(`${invoice.Booking.Quote.Client.User.firstName} ${invoice.Booking.Quote.Client.User.lastName}`);
    doc.text(invoice.Booking.Quote.Client.User.email);
    if (invoice.Booking.Quote.Client.address) {
      doc.text(invoice.Booking.Quote.Client.address);
    }
    doc.moveDown();

    // Items
    doc.fontSize(14).text('Items:', { underline: true });
    doc.moveDown(0.5);

    // Get quote items
    const quoteItems = await QuoteItem.findAll({
      where: { quoteId: invoice.Booking.Quote.id },
      include: [{ model: Item }]
    });

    // Table header
    doc.fontSize(10);
    doc.text('Description', 50, doc.y);
    doc.text('Quantity', 300, doc.y);
    doc.text('Unit Price', 400, doc.y);
    doc.text('Total', 500, doc.y);
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    // Table rows
    quoteItems.forEach(item => {
      doc.text(item.Item.name || 'Service', 50);
      doc.text(item.quantity.toString(), 300);
      doc.text(`$${parseFloat(item.unitPrice).toFixed(2)}`, 400);
      doc.text(`$${parseFloat(item.totalPrice).toFixed(2)}`, 500);
      doc.moveDown(0.5);
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Totals
    doc.fontSize(12);
    doc.text(`Subtotal: $${parseFloat(invoice.Booking.Quote.subtotal).toFixed(2)}`, { align: 'right' });
    if (invoice.Booking.Quote.serviceCharge > 0) {
      doc.text(`Service Charge: $${parseFloat(invoice.Booking.Quote.serviceCharge).toFixed(2)}`, { align: 'right' });
    }
    if (invoice.Booking.Quote.discount > 0) {
      doc.text(`Discount: -$${parseFloat(invoice.Booking.Quote.discount).toFixed(2)}`, { align: 'right' });
    }
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Total Amount: $${parseFloat(invoice.amountDue).toFixed(2)}`, { align: 'right', underline: true });
    doc.moveDown();

    // Status
    doc.fontSize(12);
    doc.text(`Status: ${invoice.status}`, { align: 'right' });

    // Footer
    doc.fontSize(10);
    doc.text('Thank you for your business!', { align: 'center' });

    doc.end();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendInvoiceEmail = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        {
          model: Booking,
          include: [
            {
              model: Quote,
              include: [
                {
                  model: Client,
                  include: [{ model: User }]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Get quote items first
    const quoteItems = await QuoteItem.findAll({
      where: { quoteId: invoice.Booking.Quote.id },
      include: [{ model: Item }]
    });

    // Generate PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Same PDF generation logic as downloadInvoicePDF
      doc.fontSize(20).text('INVOICE', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString()}`, { align: 'right' });
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`, { align: 'right' });
      doc.moveDown();

      doc.fontSize(14).text('Bill To:', { underline: true });
      doc.fontSize(12);
      doc.text(`${invoice.Booking.Quote.Client.User.firstName} ${invoice.Booking.Quote.Client.User.lastName}`);
      doc.text(invoice.Booking.Quote.Client.User.email);
      if (invoice.Booking.Quote.Client.address) {
        doc.text(invoice.Booking.Quote.Client.address);
      }
      doc.moveDown();

      doc.fontSize(14).text('Items:', { underline: true });
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(10);
      doc.text('Description', 50, doc.y);
      doc.text('Quantity', 300, doc.y);
      doc.text('Unit Price', 400, doc.y);
      doc.text('Total', 500, doc.y);
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table rows
      quoteItems.forEach(item => {
        doc.text(item.Item.name || 'Service', 50);
        doc.text(item.quantity.toString(), 300);
        doc.text(`$${parseFloat(item.unitPrice).toFixed(2)}`, 400);
        doc.text(`$${parseFloat(item.totalPrice).toFixed(2)}`, 500);
        doc.moveDown(0.5);
      });

      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Subtotal: $${parseFloat(invoice.Booking.Quote.subtotal).toFixed(2)}`, { align: 'right' });
      if (invoice.Booking.Quote.serviceCharge > 0) {
        doc.text(`Service Charge: $${parseFloat(invoice.Booking.Quote.serviceCharge).toFixed(2)}`, { align: 'right' });
      }
      if (invoice.Booking.Quote.discount > 0) {
        doc.text(`Discount: -$${parseFloat(invoice.Booking.Quote.discount).toFixed(2)}`, { align: 'right' });
      }
      doc.moveDown(0.5);
      doc.fontSize(14).text(`Total Amount: $${parseFloat(invoice.amountDue).toFixed(2)}`, { align: 'right', underline: true });
      doc.moveDown();

      doc.fontSize(12);
      doc.text(`Status: ${invoice.status}`, { align: 'right' });

      doc.fontSize(10);
      doc.text('Thank you for your business!', { align: 'center' });

      doc.end();
    });

    const clientEmail = invoice.Booking.Quote.Client.User.email;
    const emailSent = await sendInvoiceEmail(clientEmail, invoice, pdfBuffer);

    if (emailSent) {
      res.json({
        success: true,
        message: 'Invoice sent via email successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to send invoice email'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

