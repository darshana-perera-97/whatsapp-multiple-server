const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 5050;

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const USER_DATA_DIR = path.join(__dirname, 'userData');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

// Initialize users.json file if it doesn't exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Store WhatsApp clients for each user
const whatsappClients = new Map();

// Helper function to generate unique userId
const generateUserId = () => {
  return crypto.randomUUID();
};

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper functions for file operations
const readUsersFromFile = () => {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users file:', error);
    return [];
  }
};

const writeUsersToFile = (users) => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing users file:', error);
    return false;
  }
};

// WhatsApp client management functions
const createWhatsAppClient = (userId) => {
  const userDataPath = path.join(USER_DATA_DIR, userId);
  
  // Ensure user data directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const client = new Client({
    authStrategy: new LocalAuth({
      clientId: userId,
      dataPath: userDataPath
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  return client;
};

const getOrCreateWhatsAppClient = (userId) => {
  if (!whatsappClients.has(userId)) {
    const client = createWhatsAppClient(userId);
    whatsappClients.set(userId, client);
  }
  return whatsappClients.get(userId);
};

// Middleware to authenticate user
const authenticateUser = (req, res, next) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({
      message: 'User ID is required',
      status: 'error'
    });
  }

  // Check if user exists
  const users = readUsersFromFile();
  const user = users.find(u => u.userId === userId);
  
  if (!user) {
    return res.status(404).json({
      message: 'User not found',
      status: 'error'
    });
  }

  req.user = user;
  next();
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic root API endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to WhatsApp Multiple Server Backend API',
    status: 'success',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// User Registration endpoint
app.post('/api/users/register', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        status: 'error'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: 'Please provide a valid email address',
        status: 'error'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters long',
        status: 'error'
      });
    }

    // Read users from file
    const users = readUsersFromFile();

    // Check if user already exists
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return res.status(409).json({
        message: 'User with this email already exists',
        status: 'error'
      });
    }

    // Create new user
    const userId = generateUserId();
    const newUser = {
      userId,
      email,
      password, // In production, hash the password
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add user to array and save to file
    users.push(newUser);
    const success = writeUsersToFile(users);
    
    if (!success) {
      return res.status(500).json({
        message: 'Failed to save user data',
        status: 'error'
      });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json({
      message: 'User registered successfully',
      status: 'success',
      user: userWithoutPassword
    });

  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      status: 'error'
    });
  }
});

// User Login endpoint
app.post('/api/users/login', (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
        status: 'error'
      });
    }

    // Read users from file
    const users = readUsersFromFile();

    // Find user
    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 'error'
      });
    }

    // Check password (in production, compare hashed passwords)
    if (user.password !== password) {
      return res.status(401).json({
        message: 'Invalid email or password',
        status: 'error'
      });
    }

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      status: 'success',
      user: userWithoutPassword
    });

  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      status: 'error'
    });
  }
});

// Get all users endpoint
app.get('/api/users', (req, res) => {
  try {
    // Read users from file
    const users = readUsersFromFile();
    
    // Return users without passwords
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    
    res.json({
      message: 'Users retrieved successfully',
      status: 'success',
      users: usersWithoutPasswords,
      count: usersWithoutPasswords.length
    });
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      status: 'error'
    });
  }
});

// Get user by ID endpoint
app.get('/api/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Read users from file
    const users = readUsersFromFile();
    
    const user = users.find(u => u.userId === userId);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
        status: 'error'
      });
    }

    // Return user without password
    const { password, ...userWithoutPassword } = user;

    res.json({
      message: 'User retrieved successfully',
      status: 'success',
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({
      message: 'Internal server error',
      status: 'error'
    });
  }
});

// WhatsApp QR Code endpoint
app.get('/api/users/:userId/whatsapp/qr', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const client = getOrCreateWhatsAppClient(userId);

    // Check if client is already ready
    if (client.info) {
      return res.json({
        message: 'WhatsApp is already connected',
        status: 'connected',
        qrCode: null,
        connectionInfo: {
          name: client.info.pushname,
          phone: client.info.wid.user,
          platform: client.info.platform
        }
      });
    }

    // Set up QR code event listener
    client.on('qr', async (qr) => {
      try {
        const qrCodeDataURL = await qrcode.toDataURL(qr);
        
        // Store QR code in user's data directory
        const qrCodePath = path.join(USER_DATA_DIR, userId, 'qr-code.png');
        const qrCodeBuffer = await qrcode.toBuffer(qr);
        fs.writeFileSync(qrCodePath, qrCodeBuffer);
        
        // Send QR code to client (this will be handled by the client-side)
        res.json({
          message: 'QR code generated successfully',
          status: 'qr_ready',
          qrCode: qrCodeDataURL,
          qrCodePath: `/api/users/${userId}/whatsapp/qr-image`
        });
      } catch (error) {
        console.error('Error generating QR code:', error);
        res.status(500).json({
          message: 'Error generating QR code',
          status: 'error'
        });
      }
    });

    // Set up ready event listener
    client.on('ready', () => {
      console.log(`WhatsApp client ready for user ${userId}`);
    });

    // Set up authentication success listener
    client.on('authenticated', () => {
      console.log(`WhatsApp client authenticated for user ${userId}`);
    });

    // Initialize the client if not already done
    if (!client.isReady) {
      await client.initialize();
    }

  } catch (error) {
    console.error('Error setting up WhatsApp client:', error);
    res.status(500).json({
      message: 'Error setting up WhatsApp client',
      status: 'error'
    });
  }
});

// WhatsApp QR Code Image endpoint
app.get('/api/users/:userId/whatsapp/qr-image', authenticateUser, (req, res) => {
  try {
    const { userId } = req.params;
    const qrCodePath = path.join(USER_DATA_DIR, userId, 'qr-code.png');
    
    if (fs.existsSync(qrCodePath)) {
      res.sendFile(qrCodePath);
    } else {
      res.status(404).json({
        message: 'QR code not found',
        status: 'error'
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error retrieving QR code image',
      status: 'error'
    });
  }
});

// WhatsApp Connection Status endpoint
app.get('/api/users/:userId/whatsapp/status', authenticateUser, (req, res) => {
  try {
    const { userId } = req.params;
    const client = getOrCreateWhatsAppClient(userId);

    if (client.isReady && client.info) {
      res.json({
        message: 'WhatsApp is connected',
        status: 'connected',
        connectionInfo: {
          name: client.info.pushname,
          phone: client.info.wid.user,
          platform: client.info.platform,
          connectedAt: new Date().toISOString()
        }
      });
    } else {
      res.json({
        message: 'WhatsApp is not connected',
        status: 'disconnected',
        connectionInfo: null
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error checking WhatsApp status',
      status: 'error'
    });
  }
});

// Disconnect WhatsApp endpoint
app.post('/api/users/:userId/whatsapp/disconnect', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const client = whatsappClients.get(userId);

    if (client) {
      await client.destroy();
      whatsappClients.delete(userId);
      
      // Clean up user data directory
      const userDataPath = path.join(USER_DATA_DIR, userId);
      if (fs.existsSync(userDataPath)) {
        fs.rmSync(userDataPath, { recursive: true, force: true });
      }

      res.json({
        message: 'WhatsApp disconnected successfully',
        status: 'success'
      });
    } else {
      res.json({
        message: 'No active WhatsApp connection found',
        status: 'success'
      });
    }
  } catch (error) {
    res.status(500).json({
      message: 'Error disconnecting WhatsApp',
      status: 'error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    message: 'Route not found',
    status: 'error',
    path: req.originalUrl
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    status: 'error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 API available at: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
