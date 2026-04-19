const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const path = require('path');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendQuoteEmail = async (clientEmail, quoteData) => {
  // Generate PDF as buffer
  const pdfBuffer = await generateQuoteBuffer(quoteData);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: clientEmail,
    subject: `Quote #${quoteData.quoteNumber} - Starmate Nigeria`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1A6B3C; padding: 20px; text-align: center;">
          <h1 style="color: #C9A84C; margin: 0;">STARMATE NIGERIA</h1>
          <p style="color: #ffffff; margin: 5px 0 0;">Plot 6, Ekukinam Street, Utako, Abuja.</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <p>Dear <strong>${quoteData.Client?.User?.name || 'Valued Client'}</strong>,</p>
          <p>Please find attached your quote <strong>#${quoteData.quoteNumber}</strong>.</p>
          <table style="width:100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="background: #EAF4EE;">
              <td style="padding: 10px; border: 1px solid #ddd;">Quote Number</td>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>${quoteData.quoteNumber}</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Total Amount</td>
              <td style="padding: 10px; border: 1px solid #ddd;"><strong>₦${parseFloat(quoteData.totalAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
            <tr style="background: #EAF4EE;">
              <td style="padding: 10px; border: 1px solid #ddd;">Expiry Date</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${quoteData.expiryDate ? new Date(quoteData.expiryDate).toLocaleDateString('en-GB') : 'N/A'}</td>
            </tr>
          </table>
          <p>Please review the attached PDF and log in to your account to accept or discuss this quote.</p>
          <p style="color: #888; font-size: 12px;">This quote will expire on ${quoteData.expiryDate ? new Date(quoteData.expiryDate).toLocaleDateString('en-GB') : 'the expiry date shown'}.</p>
        </div>
        <div style="background: #1A6B3C; padding: 15px; text-align: center;">
          <p style="color: #C9A84C; margin: 0; font-size: 12px;">Thank you for choosing Starmate Nigeria!</p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `quote-${quoteData.quoteNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

const generateQuoteBuffer = (quote) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width;
    const PH = doc.page.height;
    const M  = 45;
    const contentWidth = PW - M * 2;

    const GREEN       = '#1A6B3C';
    const GOLD        = '#C9A84C';
    const LIGHT_GREEN = '#EAF4EE';
    const DARK_TEXT   = '#1A1A1A';
    const MID_TEXT    = '#444444';
    const WHITE       = '#FFFFFF';

    const FONT_REGULAR = path.join(__dirname, 'fonts', 'Amiko-Regular.ttf');
    const FONT_BOLD    = path.join(__dirname, 'fonts', 'Amiko-Bold.ttf');

    function formatMoney(value) {
      const num = parseFloat(value || 0);
      return '₦' + num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // ── Green header banner ──
    doc.rect(0, 0, PW, 130).fill(GREEN);
    doc.rect(0, 0, PW, 5).fill(GOLD);

    // ── Logo ──
    const logoPath = path.join(__dirname,'../public/starmatenewlogo.png'); // update path if needed
    try {
      doc.image(logoPath, M, 18, { fit: [75, 75], align: 'left', valign: 'center' });
    } catch (e) {
      doc.circle(M + 37, 55, 37).fillAndStroke(GOLD, WHITE);
      doc.fillColor(WHITE).fontSize(9).font(FONT_BOLD).text('LOGO', M + 18, 50);
    }

    // ── Company name & address ──
    const textStartX = M + 90;
    doc.fillColor(WHITE).fontSize(20).font(FONT_BOLD)
      .text('STARMATE NIGERIA', textStartX, 22, { width: PW - textStartX - M });
    doc.rect(textStartX, 48, 200, 2).fill(GOLD);
    doc.fillColor(GOLD).fontSize(9).font(FONT_REGULAR)
      .text('Plot 6, Ekukinam Street, Utako, Abuja.', textStartX, 55, { width: PW - textStartX - M });
    doc.fillColor(WHITE).fontSize(8.5)
      .text('info@starmatenigeria.com  |  +234 000 000 0000', textStartX, 68, { width: PW - textStartX - M });

    // ── QUOTATION label ──
    doc.fillColor(GOLD).fontSize(26).font(FONT_BOLD)
      .text('QUOTATION', 0, 85, { align: 'right', width: PW - M });

    // ── Billed To + Quote details ──
    const metaY = 148;
    doc.rect(M, metaY, contentWidth * 0.48, 80).fill(LIGHT_GREEN);
    doc.fillColor(GREEN).fontSize(8).font(FONT_BOLD).text('BILLED TO', M + 12, metaY + 10);
    doc.rect(M + 12, metaY + 22, 30, 2).fill(GOLD);

    const clientName    = quote.Client?.User?.name    || 'N/A';
    const clientEmail   = quote.Client?.User?.email   || '';
    const clientAddress = quote.Client?.address       || '';
    const companyName   = quote.Client?.companyName   || '';

    doc.fillColor(DARK_TEXT).fontSize(11).font(FONT_BOLD)
      .text(clientName, M + 12, metaY + 30, { width: contentWidth * 0.44 });

    doc.fillColor(MID_TEXT).fontSize(8.5).font(FONT_REGULAR);
    let clientDetailY = metaY + 46;
    if (companyName)   { doc.text(companyName,   M + 12, clientDetailY, { width: contentWidth * 0.44 }); clientDetailY += 13; }
    if (clientEmail)   { doc.text(clientEmail,   M + 12, clientDetailY, { width: contentWidth * 0.44 }); clientDetailY += 13; }
    if (clientAddress) { doc.text(clientAddress, M + 12, clientDetailY, { width: contentWidth * 0.44 }); }

    const rightBoxX = M + contentWidth * 0.52;
    const rightBoxW = contentWidth * 0.48;
    doc.rect(rightBoxX, metaY, rightBoxW, 80).fill(LIGHT_GREEN);

    [
      { label: 'Quote Number', value: quote.quoteNumber || 'N/A' },
      { label: 'Status',       value: quote.status      || 'N/A' },
      { label: 'Expiry Date',  value: quote.expiryDate  ? new Date(quote.expiryDate).toLocaleDateString('en-GB') : 'N/A' },
    ].forEach((row, i) => {
      const ty = metaY + 10 + i * 22;
      doc.fillColor(GREEN).fontSize(8).font(FONT_BOLD).text(row.label + ':', rightBoxX + 12, ty, { width: 90 });
      doc.fillColor(DARK_TEXT).fontSize(8.5).font(FONT_REGULAR).text(row.value, rightBoxX + 108, ty, { width: rightBoxW - 120 });
    });

    // ── Items table ──
    const tableY = metaY + 96;
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

    doc.rect(M, tableY, contentWidth, 24).fill(GREEN);
    [
      { label: '#',           x: col.num,   w: colWidths.num,   align: 'center' },
      { label: 'DESCRIPTION', x: col.name,  w: colWidths.name,  align: 'left'   },
      { label: 'QTY',         x: col.qty,   w: colWidths.qty,   align: 'center' },
      { label: 'UNIT PRICE',  x: col.price, w: colWidths.price, align: 'right'  },
      { label: 'TOTAL',       x: col.total, w: colWidths.total, align: 'right'  },
    ].forEach(h => {
      doc.fillColor(WHITE).fontSize(8).font(FONT_BOLD)
        .text(h.label, h.x + 4, tableY + 8, { width: h.w - 8, align: h.align });
    });

    let rowY = tableY + 26;
    const ROW_H = 22;

    (quote.QuoteItems || []).forEach((qi, index) => {
      const bg = index % 2 === 0 ? WHITE : LIGHT_GREEN;
      doc.rect(M, rowY, contentWidth, ROW_H).fill(bg);
      if (index % 2 === 0) doc.rect(M, rowY, 3, ROW_H).fill(GOLD);

      const textY = rowY + 6;
      doc.fillColor(DARK_TEXT).fontSize(8.5).font(FONT_REGULAR);
      doc.text(`${index + 1}`,             col.num   + 4, textY, { width: colWidths.num   - 8, align: 'center' });
      doc.text(qi.Item?.name || '-',       col.name  + 4, textY, { width: colWidths.name  - 8, align: 'left'   });
      doc.text(`${qi.quantity}`,           col.qty   + 4, textY, { width: colWidths.qty   - 8, align: 'center' });
      doc.text(formatMoney(qi.unitPrice),  col.price + 4, textY, { width: colWidths.price - 8, align: 'right'  });
      doc.text(formatMoney(qi.totalPrice), col.total + 4, textY, { width: colWidths.total - 8, align: 'right'  });
      rowY += ROW_H;
    });

    doc.rect(M, rowY, contentWidth, 2).fill(GOLD);
    rowY += 14;

    // ── Totals ──
    const totalsBoxW = 220;
    const totalsBoxX = PW - M - totalsBoxW;
    const TOTAL_ROW_H = 22;


    const subtotal = parseFloat(quote.subtotal) || 0;
const serviceCharge = parseFloat(quote.serviceCharge) || 0;
const discount = parseFloat(quote.discount) || 0;
const vat = parseFloat(quote.vat) || 0;

const vatAmount = ((subtotal + serviceCharge - discount) * vat) / 100;

    [
      { label: 'Subtotal',            value: formatMoney(quote.subtotal) },
      { label: 'Service Charge',      value: formatMoney(quote.serviceCharge) },
      { label: 'Discount',            value: `- ${formatMoney(quote.discount)}` },
      { label: `VAT (${quote.vat}%)`, value: formatMoney(vatAmount) },
    ].forEach((row, i) => {
      const ty = rowY + i * TOTAL_ROW_H;
      doc.rect(totalsBoxX, ty, totalsBoxW, TOTAL_ROW_H).fill(i % 2 === 0 ? LIGHT_GREEN : WHITE);
      doc.fillColor(MID_TEXT).fontSize(9).font(FONT_REGULAR).text(row.label, totalsBoxX + 10, ty + 6, { width: 110 });
      doc.fillColor(DARK_TEXT).fontSize(9).font(FONT_BOLD).text(row.value, totalsBoxX + 120, ty + 6, { width: totalsBoxW - 130, align: 'right' });
    });

    const grandY = rowY + 4 * TOTAL_ROW_H;
    doc.rect(totalsBoxX, grandY, totalsBoxW, 28).fill(GREEN);
    doc.rect(totalsBoxX, grandY, 4, 28).fill(GOLD);
    doc.fillColor(WHITE).fontSize(10).font(FONT_BOLD).text('TOTAL', totalsBoxX + 14, grandY + 8, { width: 100 });
    doc.fillColor(GOLD).fontSize(12).font(FONT_BOLD)
      .text(formatMoney(quote.totalAmount), totalsBoxX + 110, grandY + 7, { width: totalsBoxW - 120, align: 'right' });

    rowY = grandY + 42;

    // ── Note ──
    if (quote.note) {
      doc.rect(M, rowY, contentWidth, 1).fill(GOLD);
      rowY += 10;
      doc.fillColor(GREEN).fontSize(9).font(FONT_BOLD).text('NOTE:', M, rowY);
      doc.fillColor(MID_TEXT).fontSize(9).font(FONT_REGULAR)
        .text(quote.note, M + 40, rowY, { width: contentWidth - 40 });
      rowY += 30;
    }

    // ── Footer ──
    const footerY = PH - 45;
    doc.rect(0, footerY - 1, PW, 1).fill(GOLD);
    doc.rect(0, footerY, PW, 45).fill(GREEN);
    doc.fillColor(WHITE).fontSize(8).font(FONT_REGULAR)
      .text('Starmate Nigeria  ·  Plot 6, Ekukinam Street, Utako, Abuja.', 0, footerY + 10, { align: 'center', width: PW });
    doc.fillColor(GOLD).fontSize(7.5)
      .text('Thank you for your business!', 0, footerY + 24, { align: 'center', width: PW });

    doc.end();
  });
};

const sendOTPEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Email Verification OTP',
    html: `
      <h1>Email Verification</h1>
      <p>Hello,</p>
      <p>Your OTP for email verification is:</p>
      <h2 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h2>
      <p>This OTP will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <p>Thank you!</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

const sendInvoiceEmail = async (clientEmail, invoiceData, pdfBuffer) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: clientEmail,
    subject: `Invoice #${invoiceData.invoiceNumber} from Cleaning Service`,
    html: `
      <h1>Invoice #${invoiceData.invoiceNumber}</h1>
      <p>Hello,</p>
      <p>Your invoice has been generated.</p>
      <p><strong>Amount Due:</strong> $${invoiceData.amountDue}</p>
      <p><strong>Due Date:</strong> ${new Date(invoiceData.dueDate).toLocaleDateString()}</p>
      <p>Please find the invoice PDF attached.</p>
      <p>Thank you!</p>
    `,
    attachments: [
      {
        filename: `invoice-${invoiceData.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }
    ]
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

module.exports = { sendQuoteEmail, sendOTPEmail, sendInvoiceEmail, generateQuoteBuffer };
