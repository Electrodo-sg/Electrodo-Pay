import express, { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

interface PurchaseResponse {
  agentFee: number;
  dealId: string;
  paymentMethod: string;
}

app.post('/api/purchase-request', (req: Request, res: Response<PurchaseResponse>) => {
  const response: PurchaseResponse = {
    agentFee: 150.00,
    dealId: uuidv4(),
    paymentMethod: 'eLTD'
  };

  res.json(response);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
