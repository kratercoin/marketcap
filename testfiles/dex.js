const axios = require('axios');

// Function to search for the mint address and get market cap
const searchMintAddress = async (mintAddress) => {
  const baseUrl = 'https://api.dexscreener.com/latest/dex/search/';
  
  try {
    const response = await axios.get(`${baseUrl}?q=${encodeURIComponent(mintAddress)}`);
    
    if (response.data && response.data.pairs && response.data.pairs.length > 0) {
      const pair = response.data.pairs[0]; // Get the first pair found
      
      const marketCap = pair.volume.h24 * pair.priceUsd; // Calculate market cap
      const tokenPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0; // Get token price in USD
      const liquidity = pair.liquidity.usd ? parseFloat(pair.liquidity.usd) : 0; // Get liquidity in USD
      
      console.log(`Market Cap for Mint Address: ${mintAddress}`);
      console.log(`Token Price: $${tokenPrice}`);
      console.log(`Liquidity: $${liquidity}`);
      console.log(`Market Cap: $${marketCap}`);
    } else {
      console.log('No pairs found for the given mint address.');
    }
  } catch (error) {
    console.error('Error fetching data from DEX Screener:', error.message);
  }
};

// Example usage
const mintAddress = 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm'; // Replace with the mint address you want to search
searchMintAddress(mintAddress);
