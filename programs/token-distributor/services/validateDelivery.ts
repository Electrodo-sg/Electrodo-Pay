import express, { Request, Response } from "express";
import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
   TOKEN_PROGRAM_ID,
   getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import idl from "../../../target/idl/token_distributor.json";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const RPC_URL = "https://api.devnet.solana.com";
const MINT = new PublicKey("2tNDVDpihMuGudCavJPjy5XPbpx6Zr3HgXsmMBhTd3Ft");
const payerKeypair = Keypair.fromSecretKey(
   Uint8Array.from(JSON.parse(process.env.USER_SECRET_KEY!))
);
const DECIMALS = 3;
const EXPRESS_PORT = 3000;

const verifySignature = (signature: string, dealId: string): boolean => {
   return signature === "validSignature";
};

const verifyDocumentsManually = (documents: string[]): boolean => {
   return documents.length > 0;
};

app.post("/api/validate-delivery", async (req: Request<{}, {}, { dealId: string; documents: string[]; signature: string }>, res: Response<{ valid: boolean; dealId?: string; error?: string }>) => {
   const { dealId, documents, signature } = req.body;

   try {
      const isSignatureValid = verifySignature(signature, dealId);
      const areDocumentsValid = verifyDocumentsManually(documents);

      if (isSignatureValid && areDocumentsValid) {
         res.json({ valid: true, dealId });
      } else {
         res.status(400).json({ valid: false, error: "Invalid documents or signature." });
      }
   } catch (error) {
      res.status(500).json({ valid: false, error: "Internal server error" });
   }
});

async function distributeTokens(dealId: string, totalAmount: number) {
   const connection = new Connection(RPC_URL, "confirmed");
   const wallet = new anchor.Wallet(payerKeypair);
   const provider = new anchor.AnchorProvider(connection, wallet, {});
   anchor.setProvider(provider);

   const program = new anchor.Program(idl as anchor.Idl, provider);

   const senderAta = await getOrCreateAssociatedTokenAccount(
      connection,
      payerKeypair,
      MINT,
      payerKeypair.publicKey
   );

   const recipients = [
      new PublicKey("7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3"),
      new PublicKey("98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd"),
      new PublicKey("5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3"),
   ];

   const recipientAtas = await Promise.all(
      recipients.map((owner) =>
         getOrCreateAssociatedTokenAccount(connection, payerKeypair, MINT, owner)
      )
   );

   const senderTokenAccount = senderAta.address;
   const recipientTokenAccounts = recipientAtas.map((ata) => ata.address);

   const totalAmountInLamports = totalAmount * 10 ** DECIMALS;

   const tx = await program.methods
      .distribute(new BN(totalAmountInLamports))
      .accounts({
         sender: payerKeypair.publicKey,
         senderTokenAccount,
         mint: MINT,
         recipient1Owner: recipients[0],
         recipient1TokenAccount: recipientTokenAccounts[0],
         recipient2Owner: recipients[1],
         recipient2TokenAccount: recipientTokenAccounts[1],
         recipient3Owner: recipients[2],
         recipient3TokenAccount: recipientTokenAccounts[2],
         tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([payerKeypair])
      .rpc();

   console.log(`Transaction successful! Signature: ${tx}\n`);
   return tx;
}

app.post("/api/send-payment", async (req: Request<{}, {}, { dealId: string, total: number, contractAddress: string }>, res: Response<{ success: boolean, signature?: string, error?: string }>) => {
   const { dealId, total, contractAddress } = req.body;

   try {
      const validationResponse = await fetch(`http://localhost:${EXPRESS_PORT}/api/validate-delivery`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ dealId, documents: [], signature: "validSignature" })
      });

      const validationResult = await validationResponse.json();
      if (validationResult.valid) {
         const signature = await distributeTokens(dealId, total);
         res.json({ success: true, signature });
      } else {
         res.status(400).json({ success: false, error: "Validation failed." });
      }
   } catch (err) {
      console.error("Error:", (err as Error).message);
      res.status(500).json({ success: false, error: (err as Error).message });
   }
});


app.listen(EXPRESS_PORT, () => {
   console.log(`Server running at http://localhost:${EXPRESS_PORT}`);
});
