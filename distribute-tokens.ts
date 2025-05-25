import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import idl from "./target/idl/token_distributor.json";
import express from "express";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

const EXPRESS_PORT = 3000;
const RPC_URL = "https://api.devnet.solana.com";
const MINT = new PublicKey("2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft");
const payerKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(process.env.USER_SECRET_KEY!))
);
const RECIPIENTS = [
  new PublicKey("7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3"),
  new PublicKey("98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd"),
  new PublicKey("5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3"),
];
const DECIMALS = 3;
const TOTAL_AMOUNT = 5;

async function distributeTokens() {
  const connection = new Connection(RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(payerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as anchor.Idl, provider);

  // Create or fetch ATAs
  const senderAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payerKeypair,
    MINT,
    payerKeypair.publicKey
  );
  const recipientAtas = await Promise.all(
    RECIPIENTS.map(owner =>
      getOrCreateAssociatedTokenAccount(connection, payerKeypair, MINT, owner)
    )
  );

  const senderTokenAccount = senderAta.address;
  const recipientTokenAccounts = recipientAtas.map(ata => ata.address);

  const totalAmount = TOTAL_AMOUNT * 10 ** DECIMALS;

  const tx = await program.methods
    .distribute(new BN(totalAmount))
    .accounts({
      sender: payerKeypair.publicKey,
      senderTokenAccount,
      mint: MINT,
      recipient1Owner: RECIPIENTS[0],
      recipient1TokenAccount: recipientTokenAccounts[0],
      recipient2Owner: RECIPIENTS[1],
      recipient2TokenAccount: recipientTokenAccounts[1],
      recipient3Owner: RECIPIENTS[2],
      recipient3TokenAccount: recipientTokenAccounts[2],
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([payerKeypair])
    .rpc();

  console.log(`Transaction successful! Signature: ${tx}\n`);
  return tx;
}

app.post("/api/transfer", async (_req, res) => {
  try {
    const signature = await distributeTokens();
    res.json({ success: true, signature });
  } catch (err) {
    console.error("Error:", (err as Error).message);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

app.listen(EXPRESS_PORT, () => {
  console.log(`Server running at http://localhost:${EXPRESS_PORT}`);
});
