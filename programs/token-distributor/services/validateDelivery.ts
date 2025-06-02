import express, { Request, Response } from "express";

interface ValidateRequest {
   dealId: string;
   documents: string[];
   signature: string;
   validatedByUser: boolean;
}

interface ValidationResponse {
   valid: boolean;
   dealId?: string;
   error?: string;
}

interface SendPaymentRequest {
   dealId: string;
   contractAddress: string;
   total: number;
}

interface PaymentResponse {
   sellerAgentAmount: number;
   platformAmount: number;
   treasuryAmount: number;
   dealId: string;
   error?: string;
}

const app = express();
app.use(express.json());

const verifySignature = (signature: string, dealId: string): boolean => {
   if (signature === "validSignature") {
      return true;
   }
   return false;
};

const verifyDocumentsManually = (documents: string[], validatedByUser: boolean): boolean => {
   return validatedByUser;
};

app.post("/api/validate-delivery", async (req: Request<{}, {}, ValidateRequest>, res: Response<ValidationResponse>) => {
   const { dealId, documents, signature, validatedByUser } = req.body;

   try {
      const isSignatureValid = verifySignature(signature, dealId);
      const areDocumentsValid = verifyDocumentsManually(documents, validatedByUser);

      if (isSignatureValid && areDocumentsValid) {
         res.json({ valid: true, dealId });
      } else {
         res.status(400).json({ valid: false, error: "Invalid documents or signature." });
      }
   } catch (error) {
      res.status(500).json({ valid: false, error: "Internal server error" });
   }
});

app.post("/api/send-payment", async (req: Request<{}, {}, SendPaymentRequest>, res: Response<PaymentResponse>) => {
   const { dealId, contractAddress, total } = req.body;

   try {
      const sellerAgentAmount = total * 0.9;
      const platformAmount = total * 0.07;
      const treasuryAmount = total * 0.03;

      res.json({
         dealId,
         sellerAgentAmount,
         platformAmount,
         treasuryAmount,
      });
   } catch (error) {
      res.status(500).json({
         error: "Failed to create payment transaction.",
         dealId,
         sellerAgentAmount: 0,
         platformAmount: 0,
         treasuryAmount: 0
      });
   }
});

app.listen(3000, () => {
   console.log("Server is running on http://localhost:3000");
});
