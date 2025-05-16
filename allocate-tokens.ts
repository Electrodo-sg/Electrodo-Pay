import express from 'express';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from '@solana/web3.js';
import {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const connection = new Connection('https://api.devnet.solana.com');

const TOKEN_CONFIG = {
  mintAddress: '2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft',
  totalAmount: 10,
  decimals: 3,
};

const RECIPIENTS = [
  { address: '7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3', percentage: 80 },
  { address: '98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd', percentage: 15 },
  { address: '5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3', percentage: 5 },
];

async function allocateTokens(): Promise<string> {
  console.log('Starting token distribution...');

  const secretKeyEnv = process.env.USER_SECRET_KEY;
  if (!secretKeyEnv) {
    throw new Error('Environment variable USER_SECRET_KEY is not set');
  }

  let secretKeyArray: number[];
  try {
    secretKeyArray = JSON.parse(secretKeyEnv);
    if (!Array.isArray(secretKeyArray)) throw new Error();
  } catch {
    throw new Error('Invalid USER_SECRET_KEY format: expected JSON array of numbers');
  }

  const sender = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    sender,
    new PublicKey(TOKEN_CONFIG.mintAddress),
    sender.publicKey
  );

  const transaction = new Transaction();

  for (const recipient of RECIPIENTS) {
    const recipientPubkey = new PublicKey(recipient.address);
    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      sender,
      new PublicKey(TOKEN_CONFIG.mintAddress),
      recipientPubkey,
      true
    );

    const amount =
      (TOKEN_CONFIG.totalAmount * recipient.percentage) / 100 *
      Math.pow(10, TOKEN_CONFIG.decimals);

    const senderBalance = await connection.getTokenAccountBalance(senderTokenAccount.address);
    const availableBalance = senderBalance.value.uiAmount ?? 0;

    if (availableBalance < amount / Math.pow(10, TOKEN_CONFIG.decimals)) {
      throw new Error(
        `Insufficient tokens. Required: ${amount}, Available: ${availableBalance}`
      );
    }

    const transferInstruction = createTransferInstruction(
      senderTokenAccount.address,
      recipientTokenAccount.address,
      sender.publicKey,
      amount
    );

    transaction.add(transferInstruction);
  }

  const signature = await sendAndConfirmTransaction(connection, transaction, [sender]);
  return signature;
}

app.post('/api/transfer', async (req, res) => {
  try {
    const signature = await allocateTokens();
    res.status(200).json({ success: true, message: 'Tokens distributed', signature });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
