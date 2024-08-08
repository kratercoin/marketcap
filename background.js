const fs = require('fs');
const axios = require('axios');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js'); // Import Solana Web3.js
const splToken = require('@solana/spl-token');

const mintAddressFile = 'mint_address.json';
const marketCapFile = 'marketcap.json';
const walletsFile = 'wallets.json';
const intervalDuration = 60 * 1000; // 60 seconds in milliseconds

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

// Function to check if wallet addresses exist
const checkWallets = () => {
  if (!fs.existsSync(walletsFile)) {
    console.log('Wallets file not found.');
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

  return wallets || []; // Return wallets or empty array
};

// Function to get wallet balance using Solana Web3.js
const getWalletInfo = async (walletAddress) => {
  const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
  const publicKey = new PublicKey(walletAddress);

  try {
    const solBalance = await connection.getBalance(publicKey);
    console.log(`SOL Balance for ${walletAddress}: ${(solBalance / 1e9).toFixed(9)} SOL`);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
      programId: splToken.TOKEN_PROGRAM_ID,
    });

    if (tokenAccounts.value.length === 0) {
      console.log('No SPL token holdings found.');
      return [];
    }

    const mintAddresses = [];
    for (const tokenAccount of tokenAccounts.value) {
      const accountData = tokenAccount.account.data.parsed;
      const mintAddress = accountData.info.mint;
      mintAddresses.push(mintAddress);
      console.log(`Mint: ${mintAddress}, Amount: ${accountData.info.tokenAmount.uiAmount}`);
    }

    return mintAddresses; // Return the mint addresses found
  } catch (error) {
    console.error('Error retrieving wallet info:', error);
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
const searchMintAddressesFromFile = async () => {
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
        await bot.sendMessage(chatId, `Market CAP: **${formatNumber(result.marketCap)}**\nToken Name: **${result.tokenName.toUpperCase()}**\nMint Address: \`${result.mintAddress}\``, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
        });
      }
    }
  });

  await Promise.all(promises); // Wait for all promises to resolve
  fs.writeFileSync(marketCapFile, JSON.stringify(results, null, 2));
};

// Function to start periodic checking
const startChecking = () => {
  const wallets = checkWallets(); // Check for wallet addresses
  if (wallets.length === 0) {
    console.log('No wallet addresses found. Exiting.');
    return; // Stop if no wallets found
  }

  wallets.forEach(async (wallet) => {
    const mintAddresses = await getWalletInfo(wallet); // Get wallet info
    console.log(`Mint addresses for ${wallet}:`, mintAddresses);
  });

  searchMintAddressesFromFile(); // Initial call
  setInterval(() => {
    searchMintAddressesFromFile(); // Set interval for 45 seconds
  }, intervalDuration);
};

// Start the background process
console.log('Background process is running...');
startChecking();
