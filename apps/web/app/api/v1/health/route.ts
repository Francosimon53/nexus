import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nexus-web',
    version: '0.0.1',
    timestamp: new Date().toISOString(),
  });
}
