const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const app = express();
const PORT = process.env.PORT || 5050;

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// WhatsApp client status
let whatsappReady = false;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WhatsApp event handlers
client.on('qr', (qr) => {
    console.log('📱 WhatsApp QR Code:');
    qrcode.generate(qr, { small: true });
    console.log('Scan the QR code above with your WhatsApp mobile app');
});

client.on('ready', () => {
    console.log('✅ WhatsApp client is ready!');
    whatsappReady = true;
});

client.on('authenticated', () => {
    console.log('🔐 WhatsApp client authenticated');
});

client.on('auth_failure', (msg) => {
    console.error('❌ WhatsApp authentication failed:', msg);
    whatsappReady = false;
});

client.on('disconnected', (reason) => {
    console.log('📱 WhatsApp client disconnected:', reason);
    whatsappReady = false;
});

// Root API endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the WhatsApp Multiple Server Backend API',
    status: 'success',
    whatsappStatus: whatsappReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    whatsappStatus: whatsappReady ? 'connected' : 'disconnected',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Send WhatsApp message endpoint
app.post('/send-message', async (req, res) => {
    try {
        if (!whatsappReady) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp client is not ready. Please scan QR code first.',
                whatsappStatus: 'disconnected'
            });
        }

        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({
                success: false,
                message: 'Number and message are required'
            });
        }

        // Format number (remove any non-digit characters and add country code if needed)
        const formattedNumber = number.replace(/\D/g, '');
        const chatId = formattedNumber.includes('94') ? 
            `${formattedNumber}@c.us` : 
            `94${formattedNumber}@c.us`;

        // Send message
        const result = await client.sendMessage(chatId, message);
        
        res.json({
            success: true,
            message: 'Message sent successfully',
            messageId: result.id._serialized,
            chatId: chatId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message',
            error: error.message
        });
    }
});

// Send Hi message to specific number endpoint
app.post('/send-hi', async (req, res) => {
    try {
        if (!whatsappReady) {
            return res.status(400).json({
                success: false,
                message: 'WhatsApp client is not ready. Please scan QR code first.',
                whatsappStatus: 'disconnected'
            });
        }

        const number = '+94771461925';
        const message = 'Hi';
        
        // Format number
        const formattedNumber = number.replace(/\D/g, '');
        const chatId = `${formattedNumber}@c.us`;

        // Send message
        const result = await client.sendMessage(chatId, message);
        
        res.json({
            success: true,
            message: 'Hi message sent successfully',
            messageId: result.id._serialized,
            chatId: chatId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error sending Hi message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send Hi message',
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API available at: http://localhost:${PORT}`);
  console.log(`🏥 Health check at: http://localhost:${PORT}/health`);
  console.log(`📱 WhatsApp endpoints:`);
  console.log(`   POST /send-message - Send custom message`);
  console.log(`   POST /send-hi - Send Hi to +94771461925`);
  
  // Initialize WhatsApp client
  console.log('🔌 Initializing WhatsApp client...');
  client.initialize();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});
