exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const query = encodeURIComponent('McKinney TX news');
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' }
    });
    const xml = await res.text();

    function decodeEntities(str) {
      return str
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
        .replace(/&nbsp;/g, ' ');
    }

    function stripTags(str) {
      return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const itemXml = match[1];
      const titleRaw = (itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                        itemXml.match(/<title>(.*?)<\/title>/) || [])[1] || '';
      const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1] || '';
      const pubDate = (itemXml.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
      const sourceRaw = (itemXml.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';
      const descRaw = (itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                       itemXml.match(/<description>(.*?)<\/description>/) || [])[1] || '';

      const title = decodeEntities(titleRaw);
      const source = decodeEntities(sourceRaw);
      // Decode HTML entities first, then strip tags, take first 200 chars
      const description = stripTags(decodeEntities(descRaw)).substring(0, 200);

      if (title) {
        items.push({ title, link, pubDate, source, description });
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ stories: items }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
