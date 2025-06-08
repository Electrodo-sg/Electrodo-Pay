import express, { Request, Response } from 'express';
import { Connection, clusterApiUrl } from '@solana/web3.js';
import { saveTransaction, getTransactionByDealId } from '../tx-store/tx-store';

const app = express();
const connection = new Connection(clusterApiUrl('devnet'));

app.use(express.json());

app.post('/api/broadcast', async (req: Request, res: Response) => {
  const { txHash, dealId } = req.body;

  if (!txHash || !dealId) {
    return res.status(400).json({ error: 'txHash and dealId are required' });
  }

  const timestamp = Date.now();
  saveTransaction({ txHash, dealId, timestamp });

  res.json({ success: true, txHash, dealId, timestamp });
});


app.get('/api/tx-status', async (req: Request, res: Response) => {
  const { dealId } = req.query;

  if (!dealId || typeof dealId !== 'string') {
    return res.status(400).json({ error: 'dealId is required' });
  }

  const tx = getTransactionByDealId(dealId);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  const result = await connection.getConfirmedTransaction(tx.txHash, 'confirmed');

  res.json({
    txHash: tx.txHash,
    status: result ? 'confirmed' : 'not found',
    timestamp: tx.timestamp,
    explorerUrl: `https://explorer.solana.com/tx/${tx.txHash}?cluster=devnet`
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
