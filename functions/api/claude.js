export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
                                  headers: {
                                    'Access-Control-Allow-Origin': '*',
                                    'Access-Control-Allow-Headers': 'Content-Type',
                                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                                  },
                                });
  }

  const ANTHROPIC_API_KEY = context.env.ANTHROPIC_API_KEY;

  try {
    const body = await context.request.json();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
                                   method: 'POST',
                                   headers: {
                                     'Content-Type': 'application/json',
                                     'x-api-key': ANTHROPIC_API_KEY,
                                     'anthropic-version': '2023-06-01',
                                   },
                                   body: JSON.stringify(body),
                                 });

    const data = await res.json();

    return new Response(JSON.stringify(data), {
                                            status: res.status,
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Access-Control-Allow-Origin': '*',
                                            },
                                          });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
                                            status: 500,
                                            headers: { 'Content-Type': 'application/json' },
                                          });
  }
}
