import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function buildAndDeploy(): string {
  execSync("anchor build", { stdio: "inherit" });
  const out = execSync("anchor deploy --provider.cluster devnet", { encoding: "utf8" });
  const idMatch = out.match(/Program Id: ([1-9A-HJ-NP-Za-km-z]{32,44})/);
  if (!idMatch) throw new Error("Program Id not found");
  return idMatch[1];
}

export function idlFor(programId: string): object {
  const idl = JSON.parse(readFileSync("target/idl/token_distributor.json", "utf8"));
  idl.address = programId;
  return idl;
}