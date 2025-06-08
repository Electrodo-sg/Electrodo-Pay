export interface TxRecord {
  txHash: string;
  dealId: string;
  timestamp: number;
}

const txStorage = new Map<string, TxRecord>();

export function saveTransaction(record: TxRecord) {
  txStorage.set(record.dealId, record);
}

export function getTransactionByDealId(dealId: string): TxRecord | undefined {
  return txStorage.get(dealId);
}
