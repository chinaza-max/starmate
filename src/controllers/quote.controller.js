const initModels = require('../models');
const sequelize = require('../config/db.config');
const models = initModels(sequelize);
const { User, Client,Quote, Item, QuoteItem } = models;

const { sendQuoteEmail ,generateQuoteBuffer} = require('../services/email.service');


// ─── Brand Colors ───────────────────────────────────────────────
const GREEN = '#1A6B3C';   // deep green
const GOLD  = '#C9A84C';   // gold
const LIGHT_GREEN = '#EAF4EE';
const DARK_TEXT   = '#1A1A1A';
const MID_TEXT    = '#444444';
const LIGHT_GRAY  = '#F5F5F5';
const WHITE       = '#FFFFFF';

const { calculateQuoteTotals } = require('../services/calculation.service');

/*
exports.createQuote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { clientId, items, serviceCharge = 0, discount = 0, vat = 0, expiryDate ,note} = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: "Items are required" });
    }

    const itemIds = items.map(i => i.itemId);
    const dbItems = await Item.findAll({ where: { id: itemIds } });

    const quoteItemsData = items.map(item => {
      const dbItem = dbItems.find(di => di.id === item.itemId);
      if (!dbItem) throw new Error(`Item ${item.itemId} not found`);

      return {
        itemId: item.itemId,
        quantity: item.quantity,
        price: dbItem.basePrice
      };
    });

    // Calculate subtotal
    const subtotal = quoteItemsData.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    const vatAmount = (subtotal * vat) / 100;
    const totalAmount = subtotal + serviceCharge + vatAmount - discount;

    const quote = await Quote.create({
      clientId,
      quoteNumber: `QT-${Date.now()}`,
      subtotal,
      serviceCharge,
      discount,
      vat,
      totalAmount,
      expiryDate,
      status: 'PENDING',
      note
    }, { transaction: t });

    for (const item of quoteItemsData) {
      await QuoteItem.create({
        quoteId: quote.id,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.price * item.quantity
      }, { transaction: t });
    }

    await t.commit();

    const fullQuote = await Quote.findByPk(quote.id, {
      include: [Item, { model: Client, include: [User] }]
    });

    res.status(201).json({ success: true, data: fullQuote });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ success: false, message: error.message });
  }
};
*/

exports.createQuote = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      clientId,
      items,
      serviceCharge = 0,
      discount = 0,
      vat = 0,
      expiryDate,
      note
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({
        success: false,
        message: "Items are required"
      });
    }

    // Fetch items from DB
    const itemIds = items.map(i => i.itemId);
    const dbItems = await Item.findAll({ where: { id: itemIds } });

    // Map items
    const quoteItemsData = items.map(item => {
      const dbItem = dbItems.find(di => di.id === item.itemId);
      if (!dbItem) throw new Error(`Item ${item.itemId} not found`);

      return {
        itemId: item.itemId,
        quantity: item.quantity,
        price: parseFloat(dbItem.basePrice)
      };
    });

    // ✅ Subtotal (items only)
    const subtotal = quoteItemsData.reduce(
      (sum, item) => sum + (item.price * item.quantity),
      0
    );

    // Ensure numbers are numbers (avoid string issues from DB/request)
    const parsedServiceCharge = parseFloat(serviceCharge) || 0;
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedVat = parseFloat(vat) || 0;

    // ✅ Correct calculation flow
    const baseAmount = subtotal + parsedServiceCharge - parsedDiscount;

    const vatAmount = (baseAmount * parsedVat) / 100;

    const totalAmount = baseAmount + vatAmount;

    // Optional: round to 2 decimal places (important for money)
    const roundedSubtotal = parseFloat(subtotal.toFixed(2));
    const roundedVatAmount = parseFloat(vatAmount.toFixed(2));
    const roundedTotalAmount = parseFloat(totalAmount.toFixed(2));

    // Create Quote
    const quote = await Quote.create({
      clientId,
      quoteNumber: `QT-${Date.now()}`,
      subtotal: roundedSubtotal,
      serviceCharge: parsedServiceCharge,
      discount: parsedDiscount,
      vat: parsedVat,
      totalAmount: roundedTotalAmount,
      expiryDate,
      status: "PENDING",
      note
    }, { transaction: t });

    // Create Quote Items
    for (const item of quoteItemsData) {
      await QuoteItem.create({
        quoteId: quote.id,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: parseFloat((item.price * item.quantity).toFixed(2))
      }, { transaction: t });
    }

    await t.commit();

    // Fetch full quote
    const fullQuote = await Quote.findByPk(quote.id, {
      include: [
        Item,
        { model: Client, include: [User] }
      ]
    });

    return res.status(201).json({
      success: true,
      data: {
        ...fullQuote.toJSON(),
        vatAmount: roundedVatAmount,   // ✅ include this for clarity
        baseAmount: parseFloat(baseAmount.toFixed(2))
      }
    });

  } catch (error) {
    await t.rollback();

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.sendQuote = async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id, {
      include: [
        {
          model: QuoteItem,   // ← add this so PDF has items
          include: [Item],
        },
        {
          model: Client,
          include: [User],
        },
      ],
    });

    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });

    const emailSent = await sendQuoteEmail(quote.Client.User.email, quote);

    if (emailSent) {
      quote.status = 'SENT';
      await quote.save();
      res.json({ success: true, message: 'Quote sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getQuotes = async (req, res) => {
  try {
    let filter = {};

    // Get pagination params
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 10, 1);
    const offset = (page - 1) * limit;

    // Role-based filtering
    if (req.user.role === 'CLIENT') {
      const client = await Client.findOne({
        where: { userId: req.user.id }
      });

      if (!client) {
        return res.status(404).json({
          success: false,
          message: "Client not found"
        });
      }

      filter.clientId = client.id;
    }

    // Fetch quotes with pagination + latest first
    const { count, rows } = await Quote.findAndCountAll({
      where: filter,
      include: [
        {
          model: Item
        },
        {
          model: Client
        }
      ],
      order: [['createdAt', 'DESC']], // 👈 MOST RECENT FIRST
      limit,
      offset
    });

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        totalItems: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < Math.ceil(count / limit),
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error("GET QUOTES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch quotes",
      error: error.message
    });
  }
};

exports.acceptQuote = async (req, res) => {
  try {
    const quote = await Quote.findByPk(req.params.id);
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    
    quote.status = 'ACCEPTED';
    await quote.save();
    
    res.json({ success: true, message: 'Quote accepted', data: quote });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateQuote = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { serviceCharge, discount, vat, expiryDate, note } = req.body;

    const quote = await Quote.findByPk(id, { transaction: t });

    if (!quote) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: "Quote not found"
      });
    }

    if (quote.status !== 'PENDING') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Only pending quotes can be updated"
      });
    }

    // ✅ Ensure numbers are parsed properly (VERY IMPORTANT)
    const parsedServiceCharge =
      serviceCharge !== undefined
        ? parseFloat(serviceCharge) || 0
        : parseFloat(quote.serviceCharge) || 0;

    const parsedDiscount =
      discount !== undefined
        ? parseFloat(discount) || 0
        : parseFloat(quote.discount) || 0;

    const parsedVat =
      vat !== undefined
        ? parseFloat(vat) || 0
        : parseFloat(quote.vat) || 0;

    const subtotal = parseFloat(quote.subtotal) || 0;

    // ✅ SAME LOGIC AS CREATE
    const baseAmount = subtotal + parsedServiceCharge - parsedDiscount;

    const vatAmount = (baseAmount * parsedVat) / 100;

    const totalAmount = baseAmount + vatAmount;

    // ✅ Round properly
    const roundedTotalAmount = parseFloat(totalAmount.toFixed(2));
    const roundedVatAmount = parseFloat(vatAmount.toFixed(2));
    const roundedBaseAmount = parseFloat(baseAmount.toFixed(2));

    // ✅ Update fields
    quote.serviceCharge = parsedServiceCharge;
    quote.discount = parsedDiscount;
    quote.vat = parsedVat;

    if (expiryDate !== undefined) quote.expiryDate = expiryDate;
    if (note !== undefined) quote.note = note;

    quote.totalAmount = roundedTotalAmount;

    await quote.save({ transaction: t });

    await t.commit();

    return res.json({
      success: true,
      message: "Quote updated successfully",
      data: {
        ...quote.toJSON(),
        vatAmount: roundedVatAmount,
        baseAmount: roundedBaseAmount
      }
    });

  } catch (error) {
    await t.rollback();

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateQuoteStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED'];

    // ✅ Validate input
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}`
      });
    }

    const quote = await Quote.findByPk(id);

    if (!quote) {
      return res.status(404).json({
        success: false,
        message: "Quote not found"
      });
    }

    // ✅ Optional: Prevent invalid transitions
    const invalidTransitions = {
      ACCEPTED: ['PENDING'], // example rule
      CONVERTED: ['PENDING', 'REJECTED']
    };

    if (
      invalidTransitions[status] &&
      invalidTransitions[status].includes(quote.status)
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from ${quote.status} to ${status}`
      });
    }

    // ✅ Update status
    quote.status = status;

    await quote.save();

    return res.json({
      success: true,
      message: "Quote status updated successfully",
      data: quote
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.generateQuotePdf = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findByPk(id, {
      include: [
        { model: QuoteItem, include: [Item] },
        { model: Client, include: [User] },
      ],
    });

    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const pdfBuffer = await generateQuoteBuffer (quote);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.quoteNumber}.pdf`);
    res.end(pdfBuffer);

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getClientQuotes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Find client linked to logged-in user
    const client = await Client.findOne({
      where: { userId: req.user.id }
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client profile not found"
      });
    }

    const { count, rows } = await Quote.findAndCountAll({
      where: { clientId: client.id },
      include: [
        {
          model: QuoteItem,
          include: [Item]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    return res.json({
      success: true,
      data: rows,
      pagination: {
        totalRecords: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        pageSize: limit
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
/*
exports.generateQuotePdf = async (req, res) => {
  try {
    const { id } = req.params;

    const quote = await Quote.findByPk(id, {
      include: [
        {
          model: QuoteItem,
          include: [Item],
        },
        {
          model: Client,
          include: [User],
        },
      ],
    });

    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const doc = new PDFDocument({ margin: 0, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=quote-${quote.quoteNumber}.pdf`);
    doc.pipe(res);

    const PW = doc.page.width;   // 595
    const PH = doc.page.height;  // 841
    const M  = 45;               // side margin
    const contentWidth = PW - M * 2;

    // ═══════════════════════════════════════════════════════════
    // 1. GREEN HEADER BANNER
    // ═══════════════════════════════════════════════════════════
    doc.rect(0, 0, PW, 130).fill(GREEN);

    // Gold accent bar at very top
    doc.rect(0, 0, PW, 5).fill(GOLD);

    // ── Logo (left side of header) ──
    //const logoPath = path.join(__dirname, 'assets', 'logo.png'); // <-- update if needed
    const logoPath = path.join(__dirname, '../public/starmatenewlogo.png'); // <-- update this path

    try {
      doc.image(logoPath, M, 18, {
        fit: [75, 75],          // constrained box — no squishing
        align: 'left',
        valign: 'center',
      });
    } catch (e) {
      // If logo not found, draw a placeholder circle
      doc.circle(M + 37, 55, 37).fillAndStroke(GOLD, WHITE);
      doc.fillColor(WHITE).fontSize(9).font('Helvetica-Bold').text('LOGO', M + 18, 50);
    }

    // ── Company name & address (right of logo) ──
    const textStartX = M + 90;
    doc
      .fillColor(WHITE)
      .fontSize(20)
      .font('Helvetica-Bold')
      .text('STARMATE NIGERIA', textStartX, 22, { width: PW - textStartX - M });

    // Gold underline beneath company name
    doc.rect(textStartX, 48, 200, 2).fill(GOLD);

    doc
      .fillColor(GOLD)
      .fontSize(9)
      .font('Helvetica')
      .text('Plot 6, Ekukinam Street, Utako, Abuja.', textStartX, 55, { width: PW - textStartX - M });

    doc
      .fillColor(WHITE)
      .fontSize(8.5)
      .text('info@starmatenigeria.com  |  +234 000 000 0000', textStartX, 68, { width: PW - textStartX - M });

    // ── "QUOTATION" label (far right of header) ──
    doc
      .fillColor(GOLD)
      .fontSize(26)
      .font('Helvetica-Bold')
      .text('QUOTATION', 0, 85, { align: 'right', width: PW - M });

    // ═══════════════════════════════════════════════════════════
    // 2. QUOTE META / BILLED TO  (two-column row)
    // ═══════════════════════════════════════════════════════════
    const metaY = 148;

    // Left box — Billed To
    doc.rect(M, metaY, contentWidth * 0.48, 80).fill(LIGHT_GREEN);

    doc
      .fillColor(GREEN)
      .fontSize(8)
      .font('Helvetica-Bold')
      .text('BILLED TO', M + 12, metaY + 10);

    doc.rect(M + 12, metaY + 22, 30, 2).fill(GOLD); // small gold underline

    const clientName = quote.Client?.User?.firstName+" "+quote.Client?.User?.lastName || 'N/A';
    const clientEmail = quote.Client?.User?.email || '';
    const clientAddress = quote.Client?.address || '';
    const companyName = quote.Client?.companyName || '';

    doc
      .fillColor(DARK_TEXT)
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(clientName, M + 12, metaY + 30, { width: contentWidth * 0.44 });

    doc
      .fillColor(MID_TEXT)
      .fontSize(8.5)
      .font('Helvetica');

    let clientDetailY = metaY + 46;
    if (companyName) {
      doc.text(companyName, M + 12, clientDetailY, { width: contentWidth * 0.44 });
      clientDetailY += 13;
    }
    if (clientEmail) {
      doc.text(clientEmail, M + 12, clientDetailY, { width: contentWidth * 0.44 });
      clientDetailY += 13;
    }
    if (clientAddress) {
      doc.text(clientAddress, M + 12, clientDetailY, { width: contentWidth * 0.44 });
    }

    // Right box — Quote details
    const rightBoxX = M + contentWidth * 0.52;
    const rightBoxW = contentWidth * 0.48;
    doc.rect(rightBoxX, metaY, rightBoxW, 80).fill(LIGHT_GREEN);

    const detailRows = [
      { label: 'Quote Number', value: quote.quoteNumber || 'N/A' },
      { label: 'Status',       value: quote.status || 'N/A' },
      { label: 'Expiry Date',  value: quote.expiryDate ? new Date(quote.expiryDate).toLocaleDateString('en-GB') : 'N/A' },
    ];

    detailRows.forEach((row, i) => {
      const rowY = metaY + 10 + i * 22;
      doc
        .fillColor(GREEN)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(row.label + ':', rightBoxX + 12, rowY, { width: 90, continued: false });
      doc
        .fillColor(DARK_TEXT)
        .fontSize(8.5)
        .font('Helvetica')
        .text(row.value, rightBoxX + 108, rowY, { width: rightBoxW - 120 });
    });

    // ═══════════════════════════════════════════════════════════
    // 3. ITEMS TABLE
    // ═══════════════════════════════════════════════════════════
    const tableY = metaY + 96;

    // Column x positions
    const col = {
      num:   M,
      name:  M + 30,
      qty:   M + contentWidth * 0.52,
      price: M + contentWidth * 0.65,
      total: M + contentWidth * 0.80,
    };
    const colWidths = {
      num:   28,
      name:  contentWidth * 0.50,
      qty:   contentWidth * 0.12,
      price: contentWidth * 0.14,
      total: contentWidth * 0.20,
    };

    // Header row
    doc.rect(M, tableY, contentWidth, 24).fill(GREEN);
    const headers = [
      { label: '#',           x: col.num,   w: colWidths.num,   align: 'center' },
      { label: 'DESCRIPTION', x: col.name,  w: colWidths.name,  align: 'left'   },
      { label: 'QTY',         x: col.qty,   w: colWidths.qty,   align: 'center' },
      { label: 'UNIT PRICE',  x: col.price, w: colWidths.price, align: 'right'  },
      { label: 'TOTAL',       x: col.total, w: colWidths.total, align: 'right'  },
    ];

    headers.forEach(h => {
      doc
        .fillColor(WHITE)
        .fontSize(8)
        .font('Helvetica-Bold')
        .text(h.label, h.x + 4, tableY + 8, { width: h.w - 8, align: h.align });
    });

    // Data rows
    let rowY = tableY + 26;
    const ROW_H = 22;

    (quote.QuoteItems || []).forEach((qi, index) => {
      const bg = index % 2 === 0 ? WHITE : LIGHT_GREEN;
      doc.rect(M, rowY, contentWidth, ROW_H).fill(bg);

      // subtle gold left border on even rows
      if (index % 2 === 0) {
        doc.rect(M, rowY, 3, ROW_H).fill(GOLD);
      }

      const textY = rowY + 6;
      doc.fillColor(DARK_TEXT).fontSize(8.5).font('Helvetica');

      doc.text(`${index + 1}`, col.num + 4,  textY, { width: colWidths.num - 8,   align: 'center' });
      doc.text(qi.Item?.name || '-', col.name + 4, textY, { width: colWidths.name - 8,  align: 'left'   });
      doc.text(`${qi.quantity}`, col.qty + 4,  textY, { width: colWidths.qty - 8,   align: 'center' });
      doc.text(formatMoney(qi.unitPrice),  col.price + 4, textY, { width: colWidths.price - 8, align: 'right'  });
      doc.text(formatMoney(qi.totalPrice), col.total + 4, textY, { width: colWidths.total - 8, align: 'right'  });

      rowY += ROW_H;
    });

    // Bottom border of table
    doc.rect(M, rowY, contentWidth, 2).fill(GOLD);
    rowY += 14;

    // ═══════════════════════════════════════════════════════════
    // 4. TOTALS SECTION (right-aligned box)
    // ═══════════════════════════════════════════════════════════
    const totalsBoxW = 220;
    const totalsBoxX = PW - M - totalsBoxW;
    const totalsStartY = rowY;
    const TOTAL_ROW_H = 22;

    const totalsRows = [
      { label: 'Subtotal',       value: formatMoney(quote.subtotal) },
      { label: 'Service Charge', value: formatMoney(quote.serviceCharge) },
      { label: 'Discount',       value: `- ${formatMoney(quote.discount)}` },
      { label: `VAT (${quote.vat}%)`, value: formatMoney((parseFloat(quote.subtotal || 0) * parseFloat(quote.vat || 0)) / 100) },
    ];

    totalsRows.forEach((row, i) => {
      const ty = totalsStartY + i * TOTAL_ROW_H;
      const bg = i % 2 === 0 ? LIGHT_GREEN : WHITE;
      doc.rect(totalsBoxX, ty, totalsBoxW, TOTAL_ROW_H).fill(bg);

      doc
        .fillColor(MID_TEXT)
        .fontSize(9)
        .font('Helvetica')
        .text(row.label, totalsBoxX + 10, ty + 6, { width: 110 });

      doc
        .fillColor(DARK_TEXT)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(row.value, totalsBoxX + 120, ty + 6, { width: totalsBoxW - 130, align: 'right' });
    });

    // Grand Total row
    const grandY = totalsStartY + totalsRows.length * TOTAL_ROW_H;
    doc.rect(totalsBoxX, grandY, totalsBoxW, 28).fill(GREEN);
    doc.rect(totalsBoxX, grandY, 4, 28).fill(GOLD); // gold left accent

    doc
      .fillColor(WHITE)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('TOTAL', totalsBoxX + 14, grandY + 8, { width: 100 });

    doc
      .fillColor(GOLD)
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(formatMoney(quote.totalAmount), totalsBoxX + 110, grandY + 7, {
        width: totalsBoxW - 120,
        align: 'right',
      });

    rowY = grandY + 42;

    // ═══════════════════════════════════════════════════════════
    // 5. NOTE
    // ═══════════════════════════════════════════════════════════
    if (quote.note) {
      doc.rect(M, rowY, contentWidth, 1).fill(GOLD);
      rowY += 10;

      doc
        .fillColor(GREEN)
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('NOTE:', M, rowY);

      doc
        .fillColor(MID_TEXT)
        .fontSize(9)
        .font('Helvetica')
        .text(quote.note, M + 40, rowY, { width: contentWidth - 40 });

      rowY += 30;
    }

    // ═══════════════════════════════════════════════════════════
    // 6. FOOTER
    // ═══════════════════════════════════════════════════════════
    const footerY = PH - 45;
    doc.rect(0, footerY - 1, PW, 1).fill(GOLD);
    doc.rect(0, footerY, PW, 45).fill(GREEN);

    doc
      .fillColor(WHITE)
      .fontSize(8)
      .font('Helvetica')
      .text(
        'Starmate Nigeria  ·  Plot 6, Ekukinam Street, Utako, Abuja.',
        0, footerY + 10,
        { align: 'center', width: PW }
      );

    doc
      .fillColor(GOLD)
      .fontSize(7.5)
      .text(
        'Thank you for your business!',
        0, footerY + 24,
        { align: 'center', width: PW }
      );

    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
*/
// ─── Helper ─────────────────────────────────────────────────────
function formatMoney(value) {
  const num = parseFloat(value || 0);
  return 'NGN' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
