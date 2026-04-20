const express = require('express');
const cors = require('cors');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const authRoutes = require('./routes/auth.routes');
const quoteRoutes = require('./routes/quote.routes');
const bookingRoutes = require('./routes/booking.routes');
const taskRoutes = require('./routes/task.routes');
const statisticsRoutes = require('./routes/statistics.routes');
const serviceRoutes = require('./routes/service.routes');
const staffRoutes = require('./routes/staff.routes');
const customRequestRoutes = require('./routes/customRequest.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const deviceTokenRoutes = require('./routes/deviceToken.routes');
const messageRoutes = require('./routes/message.routes');
const staffAvailabilityRoutes = require('./routes/staffAvailability.routes');
const itemRoutes = require('./routes/item.routes');
const clientRoutes = require('./routes/client.routes');


const app = express();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cleaning Service Management API',
      version: '1.0.0',
      description: 'API documentation for Cleaning Service Management System',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js', './src/swagger/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Set EJS as the view engine
app.set('view engine', 'ejs');
// Set the views directory
app.set('views', path.join(__dirname, 'views'));
// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/custom-requests', customRequestRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/device-tokens', deviceTokenRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/staff-availability', staffAvailabilityRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/clients', clientRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Cleaning Service Management API' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

module.exports = app;
