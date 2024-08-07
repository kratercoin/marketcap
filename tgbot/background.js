const fs = require('fs');
const axios = require('axios');
const mintAddressFile = 'mint_address.json';
const marketCapFile = 'marketcap.json';
const interval = 1 * 60 * 1000; // 1 minute in milliseconds

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
const searchMintAddressesFromFile = async (chatId, bot) => {
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
const startChecking = (chatId, bot) => {
  console.log('Starting background process to check mint addresses every 1 minute.');
  searchMintAddressesFromFile(chatId, bot); // Initial call
  setInterval(() => {
    searchMintAddressesFromFile(chatId, bot); // Set interval for 1 minute
  }, interval);
};

module.exports = { startChecking };
