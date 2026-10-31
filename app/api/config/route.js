import { NextResponse } from 'next/server';

export async function GET() {
  const clarityId =
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ||
    process.env.CLARITY_PROJECT_ID ||
    'z66p3x0k2q';

  return NextResponse.json({
    status: 'success',
    data: {
      clarityId,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }
  });
}

