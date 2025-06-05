import { execSync } from "node:child_process"
import os from "node:os"
import dotenv from "dotenv"
import express, { Request, Response, NextFunction } from "express"
import * as anchor from "@coral-xyz/anchor"
import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import { MEMO_PROGRAM_ID } from "@solana/spl-memo"
import { writeFileSync } from "node:fs"
import { buildAndDeploy, idlFor } from "./utils/solanaDeploy"

dotenv.config()

const RPC_URL = "https://api.devnet.solana.com/"
const RECIPIENTS = [
  new PublicKey("7zg2p5V54gDAuj5VFwrcShLtjE5Wto4YWSxxWWyb1kV3"),
  new PublicKey("98LopLC8qpE4h5xqp2BXkqEhDRJyHJYe4pdnPxUbtTvd"),
  new PublicKey("5E5Euf5fxfgq8ELAJSbZ9rhL7kkAmd5rwYvJgvueDUk3")
]

function openBrowser(url: string) {
  try {
    const platform = os.platform()
    if (platform === "win32") {
      execSync(`start "" "${url}"`, { shell: "cmd.exe" })
    } else if (platform === "darwin") {
      execSync(`open "${url}"`)
    } else {
      execSync(`xdg-open "${url}"`)
    }
  } catch {
  }
}

async function deployCli() {
  const programId = buildAndDeploy()
  console.log(JSON.stringify({ contractAddress: programId }))
  openBrowser(`https://explorer.solana.com/address/${programId}?cluster=devnet`)
}

async function handleApi(dealId: string, agentFee: number): Promise<string> {
  const raw = process.env.USER_SECRET_KEY
  if (!raw) throw new Error("USER_SECRET_KEY не задан в .env")
  const secretKey = Uint8Array.from(JSON.parse(raw))
  const walletKeypair = Keypair.fromSecretKey(secretKey)

  const programId = buildAndDeploy()
  const connection = new Connection(RPC_URL, "confirmed")
  const wallet = new anchor.Wallet(walletKeypair)
  const provider = new anchor.AnchorProvider(connection, wallet, {})
  anchor.setProvider(provider)

  const idl = idlFor(programId)
  const program = new anchor.Program(idl as anchor.Idl, provider)

  const memoIx = new TransactionInstruction({
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(dealId),
  })
  const tx = new Transaction().add(memoIx)
  await connection.sendTransaction(tx, [walletKeypair], { skipPreflight: true })

  const mock = {
    dealId,
    agentFee,
    recipients: RECIPIENTS.map((r) => r.toBase58()),
    contractAddress: programId,
    memo: dealId,
  }
  writeFileSync("deals-mock.json", JSON.stringify(mock, null, 2))
  return programId
}

if (process.argv.length === 2) {
  deployCli().catch((err) => {
    console.error(err.message)
    process.exit(1)
  })
} else {
  const app = express()
  app.use(express.json())

  app.post(
    "/api/generate-smart-contract",
    async (req: Request, res: Response, next: NextFunction) => {
      const { dealId, agentFee } = req.body
      if (typeof dealId !== "string" || typeof agentFee !== "number") {
        res.status(400).json({ error: "Нужны dealId (string) и agentFee (number)" })
        return
      }
      try {
        const id = await handleApi(dealId, agentFee)
        res.json({ contractAddress: id })
      } catch (e) {
        res.status(500).json({ error: (e as Error).message })
      }
    }
  )

  app.listen(3000, () => console.log("API running on :3000"))
}