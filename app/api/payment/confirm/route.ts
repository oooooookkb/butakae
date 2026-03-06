import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { paymentKey, orderId, amount } = await request.json();

    // Confirm with Toss API
    const tossResponse = await fetch(
      "https://api.tosspayments.com/v1/payments/confirm",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ":").toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentKey, orderId, amount }),
      }
    );

    const tossData = await tossResponse.json();

    if (!tossResponse.ok) {
      return NextResponse.json(
        { error: tossData.message ?? "결제 확인 실패" },
        { status: 400 }
      );
    }

    // Update payment in DB
    const supabase = await createClient();
    await supabase
      .from("payments")
      .update({
        payment_key: paymentKey,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    return NextResponse.json({ success: true, payment: tossData });
  } catch {
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
