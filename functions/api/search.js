export async function onRequest(context) {
  const RSS_URL = 'https://news.google.com/rss/search?q=McKinney+Texas&hl=en-US&gl=US&ceid=US:en';

    try {
        const res = await fetch(RSS_URL);
            const xml = await res.text();

                const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
                      const get = (tag) => {
                              const match = m[1].match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
                                      return match ? (match[1] || match[2] || '').trim() : '';
                                            };
                                                  return {
                                                          title: get('title'),
                                                                  link: get('link'),
                                                                          description: get('description'),
                                                                                  pubDate: get('pubDate'),
                                                                                          source: get('source'),
                                                                                                };
                                                                                                    });
                                                                                                    
                                                                                                        return new Response(JSON.stringify({ stories: items }), {
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
