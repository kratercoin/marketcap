const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const splToken = require('@solana/spl-token');
const fs = require('fs');

const walletAddress = '62Jip7CQzSsMF6TQXwjoiM6P77gyjZtsRnBmg5vA3r89'; // Your wallet address here
const connection = new Connection(clusterApiUrl('mainnet-beta'), 'confirmed');
const mintAddressFile = 'mint_address.json';

async function parseAccountData(pubkey, programId, data) {
    let parsedAccount = {
        program: '',
        parsed: {},
        space: data.length,
    };

    try {
        switch (programId.toString()) {
            case splToken.TOKEN_PROGRAM_ID.toString():
                parsedAccount.program = 'spl-token';
                parsedAccount.parsed = await parseTokenAccountData(data);
                break;
            case 'SystemProgramId': // Replace with the actual System Program ID
                parsedAccount.program = 'system';
                parsedAccount.parsed = 'System account data'; // Example; Implement actual parsing
                break;
            case 'VoteProgramId': // Replace with the actual Vote Program ID
                parsedAccount.program = 'vote';
                parsedAccount.parsed = 'Vote account data'; // Example; Implement actual parsing
                break;
            default:
                throw new Error('Program not parsable');
        }
    } catch (error) {
        console.error(`Error parsing account data for ${pubkey}:`, error);
    }

    return parsedAccount;
}

async function parseTokenAccountData(data) {
    const tokenAmount = data;
    return {
        tokenAmount,
    };
}

async function saveMintAddress(mintAddress) {
    let mintAddresses = [];

    if (fs.existsSync(mintAddressFile)) {
        const fileData = fs.readFileSync(mintAddressFile);
        mintAddresses = JSON.parse(fileData);
    }

    if (!mintAddresses.includes(mintAddress)) {
        mintAddresses.push(mintAddress);
        fs.writeFileSync(mintAddressFile, JSON.stringify(mintAddresses, null, 2));
        console.log(`Mint address ${mintAddress} saved successfully.`);
    } else {
        console.log(`Mint address ${mintAddress} already exists.`);
    }
}

async function getWalletInfo() {
    try {
        const publicKey = new PublicKey(walletAddress);
        const solBalance = await connection.getBalance(publicKey);
        console.log(`SOL Balance: ${(solBalance / 1e9).toFixed(9)} SOL`);

        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: splToken.TOKEN_PROGRAM_ID,
        });

        if (tokenAccounts.value.length === 0) {
            console.log('No SPL token holdings found.');
            return;
        }

        console.log('Tokens:');
        for (const tokenAccount of tokenAccounts.value) {
            const accountData = tokenAccount.account.data.parsed;
            const mintAddress = accountData.info.mint;
            await saveMintAddress(mintAddress);
            const parsedAccount = await parseAccountData(publicKey, splToken.TOKEN_PROGRAM_ID, accountData.info.tokenAmount); // Pass the tokenAmount
            console.log(`Mint: ${mintAddress}, Amount: ${parsedAccount.parsed.tokenAmount.uiAmount}`);
        }

    } catch (error) {
        console.error('Error retrieving wallet info:', error);
    }
}

getWalletInfo();
