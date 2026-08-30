export default {
  async fetch(request) {
    // Allow CORS from your Next.js app
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let urls = [];
    try {
      const body = await request.json();
      urls = body.urls; // array of stream URL strings, max 20
      if (!Array.isArray(urls) || urls.length === 0) throw new Error();
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    // Check all URLs concurrently with a 6-second timeout each
    const results = await Promise.all(
      urls.map(async (url) => {
        const start = Date.now();
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            redirect: 'follow',
          });
          clearTimeout(timer);
          const latency = Date.now() - start;
          const alive = res.status >= 200 && res.status < 400;
          return { url, status: alive ? 'alive' : 'dead', latency };
        } catch {
          return { url, status: 'dead', latency: Date.now() - start };
        }
      })
    );

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
