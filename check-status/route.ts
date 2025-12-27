import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    
    return NextResponse.json({
      isPaid: false,
      country: 'BR',
      planType: 'free'
    });
  } catch (error: any) {
    console.error('❌ Erro check-status:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
