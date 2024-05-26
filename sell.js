require('dotenv').config();
const axios = require('axios');
const { Keypair, Connection, clusterApiUrl, PublicKey } = require('@solana/web3.js');
const { AccountLayout } = require('@solana/spl-token');
const fs = require('fs');
const bs58 = require('bs58');

const SOLANA_WALLET_PATH = process.env.SOLANA_WALLET_PATH;

let privateKey;
try {
    const keypair = fs.readFileSync(SOLANA_WALLET_PATH, 'utf8');
    const keypairArray = JSON.parse(keypair);

    if (Array.isArray(keypairArray)) {
        privateKey = Uint8Array.from(keypairArray);
        console.log('Private key loaded from keypair file.');
    } else {
        throw new Error('Invalid keypair format');
    }
} catch (error) {
    console.error('Error reading Solana wallet keypair:', error);
    process.exit(1);
}

const payer = Keypair.fromSecretKey(privateKey);
const connection = new Connection(clusterApiUrl('mainnet-beta'));

const pumpFunSell = async (mint, amount) => {
    const url = "https://pumpapi.fun/api/trade";
    const data = {
        trade_type: "sell",
        mint,
        amount, // Amount in tokens
        slippage: 5,
        priorityFee: 0.003, // Adjust priority fee if needed
        userPrivateKey: bs58.encode(privateKey)
    };

    try {
        const response = await axios.post(url, data);
        return response.data.tx_hash;
    } catch (error) {
        console.error(`Error executing sell transaction: ${error.message}`, error.response?.data);
        return null;
    }
};

const fetchSPLTokens = async () => {
    try {
        const tokenAccounts = await connection.getTokenAccountsByOwner(payer.publicKey, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
        return tokenAccounts.value.map(accountInfo => {
            const accountData = AccountLayout.decode(accountInfo.account.data);
            return {
                mint: new PublicKey(accountData.mint),
                amount: BigInt(accountData.amount.toString()) // Fetch the raw amount as BigInt
            };
        });
    } catch (error) {
        console.error(`Error fetching SPL tokens: ${error.message}`);
        return [];
    }
};

const sellAllTokens = async () => {
    const tokens = await fetchSPLTokens();
    for (const token of tokens) {
        const mint = token.mint.toString();
        const rawAmount = token.amount;
        const humanReadableAmount = Number(rawAmount) / 10 ** 6; // Convert raw amount to correct human-readable format

        console.log(`Token Mint: ${mint}`);
        console.log(`Raw Amount: ${rawAmount}`);
        console.log(`Human-readable Amount: ${humanReadableAmount}`);

        if (humanReadableAmount >= 1) { // Only proceed if human-readable amount is 1 or more
            console.log(`Selling ${humanReadableAmount} of token ${mint}`);

            let attempts = 5;
            let txHash = null;
            while (attempts > 0) {
                txHash = await pumpFunSell(mint, humanReadableAmount); // Pass human-readable amount for API
                if (txHash) {
                    console.log(`Sold ${humanReadableAmount} of token ${mint} with transaction hash: ${txHash}`);
                    break;
                } else {
                    console.log(`Retrying sell transaction... Attempts left: ${attempts - 1}`);
                    attempts--;
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
                }
            }

            if (!txHash) {
                console.log(`Failed to sell token ${mint} after multiple attempts.`);
            }
        } else {
            console.log(`Skipping token ${mint} as the human-readable amount is less than 1`);
        }
    }
};

sellAllTokens().then(() => {
    console.log('All tokens processed.');
}).catch(error => {
    console.error('Error in selling tokens:', error);
});
