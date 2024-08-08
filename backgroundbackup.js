const express = require('express'); // Import express
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
require('dotenv').config();

const app = express(); // Create an Express app
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const mintAddressFile = 'mint_address.json';
const marketCapFile = 'marketcap.json';
const walletsFile = 'wallets.json';
const intervalDuration = 45 * 1000; // 45 seconds in milliseconds

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
    return [];
  }

  const fileData = fs.readFileSync(walletsFile);
  let wallets;

  try {
    wallets = JSON.parse(fileData);
  } catch (error) {
    console.error('Error parsing wallets.json:', error);
    return [];
  }

  if (!wallets || wallets.length === 0) {
    await bot.sendMessage(chatId, 'No wallet addresses found. Please add a wallet address using the /add command.');
    return []; // Return empty if no wallets found
  }
  return wallets; // Return existing wallets
};

// Function to get wallet balance using Solana Web3.js
const getWalletInfo = async (walletAddress, chatId) => {
  const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
  const publicKey = new PublicKey(walletAddress);

  try {
    const solBalance = await connection.getBalance(publicKey);
    await bot.sendMessage(chatId, `SOL Balance for ${walletAddress}: ${(solBalance / 1e9).toFixed(9)} SOL`); // Convert lamports to SOL

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: splToken.TOKEN_PROGRAM_ID,
    });

    if (tokenAccounts.value.length === 0) {
      await bot.sendMessage(chatId, 'No SPL token holdings found.');
      return [];
    }

    const mintAddresses = [];
    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed;
      const mintAddress = accountData.info.mint;
      mintAddresses.push(mintAddress);
      await bot.sendMessage(chatId, `Mint: ${mintAddress.replace(/[\(\)]/g, '')}, Amount: ${accountData.info.tokenAmount.uiAmount}`);
    }

    return mintAddresses; // Return the mint addresses found
  } catch (error) {
    console.error('Error retrieving wallet info:', error);
    await bot.sendMessage(chatId, `Error retrieving wallet info: ${error.message}`);
    return [];
  }
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

  const promises = mintAddresses.map(async (mintAddress) => {
    const result = await searchMintAddress(mintAddress);
    if (result) {
      results.push(result);
      // Notify user if market cap is greater than or equal to $75k
      if (result.marketCap >= 75000) {
        await bot.sendMessage(chatId, `💰 Market CAP: *${result.marketCap.toLocaleString()}*  \n📈 Token Name: *${result.tokenName.toUpperCase()}*  \n📌 Mint Address: \`${result.mintAddress.replace(/[\(\)]/g, '')}\``, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        });
      }
    }
  });

  await Promise.all(promises); // Wait for all promises to resolve
  fs.writeFileSync(marketCapFile, JSON.stringify(results, null, 2));
};

// Function to start checking for updates periodically
const startChecking = async (chatId) => {
  const wallets = await checkWallets(chatId); // Check for wallet addresses
  if (wallets.length === 0) return; // Stop if no wallets found

  // Check wallet balances for all addresses
  for (const wallet of wallets) {
    await getWalletInfo(wallet, chatId); // Get wallet info and send to chat
  }

  await searchMintAddressesFromFile(chatId); // Initial call
  setInterval(() => {
    searchMintAddressesFromFile(chatId); // Set interval for 5 minutes
  }, interval);
};

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Start the bot
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    await bot.sendMessage(chatId, 'Bot started. Checking for wallet addresses and mint addresses.');
    await startChecking(chatId); // Start checking when /start command is received
  } catch (error) {
    console.error('Error sending start message:', error);
  }
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
