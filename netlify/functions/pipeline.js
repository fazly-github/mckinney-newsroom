// pipeline.js - Full automated pipeline: Research → Generate → Media → Publish
const API_BASE = 'https://api.anthropic.com/v1/messages';

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  const IG_USER_ID = process.env.INSTAGRAM_USER_ID;

  try {
    const body = JSON.parse(event.body);
    const { action, story, category, tone, location, platforms, scheduleTime } = body;

    // ACTION: research - fetch & enrich a story
    if (action === 'research') {
      const result = await researchStory(story, ANTHROPIC_KEY);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ACTION: generate - create all content formats
    if (action === 'generate') {
      const result = await generateContent(story, category, tone, location, ANTHROPIC_KEY);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ACTION: extract_media - get OG image from article URL
    if (action === 'extract_media') {
      const result = await extractMedia(body.url);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ACTION: generate_image - create AI image prompt for story
    if (action === 'generate_image') {
      const result = await generateImagePrompt(story, ANTHROPIC_KEY);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ACTION: publish - post to selected platforms
    if (action === 'publish') {
      const result = await publishContent(body, FB_TOKEN, FB_PAGE_ID, IG_USER_ID);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // ACTION: run_pipeline - full auto pipeline
    if (action === 'run_pipeline') {
      const result = await runFullPipeline(body, ANTHROPIC_KEY, FB_TOKEN, FB_PAGE_ID, IG_USER_ID);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, stack: err.stack }) };
  }
};

// ── RESEARCH ──────────────────────────────────────────────────────────────
async function researchStory(storyText, apiKey) {
  if (!apiKey) return { researched: false, summary: storyText, keyFacts: [] };
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are a local news researcher. Given this raw story tip about McKinney, TX, extract and organize the key facts.

Story tip: ${storyText}

Respond in JSON:
{
  "headline": "Clear news headline",
  "summary": "2-sentence summary",
  "keyFacts": ["fact 1", "fact 2", "fact 3"],
  "suggestedCategory": "one of: New opening, Local event, Crime & safety, City government, Development, Schools, Sports, Community, Business news",
  "suggestedTone": "one of: Friendly & conversational, Professional & neutral, Energetic & exciting, Serious & informative",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#McKinneyTX", "#McKinneyNow"]
}`
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.[0]?.text || '{}';
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return { researched: true, ...JSON.parse(jsonMatch[0]) };
  } catch { return { researched: false, summary: storyText, keyFacts: [] }; }
}

// ── GENERATE CONTENT ──────────────────────────────────────────────────────
async function generateContent(story, category, tone, location, apiKey) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const prompt = `You are a local news content creator for "${location || 'McKinney, TX'}". Category: ${category || 'Local news'}. Tone: ${tone || 'Friendly & conversational'}.

STORY:
${story}

Create all 5 content formats. Use EXACTLY this structure:

## Facebook Post
[150-200 word Facebook post with 3-5 hashtags and call to action]

---

## Reel Script
[45-60 second video script with [HOOK], [MAIN CONTENT], [CTA] labels]

---

## Instagram Caption
[100-150 word caption with 8-10 hashtags and emojis]

---

## Newsletter Blurb
[3-4 professional sentences for community newsletter]

---

## Website Article
[Headline on first line, then "By McKinney Now Staff", then 4 paragraphs]`;

  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-5', max_tokens: 2500, messages: [{ role: 'user', content: prompt }] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  let text = data.content[0].text.replace(/^```[\w]*\n?/m, '').replace(/\n?```$/m, '').trim();
  return { success: true, rawContent: text, sections: parseSections(text) };
}

function parseSections(text) {
  const keys = ['Facebook Post', 'Reel Script', 'Instagram Caption', 'Newsletter Blurb', 'Website Article'];
  const out = {};
  keys.forEach(key => {
    const re = new RegExp('##\\s*' + key, 'i');
    const m = text.match(re);
    if (!m) return;
    const rest = text.slice(m.index + m[0].length);
    const end = rest.match(/\n---\n|\n## /);
    out[key] = (end ? rest.slice(0, end.index) : rest).trim();
  });
  return out;
}

// ── MEDIA EXTRACTION ───────────────────────────────────────────────────────
async function extractMedia(url) {
  if (!url || !url.startsWith('http')) return { found: false, images: [] };
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; McKinneyNewsBot/1.0)' },
      signal: AbortSignal.timeout(8000)
    });
    const html = await res.text();
    const images = [];

    // OG image (best quality)
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogMatch) images.push({ type: 'og_image', url: ogMatch[1] || ogMatch[2], label: 'Article Image' });

    // Twitter card image
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (twMatch) images.push({ type: 'twitter_image', url: twMatch[1], label: 'Twitter Card Image' });

    // First large img tag
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp))["'][^>]*(?:width=["']([0-9]+)["'])?/gi);
    for (const m of imgMatches) {
      const w = parseInt(m[2] || '0');
      if (w >= 400 || !m[2]) {
        images.push({ type: 'article_img', url: m[1], label: 'Article Photo' });
        if (images.length >= 3) break;
      }
    }

    // Page title for context
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    return { found: images.length > 0, images: images.slice(0, 3), pageTitle: titleMatch ? titleMatch[1] : '' };
  } catch (err) {
    return { found: false, images: [], error: err.message };
  }
}

// ── AI IMAGE PROMPT ─────────────────────────────────────────────────────────
async function generateImagePrompt(story, apiKey) {
  if (!apiKey) return { prompt: 'McKinney Texas local news photo, community scene' };
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Create a short image generation prompt (under 50 words) for this McKinney TX news story. Make it photorealistic, suitable for a local news post. No text overlays. Story: ${story.substring(0, 300)}`
      }]
    })
  });
  const data = await res.json();
  return { prompt: data.content?.[0]?.text?.trim() || 'McKinney Texas local news, community photo, photorealistic' };
}

// ── PUBLISH ─────────────────────────────────────────────────────────────────
async function publishContent(body, fbToken, fbPageId, igUserId) {
  const results = { facebook_post: null, facebook_reel: null, instagram_post: null, instagram_reel: null };
  const { sections, imageUrl, videoUrl, platforms } = body;
  const errors = [];

  // Facebook Post
  if (platforms.includes('facebook_post') && fbToken && fbPageId) {
    try {
      const caption = sections['Facebook Post'] || sections['Newsletter Blurb'] || '';
      const params = new URLSearchParams({ message: caption, access_token: fbToken });
      if (imageUrl) params.append('url', imageUrl);
      const endpoint = imageUrl ? `https://graph.facebook.com/v19.0/${fbPageId}/photos` : `https://graph.facebook.com/v19.0/${fbPageId}/feed`;
      const r = await fetch(endpoint, { method: 'POST', body: params });
      const d = await r.json();
      results.facebook_post = d.error ? { error: d.error.message } : { success: true, id: d.id || d.post_id };
    } catch (e) { errors.push('FB Post: ' + e.message); }
  }

  // Instagram Post
  if (platforms.includes('instagram_post') && fbToken && igUserId && imageUrl) {
    try {
      const caption = sections['Instagram Caption'] || '';
      // Step 1: create container
      const r1 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        body: new URLSearchParams({ image_url: imageUrl, caption, access_token: fbToken })
      });
      const d1 = await r1.json();
      if (d1.id) {
        // Step 2: publish
        const r2 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
          method: 'POST',
          body: new URLSearchParams({ creation_id: d1.id, access_token: fbToken })
        });
        const d2 = await r2.json();
        results.instagram_post = d2.error ? { error: d2.error.message } : { success: true, id: d2.id };
      } else { results.instagram_post = { error: d1.error?.message || 'Container creation failed' }; }
    } catch (e) { errors.push('IG Post: ' + e.message); }
  }

  // Facebook Reel
  if (platforms.includes('facebook_reel') && fbToken && fbPageId && videoUrl) {
    try {
      const desc = sections['Reel Script'] || '';
      const r = await fetch(`https://graph.facebook.com/v19.0/${fbPageId}/video_reels`, {
        method: 'POST',
        body: new URLSearchParams({ upload_phase: 'start', access_token: fbToken })
      });
      const d = await r.json();
      results.facebook_reel = d.error ? { error: d.error.message } : { success: true, note: 'Reel upload initiated', video_id: d.video_id };
    } catch (e) { errors.push('FB Reel: ' + e.message); }
  }

  // Instagram Reel
  if (platforms.includes('instagram_reel') && fbToken && igUserId && videoUrl) {
    try {
      const caption = sections['Reel Script'] || '';
      const r1 = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
        method: 'POST',
        body: new URLSearchParams({ media_type: 'REELS', video_url: videoUrl, caption, access_token: fbToken })
      });
      const d1 = await r1.json();
      results.instagram_reel = d1.id ? { success: true, container_id: d1.id, note: 'Processing - publish after video processes' } : { error: d1.error?.message };
    } catch (e) { errors.push('IG Reel: ' + e.message); }
  }

  return { published: true, results, errors };
}

// ── FULL AUTO PIPELINE ──────────────────────────────────────────────────────
async function runFullPipeline(body, apiKey, fbToken, fbPageId, igUserId) {
  const log = [];
  const { story, category, tone, location, sourceUrl, platforms } = body;

  log.push({ step: 'research', status: 'running' });
  const researched = await researchStory(story, apiKey);
  log[0].status = 'done';
  log[0].data = researched;

  log.push({ step: 'generate_content', status: 'running' });
  const content = await generateContent(researched.summary || story, category, tone, location, apiKey);
  log[1].status = 'done';

  log.push({ step: 'extract_media', status: 'running' });
  let media = { found: false, images: [] };
  if (sourceUrl) media = await extractMedia(sourceUrl);
  if (!media.found) {
    const imgPrompt = await generateImagePrompt(story, apiKey);
    media = { found: false, images: [], aiPrompt: imgPrompt.prompt, note: 'No image found - use AI generation with prompt below' };
  }
  log[2].status = 'done';
  log[2].data = media;

  const imageUrl = media.images?.[0]?.url || null;

  log.push({ step: 'publish', status: platforms?.length > 0 ? 'running' : 'skipped' });
  let publishResult = null;
  if (platforms?.length > 0 && (fbToken || igUserId)) {
    publishResult = await publishContent({ sections: content.sections, imageUrl, platforms }, fbToken, fbPageId, igUserId);
    log[3].status = 'done';
    log[3].data = publishResult;
  } else {
    log[3].status = 'skipped';
    log[3].note = 'No platforms selected or API tokens not configured';
  }

  return {
    success: true,
    pipeline_log: log,
    researched,
    content: content.sections,
    media,
    published: publishResult
  };
}
