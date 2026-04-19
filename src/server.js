const app = require('./app');
const sequelize = require('./config/db.config');
//const { User } = require('./models');
const http = require('http');
const { initializeSocket } = require('./services/socket.service');
const initModels = require('./models');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

// Sync Database and Start Server
async function startServer() {
  try {
    // Authenticate database connection
    await sequelize.authenticate();
    const models=initModels(sequelize)
    const { User } = models;



      await sequelize.sync({ alter: true }); 

    console.log('Database connection established successfully.');
 //  await sequelize.sync({ alter: true });  // Updates existing tables to match models (adds/changes columns without deleting data).

//await sequelize.sync({ alter: false }); // Only creates missing tables; does not modify existing ones.
  
//await sequelize.sync({ force: true });  // Drops all tables and recreates them (deletes all existing data).

// await sequelize.sync({ force: false }); // Default behavior; creates tables if missing but leaves existing ones unchanged.
    console.log('Database models synchronized.');


     const adminEmail = 'admin@gmail.com';
  const adminExists = await User.findOne({
  where: {
    email: adminEmail,
  },
});



  if (!adminExists) {
    await User.create({
      firstName: 'Admin',
      lastName: 'Admin',
      email: adminEmail,
      password: '123456',
      role: 'admin',
      isEmailVerified: true,
    });
    console.log(`Default admin created: ${adminEmail}`);
  }

    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    initializeSocket(server);
    console.log('WebSocket server initialized');

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`WebSocket server is ready for connections`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
