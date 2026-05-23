const BACKEND_URL = process.env.BACKEND_URL;

async function handler(
  req: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const joined = path.join("/");

  const { searchParams } = new URL(req.url);
  const query = searchParams.toString();

  const target = `${BACKEND_URL}/api/${joined}${query ? `?${query}` : ""}`;

  const res = await fetch(target, {
    method: req.method,
    headers: {
      "content-type": req.headers.get("content-type") || "application/json",
    },
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : await req.text(),
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
