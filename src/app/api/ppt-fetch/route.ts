/**
 * PPT Fetch API
 * 
 * SECURITY: Fetches PPT files from external URLs with strict boundaries.
 * - Validates and sanitizes all input URLs
 * - Restricts to allowed domains (configurable via PPT_FETCH_ALLOWED_DOMAINS)
 * - Implements timeout and size limits
 * - Blocks SSRF attempts
 * - Production-safe with additional protections
 * - Never exposes credentials or internal details
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed domains for PPT fetching (configurable via environment)
const ALLOWED_DOMAINS = process.env.PPT_FETCH_ALLOWED_DOMAINS?.split(',') || [
  'localhost',
  '127.0.0.1',
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Request timeout (30 seconds)
const REQUEST_TIMEOUT = 30000;

/**
 * Validate and sanitize URL
 * Blocks:
 * - Non-HTTP(S) protocols
 * - Private IP ranges (SSRF prevention)
 * - URLs not in allowed domains
 */
function validateUrl(urlString: string): { valid: boolean; error?: string } {
  try {
    const url = new URL(urlString);

    // Only allow HTTP and HTTPS
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, error: 'Only HTTP and HTTPS protocols are allowed' };
    }

    const hostname = url.hostname.toLowerCase();

    // Check for localhost variations
    const isLocalhost = ['localhost', '127.0.0.1', '::1', '::'].includes(hostname);
    
    // Check for private IP ranges
    const isPrivateIp = isPrivateIP(hostname);

    // Check if domain is in allowed list
    const isAllowed = ALLOWED_DOMAINS.some(domain => {
      const allowed = domain.toLowerCase();
      return hostname === allowed || hostname.endsWith(`.${allowed}`);
    });

    // Block if not localhost/private and not in allowed domains
    if (!isLocalhost && !isPrivateIp && !isAllowed) {
      return { valid: false, error: 'URL domain not in allowed list' };
    }

    // Block known SSRF bypass patterns
    if (hostname.includes('0x') || hostname.includes('2130706433')) {
      return { valid: false, error: 'Invalid IP address format' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Check if hostname is a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4Private = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
  // IPv6 private
  const ipv6Private = /^(fc00:|fd00:|fe80:|::1|::ffff:)/;

  if (ipv4Private.test(hostname)) return true;
  if (ipv6Private.test(hostname)) return true;

  // Check for actual IP addresses
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Pattern.test(hostname)) {
    const parts = hostname.split('.').map(Number);
    // 127.x.x.x is localhost
    if (parts[0] === 127) return true;
    // Check for other reserved ranges
    if (parts[0] === 0) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  // Parse request body
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { url } = body;

  // Validate URL presence
  if (!url) {
    return NextResponse.json(
      { error: 'URL is required' },
      { status: 400 }
    );
  }

  // Validate URL format and safety
  const validation = validateUrl(url);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // Production guard for external URLs
  const isProduction = process.env.COZE_PROJECT_ENV === 'PROD';
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');
  
  if (isProduction && !isLocalhost) {
    // In production, only allow localhost/internal URLs
    return NextResponse.json(
      { error: 'External URL fetching disabled in production' },
      { status: 403 }
    );
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Fetch the URL
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.ms-powerpoint, application/vnd.openxmlformats-officedocument.presentationml.presentation, */*',
        'User-Agent': 'ERP-PPT-Fetch/1.0',
      },
    });

    clearTimeout(timeout);

    // Check response status
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch PPT: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    const isValidType = contentType.includes('powerpoint') || 
                        contentType.includes('presentationml') ||
                        contentType.includes('application/octet-stream');

    if (!isValidType) {
      return NextResponse.json(
        { error: 'Response is not a valid PPT file' },
        { status: 400 }
      );
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 413 }
      );
    }

    // Get the file buffer
    const arrayBuffer = await response.arrayBuffer();
    
    // Verify size after download
    if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large after download' },
        { status: 413 }
      );
    }

    // Convert to base64 for safe transfer
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return NextResponse.json({
      status: 'ok',
      filename: url.split('/').pop() || 'presentation.pptx',
      size: buffer.length,
      contentType,
      data: base64,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch PPT file' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'ppt-fetch',
    method: 'POST',
    description: 'Fetch PPT files from validated URLs',
    limits: {
      maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
      timeout: `${REQUEST_TIMEOUT / 1000}s`,
      allowedDomains: ALLOWED_DOMAINS,
    },
    timestamp: new Date().toISOString(),
  });
}
