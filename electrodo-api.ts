import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Connection, clusterApiUrl, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';
import { MEMO_PROGRAM_ID } from '@solana/spl-memo';
import * as anchor from '@coral-xyz/anchor';
import { BN } from "bn.js";
import { buildAndDeploy, idlFor } from './src/utils/solanaDeploy';
import dotenv from 'dotenv';
import multer from 'multer';

const PORT = 3000;

dotenv.config();
const upload = multer();

interface Deal {
  dealId: string;
  agentFee: number;
  paymentMethod: string;
  contractAddress?: string;
  validated?: boolean;
  txHash?: string;
}
const dealsMap = new Map<string, Deal>();

const app = express();
app.use(express.json());
const connection = new Connection(clusterApiUrl('devnet'));

app.post('/api/purchase-request', (req: Request, res: Response) => {
  const agentFee = 10.00;
  const dealId = uuidv4();
  const paymentMethod = 'eLTD';
  const deal: Deal = { dealId, agentFee, paymentMethod };
  dealsMap.set(dealId, deal);
  console.log('[purchase-request] deal saved:', deal);
  res.json(deal);
});

async function handleApi(dealId: string, agentFee: number): Promise<string> {
  const raw = process.env.USER_SECRET_KEY;
  if (!raw) throw new Error('USER_SECRET_KEY не задан в .env');
  const secretKey = Uint8Array.from(JSON.parse(raw));
  const walletKeypair = Keypair.fromSecretKey(secretKey);

  const programId = buildAndDeploy();

  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const idl = idlFor(programId);
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(dealId),
  });
  const tx = new Transaction().add(memoIx);
  await connection.sendTransaction(tx, [walletKeypair], { skipPreflight: true });

  return programId;
}

app.post('/api/generate-smart-contract', upload.none(), async (req: Request, res: Response) => {
  const { dealId, agentFee } = req.body;
  if (!dealId || !agentFee) {
    return res.status(400).json({ error: 'dealId и agentFee обязательны' });
  }
  const deal = dealsMap.get(dealId);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  if (Number(agentFee) !== Number(deal.agentFee)) {
    return res.status(400).json({ error: 'agentFee does not match original value' });
  }
  try {
    const contractAddress = await handleApi(dealId, agentFee);
    deal.contractAddress = contractAddress;
    dealsMap.set(dealId, deal);
    console.log('[generate-smart-contract] deal updated:', deal);
    res.json({ contractAddress });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

const verifySignature = (signature: string, dealId: string): boolean => {
   return signature === "validSignature";
};

const verifyDocumentsManually = (documents: string[]): boolean => {
   return documents.length > 0;
};

app.post("/api/validate-delivery", upload.none(), async (req: Request, res: Response) => {
  console.log(req.body)
   const { dealId, documents, signature } = req.body;
   const deal = dealsMap.get(dealId);
   console.log(deal)
   if (!deal) return res.status(404).json({ error: 'Deal not found' });
   try {
      const isSignatureValid = verifySignature(signature, dealId);
      const areDocumentsValid = verifyDocumentsManually(documents);
      if (isSignatureValid && areDocumentsValid) {
         deal.validated = true;
         dealsMap.set(dealId, deal);
         console.log('[validate-delivery] deal validated:', deal);
         res.json({ valid: true, dealId });
      } else {
         res.status(400).json({ valid: false, error: "Invalid documents or signature." });
      }
   } catch (error) {
      res.status(500).json({ valid: false, error: "Internal server error" });
   }
});

app.post('/api/send-payment', upload.none(), async (req: Request, res: Response) => {
  const { dealId, contractAddress, total } = req.body;
  const deal = dealsMap.get(dealId);
  if (!deal) return res.status(404).json({ success: false, error: 'Deal not found' });
  if (!deal.validated) return res.status(400).json({ success: false, error: 'Deal not validated' });
  if (deal.contractAddress !== contractAddress) return res.status(400).json({ success: false, error: 'Contract address mismatch' });
  if (Number(total) !== Number(deal.agentFee)) return res.status(400).json({ success: false, error: 'Total does not match agentFee' });

  try {
    
    const validationResponse = await fetch(`http://localhost:3000/api/validate-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealId, documents: [123,123], signature: 'validSignature' })
    });
    const validationResult = await validationResponse.json();
    if (!validationResult.valid) {
      return res.status(400).json({ success: false, error: 'Validation failed.' });
    }
    
    const signature = await distributeTokens(dealId, total, contractAddress);
    deal.txHash = signature;
    dealsMap.set(dealId, deal);
    console.log('[send-payment] deal txHash updated:', deal);
    res.json({ success: true, signature });
  } catch (err) {
    console.error('Error:', (err as Error).message);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});


async function distributeTokens(dealId: string, totalAmount: number, contractAddress: string): Promise<string> {
  const raw = process.env.USER_SECRET_KEY;
  if (!raw) throw new Error('USER_SECRET_KEY не задан в .env');
  const secretKey = Uint8Array.from(JSON.parse(raw));
  const walletKeypair = Keypair.fromSecretKey(secretKey);
  const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);
  
  const idl = idlFor(contractAddress);
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const MINT = new PublicKey('2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft');
  const DECIMALS = 3;
  const recipients = [
    new PublicKey('7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3'),
    new PublicKey('98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd'),
    new PublicKey('5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3'),
  ];
  const senderAta = await import('@solana/spl-token').then(m => m.getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    MINT,
    walletKeypair.publicKey
  ));
  const recipientAtas = await Promise.all(
    recipients.map(owner => import('@solana/spl-token').then(m => m.getOrCreateAssociatedTokenAccount(
      connection,
      walletKeypair,
      MINT,
      owner
    )))
  );
  const senderTokenAccount = senderAta.address;
  const recipientTokenAccounts = recipientAtas.map(ata => ata.address);
  const totalAmountInLamports = totalAmount * 10 ** DECIMALS;

  
  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(dealId),
  });

  
  const ix = await program.methods
    .distribute(new BN(totalAmountInLamports))
    .accounts({
      sender: walletKeypair.publicKey,
      senderTokenAccount,
      mint: MINT,
      recipient1Owner: recipients[0],
      recipient1TokenAccount: recipientTokenAccounts[0],
      recipient2Owner: recipients[1],
      recipient2TokenAccount: recipientTokenAccounts[1],
      recipient3Owner: recipients[2],
      recipient3TokenAccount: recipientTokenAccounts[2],
      tokenProgram: (await import('@solana/spl-token')).TOKEN_PROGRAM_ID,
    })
    .instruction();

  
  const tx = new Transaction().add(memoIx, ix);
  const signature = await connection.sendTransaction(tx, [walletKeypair], { skipPreflight: true });
  return signature;
}


app.get('/api/tx-status', upload.none(), async (req: Request, res: Response) => {
  const { dealId } = req.query;
  if (!dealId || typeof dealId !== 'string') {
    return res.status(400).json({ error: 'dealId is required' });
  }
  const deal = dealsMap.get(dealId);
  if (!deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }
  res.json({
    txHash: deal.txHash,
    status: deal.txHash ? 'confirmed' : 'pending',
    explorerUrl: deal.txHash ? `https://explorer.solana.com/tx/${deal.txHash}?cluster=devnet` : undefined
  });
});

app.listen(PORT, () => {
  console.log(`Electrodo API running on port ${PORT}`);
});
