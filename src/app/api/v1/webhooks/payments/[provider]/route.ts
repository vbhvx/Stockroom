import { NextRequest } from "next/server";
import { PaymentService } from "@/server/services/payment-service";
import { errorResponse, successResponse } from "@/server/errors/response-helper";

export async function POST(
  req: NextRequest,
  { params }: { params: { provider: string } }
) {
  try {
    const provider = params.provider;
    const rawPayload = await req.text();
    const signature =
      req.headers.get("x-provider-signature") ||
      req.headers.get("stripe-signature") ||
      "";

    const result = await PaymentService.processWebhook(provider, rawPayload, signature);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error, req);
  }
}

