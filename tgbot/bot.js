const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const mintAddressFile = 'mint_address.json';
const marketCapFile = 'marketcap.json';
const walletsFile = 'wallets.json';
const interval = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to format large numbers
const formatNumber = (num) => {
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'k';
  }
  return num;
};

// Check if wallet addresses exist and notify user if not
const checkWallets = async (chatId) => {
  if (!fs.existsSync(walletsFile)) {
    return;
  }

  const fileData = fs.readFileSync(walletsFile);
  let wallets;

  try {
    wallets = JSON.parse(fileData);
  } catch (error) {
    console.error('Error parsing wallets.json:', error);
    return;
  }

  if (!wallets || wallets.length === 0) {
    await bot.sendMessage(chatId, 'No wallet addresses found. Please add a wallet address using the /add command.');
    return true; // Indicates no wallets found
  }
  return false; // Indicates wallets exist
};

// Function to search for the mint address and get token details
const searchMintAddress = async (mintAddress) => {
  const baseUrl = 'https://api.dexscreener.com/latest/dex/search/';

  try {
    const response = await axios.get(`${baseUrl}?q=${encodeURIComponent(mintAddress)}`);

    let result = {
      mintAddress,
      tokenName: '',
      tokenPrice: 0,
      liquidity: 0,
      marketCap: 0,
      pairsFound: false
    };

    if (response.data && response.data.pairs && response.data.pairs.length > 0) {
      const pair = response.data.pairs[0]; // Get the first pair found

      result.tokenPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0; // Get token price in USD
      result.liquidity = pair.liquidity && pair.liquidity.usd ? parseFloat(pair.liquidity.usd) : 0; // Get liquidity in USD
      result.marketCap = pair.fdv ? parseFloat(pair.fdv) : 0; // Get market cap
      result.tokenName = pair.baseToken.name; // Get token name
      result.pairsFound = true; // Mark that pairs were found

      console.log(`Token Name: ${result.tokenName}`);
      console.log(`Market Cap for Mint Address: ${mintAddress}`);
      console.log(`Token Price: $${formatNumber(result.tokenPrice)}`);
      console.log(`Liquidity: $${formatNumber(result.liquidity)}`);
      console.log(`Market Cap: $${formatNumber(result.marketCap)}`);
    } else {
      console.log(`No pairs found for the given mint address: ${mintAddress}`);
    }

    return result;
  } catch (error) {
    console.error('Error fetching data from DEX Screener:', error.message);
    return null;
  }
};

// Function to read mint addresses from mint_address.json and search on DEX screener
const searchMintAddressesFromFile = async (chatId) => {
  if (!fs.existsSync(mintAddressFile)) {
    console.log(`File ${mintAddressFile} not found.`);
    return;
  }

  const fileData = fs.readFileSync(mintAddressFile);
  const mintAddresses = JSON.parse(fileData);
  const results = [];

  for (const mintAddress of mintAddresses) {
    const result = await searchMintAddress(mintAddress);
    if (result) {
      results.push(result);
      // Notify user if market cap is greater than or equal to $75k
      if (result.marketCap >= 75000) {
        await bot.sendMessage(chatId, `Market cap of token ${result.tokenName} (${mintAddress}) has reached $${formatNumber(result.marketCap)}!`);
      }
    }
  }

  fs.writeFileSync(marketCapFile, JSON.stringify(results, null, 2));
};

// Function to start checking for updates periodically
const startChecking = async (chatId) => {
  const noWallets = await checkWallets(chatId); // Check for wallet addresses
  if (noWallets) return; // Stop if no wallets found
  searchMintAddressesFromFile(chatId); // Initial call
  setInterval(() => {
    searchMintAddressesFromFile(chatId); // Set interval for 5 minutes
  }, interval);
};

// Start the bot
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Bot started. Checking for wallet addresses and mint addresses.');
  await startChecking(chatId); // Start checking when /start command is received
});

// Command to show help information
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const helpMessage = `
Available Commands:
- /start: Start the bot and check for wallet addresses.
- /help: Show this help message.
`;
  bot.sendMessage(chatId, helpMessage);
});

// Command to stop the background process
bot.onText(/\/stop/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Background process stopped. You can still use other commands.');
  clearInterval(); // Stops the interval (this needs to be managed properly if multiple intervals are running)
});

// Log bot status
console.log('Bot is running...');
