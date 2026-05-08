import { NextRequest, NextResponse } from 'next/server';
import { FetchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

/** Allowed URL schemes for fetching. */
const ALLOWED_SCHEMES = ['http:', 'https:'];

/** Maximum URL length to prevent abuse. */
const MAX_URL_LENGTH = 2048;

/**
 * Validates that a URL string is safe to fetch:
 *  - Must be a valid http/https URL
 *  - Must not target private/internal network addresses (SSRF protection)
 */
function validateFetchUrl(raw: string): { valid: boolean; error?: string } {
  if (raw.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL exceeds maximum allowed length' };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
    return { valid: false, error: 'Only http and https URLs are allowed' };
  }

  // SSRF protection: block private/internal network hostnames
  const hostname = parsed.hostname.toLowerCase();
  const privatePatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[0-1])\./,
    /^192\.168\./,
    /^0\./,
    /^localhost$/,
    /^::1$/,
    /^fd/,
    /^fe80:/,
    /^\[::1\]$/,
    /^metadata\.google\.internal$/,
    /^169\.254\./,
  ];

  for (const pattern of privatePatterns) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'URLs pointing to internal addresses are not allowed' };
    }
  }

  return { valid: true };
}

/**
 * Fetches and extracts content from a given URL (e.g. for PPT resources).
 * Validates the URL and restricts remote request boundaries.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url: unknown = body.url;

    if (typeof url !== 'string' || !url) {
      return NextResponse.json(
        { error: 'A valid URL string is required' },
        { status: 400 },
      );
    }

    const validation = validateFetchUrl(url);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new FetchClient(config, customHeaders);

    const response = await client.fetch(url);

    if ((response.status_code ?? 500) >= 400) {
      return NextResponse.json(
        { error: `Remote resource returned status ${response.status_code}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      title: response.title,
      filetype: response.filetype,
      content: response.content,
    });
  } catch (error: unknown) {
    console.error('Error fetching PPT:', error);
    return NextResponse.json(
      { error: 'Failed to fetch remote content' },
      { status: 500 },
    );
  }
}
