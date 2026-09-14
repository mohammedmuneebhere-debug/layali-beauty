import { NextResponse } from 'next/server';
import { GeocodeError } from './types';

export function geocodeErrorResponse(err: unknown) {
  if (err instanceof GeocodeError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid request body', code: 'invalid_json' }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'Could not look up this location', code: 'provider_error' },
    { status: 502 }
  );
}

export function methodNotAllowed() {
  return NextResponse.json({ error: 'Method not allowed', code: 'method_not_allowed' }, { status: 405 });
}
