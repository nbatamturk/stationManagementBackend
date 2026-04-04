import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const API_BASE_URL = (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3050').replace(
  /\/+$/,
  '',
);

const buildTargetUrl = (request: NextRequest, path: string[]) => {
  const normalizedPath = path.map((segment) => encodeURIComponent(segment)).join('/');
  return `${API_BASE_URL}/${normalizedPath}${request.nextUrl.search}`;
};

const buildProxyHeaders = (request: NextRequest) => {
  const headers = new Headers();

  for (const [key, value] of request.headers.entries()) {
    const normalizedKey = key.toLowerCase();

    if (['host', 'connection', 'content-length'].includes(normalizedKey)) {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
};

const proxy = async (request: NextRequest, context: RouteContext) => {
  const { path = [] } = await context.params;
  const targetUrl = buildTargetUrl(request, path);
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  let upstream: Response;

  try {
    upstream = await fetch(targetUrl, {
      method: request.method,
      headers: buildProxyHeaders(request),
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      {
        code: 'UPSTREAM_UNREACHABLE',
        message: `Backend API is unreachable at ${API_BASE_URL}. Check admin-web .env and backend availability.`,
        details: {
          targetUrl,
        },
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();

  for (const headerName of [
    'cache-control',
    'content-disposition',
    'content-length',
    'content-type',
    'etag',
    'last-modified',
    'x-content-type-options',
  ]) {
    const value = upstream.headers.get(headerName);

    if (value) {
      responseHeaders.set(headerName, value);
    }
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
