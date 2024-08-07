require('dotenv').config(); // Load environment variables from .env file
const fetch = require('node-fetch');

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN; // Load from .env

// Function to get chat ID
const getChatId = async () => {
  try {
    // Send a message to the bot to trigger an update
    await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: 'YOUR_CHAT_ID', // Replace with your chat ID or send to yourself to get updates
        text: 'Hello! Please ignore this message.'
      })
    });

    // Fetch the latest updates to retrieve the chat ID
    const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/getUpdates`);
    const data = await response.json();

    if (data.ok && data.result.length > 0) {
      const chatId = data.result[0].message.chat.id;
      console.log(`Your chat ID is: ${chatId}`);
    } else {
      console.log('No updates found. Please make sure you sent a message to your bot.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

// Start the process
getChatId();
