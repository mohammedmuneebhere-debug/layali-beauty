import { NextRequest, NextResponse } from 'next/server';
import { geocodeErrorResponse } from '@/lib/geocode/http';
import { reverseGeocodeNominatimNormalized } from '@/lib/geocode/nominatim';
import { PRODUCTION_REVERSE_PROVIDER } from '@/lib/geocode/provider';
import { clientKeyFromRequest, consumeGeocodeQuota } from '@/lib/geocode/rate-limit';
import { GeocodeError, parseCoordinates, parseLanguage } from '@/lib/geocode/types';

export const runtime = 'nodejs';

/**
 * Production address-assist endpoint.
 * Always Nominatim. Do not wire HERE/Google/SPL here.
 */
export async function POST(req: NextRequest) {
  try {
    if (!consumeGeocodeQuota(`assist:${clientKeyFromRequest(req.headers)}`)) {
      return NextResponse.json(
        { error: 'Too many location lookups. Try again shortly.', code: 'rate_limited' },
        { status: 429 }
      );
    }

    if (PRODUCTION_REVERSE_PROVIDER !== 'nominatim') {
      return NextResponse.json(
        { error: 'Could not look up this location', code: 'provider_error' },
        { status: 502 }
      );
    }

    const body = await req.json();
    const { latitude, longitude } = parseCoordinates(body);
    const language = parseLanguage(body.language, 'en');

    const result = await reverseGeocodeNominatimNormalized(latitude, longitude, language);
    return NextResponse.json({ result });
  } catch (err) {
    if (!(err instanceof GeocodeError) && !(err instanceof SyntaxError)) {
      console.error('Address assist failed');
    }
    return geocodeErrorResponse(err);
  }
}
