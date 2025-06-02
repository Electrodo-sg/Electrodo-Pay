import express from "express";
import dotenv from "dotenv";
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { writeFileSync, readFileSync } from "node:fs";
import { MEMO_PROGRAM_ID } from "@solana/spl-memo";
import { buildAndDeploy, idlFor } from "./utils/anchorDeploy";

dotenv.config();
const app = express();
app.use(express.json());

const RPC_URL = "https://api.devnet.solana.com";
const WALLET = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.USER_SECRET_KEY!)));
const RECIPIENTS = [
  new PublicKey("7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3"),
  new PublicKey("98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd"),
  new PublicKey("5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3")
];

app.post("/api/generate-smart-contract", async (req, res) => {
  const { dealId, agentFee } = req.body;

  try {
    const programId = buildAndDeploy();
    const connection = new Connection(RPC_URL, "confirmed");
    const wallet = new anchor.Wallet(WALLET);
    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);
    const idl = idlFor(programId);
    const program = new anchor.Program(idl as anchor.Idl, provider);

    const memoIx = new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(dealId)
    });
    const tx = new Transaction().add(memoIx);
    await connection.sendTransaction(tx, [WALLET], { skipPreflight: true });

    const mock = {
      dealId,
      agentFee,
      recipients: RECIPIENTS.map(r => r.toBase58()),
      contractAddress: programId,
      memo: dealId
    };
    writeFileSync("deals-mock.json", JSON.stringify(mock, null, 2));
    res.json({ contractAddress: programId });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.listen(3000, () => console.log("API running on :3000"));
