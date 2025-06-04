import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function buildAndDeploy(): string {
  execSync("anchor build", { stdio: "inherit" });
  const out = execSync("solana program deploy target/deploy/token_distributor.so --output json", { encoding: "utf8" });
  const programId = JSON.parse(out).programId;
  if (!programId) throw new Error("Program Id not found");
  return programId;
}

export function idlFor(programId: string): object {
  const idl = JSON.parse(readFileSync("target/idl/token_distributor.json", "utf8"));
  idl.address = programId;
  return idl;
}