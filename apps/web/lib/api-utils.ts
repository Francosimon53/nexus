import { NextResponse } from 'next/server';
import { NexusError } from '@nexus-protocol/shared';
import { ZodError } from 'zod';

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function errorResponse(err: unknown) {
  if (err instanceof NexusError) {
    return NextResponse.json(err.toJSON(), { status: err.statusCode });
  }

  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: err.flatten() } },
      { status: 400 },
    );
  }

  console.error('Unhandled error:', err);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
    { status: 500 },
  );
}
