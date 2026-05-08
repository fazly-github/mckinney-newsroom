// scheduler.js - Timetable management and scheduled posting queue
// Stores schedule in Netlify Blobs (or returns schedule state for frontend management)

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  try {
    const body = event.httpMethod === 'POST' ? JSON.parse(event.body || '{}') : {};
    const { action } = body;

    // Return the optimal posting schedule
    if (event.httpMethod === 'GET' || action === 'get_schedule') {
      return { statusCode: 200, headers, body: JSON.stringify({ schedule: getOptimalSchedule() }) };
    }

    // Validate a custom schedule entry
    if (action === 'validate') {
      const { time, platform, contentType } = body;
      const valid = isValidScheduleEntry(time, platform, contentType);
      return { statusCode: 200, headers, body: JSON.stringify(valid) };
    }

    // Get posting recommendations based on day/time
    if (action === 'recommendations') {
      const recs = getPostingRecommendations();
      return { statusCode: 200, headers, body: JSON.stringify(recs) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ── OPTIMAL POSTING SCHEDULE ─────────────────────────────────────────────────
// Based on research: best times for Facebook & Instagram for local news pages
function getOptimalSchedule() {
  return {
    version: '1.0',
    timezone: 'America/Chicago',
    description: 'McKinney Now - Optimal social media posting schedule',
    weeklyPlan: [
      {
        day: 'Monday',
        slots: [
          { time: '07:00', platforms: ['facebook_post'], type: 'morning_news', priority: 'high', reason: 'Monday morning commuters checking local news' },
          { time: '12:00', platforms: ['instagram_post', 'facebook_post'], type: 'community', priority: 'medium', reason: 'Lunch break engagement peak' },
          { time: '17:30', platforms: ['instagram_reel', 'facebook_reel'], type: 'reel', priority: 'high', reason: 'After-work scroll time' },
          { time: '20:00', platforms: ['facebook_post'], type: 'feature', priority: 'medium', reason: 'Evening home browsing' }
        ]
      },
      {
        day: 'Tuesday',
        slots: [
          { time: '07:30', platforms: ['facebook_post', 'instagram_post'], type: 'morning_news', priority: 'high', reason: 'Peak morning news consumption' },
          { time: '11:00', platforms: ['instagram_post'], type: 'community', priority: 'medium', reason: 'Mid-morning engagement' },
          { time: '18:00', platforms: ['instagram_reel', 'facebook_reel'], type: 'reel', priority: 'high', reason: 'Highest reel engagement day' },
          { time: '21:00', platforms: ['instagram_post'], type: 'spotlight', priority: 'low', reason: 'Evening IG browsing' }
        ]
      },
      {
        day: 'Wednesday',
        slots: [
          { time: '07:00', platforms: ['facebook_post'], type: 'morning_news', priority: 'high', reason: 'Midweek news check-in' },
          { time: '12:30', platforms: ['instagram_post', 'facebook_post'], type: 'community', priority: 'high', reason: 'Best overall Wednesday engagement' },
          { time: '17:00', platforms: ['instagram_reel'], type: 'reel', priority: 'high', reason: 'Wednesday reel peak' },
          { time: '19:00', platforms: ['facebook_post'], type: 'feature', priority: 'medium', reason: 'Wednesday prime time' }
        ]
      },
      {
        day: 'Thursday',
        slots: [
          { time: '08:00', platforms: ['facebook_post', 'instagram_post'], type: 'morning_news', priority: 'medium', reason: 'Pre-weekend news browsing starts' },
          { time: '12:00', platforms: ['instagram_post'], type: 'community', priority: 'medium', reason: 'Thursday lunch engagement' },
          { time: '17:30', platforms: ['instagram_reel', 'facebook_reel'], type: 'reel', priority: 'high', reason: 'Thursday is top reel day on Instagram' },
          { time: '20:30', platforms: ['facebook_post'], type: 'feature', priority: 'low', reason: 'Thursday evening browsing' }
        ]
      },
      {
        day: 'Friday',
        slots: [
          { time: '07:00', platforms: ['facebook_post'], type: 'morning_news', priority: 'high', reason: 'Friday morning - weekend preview content' },
          { time: '11:30', platforms: ['instagram_post', 'facebook_post'], type: 'weekend_guide', priority: 'high', reason: 'Weekend events & things-to-do peak' },
          { time: '16:00', platforms: ['instagram_reel', 'facebook_reel'], type: 'reel', priority: 'high', reason: 'Friday afternoon freedom scroll' },
          { time: '20:00', platforms: ['instagram_post'], type: 'community', priority: 'medium', reason: 'Friday night IG check' }
        ]
      },
      {
        day: 'Saturday',
        slots: [
          { time: '09:00', platforms: ['instagram_post', 'facebook_post'], type: 'weekend_news', priority: 'high', reason: 'Saturday morning casual browsing peak' },
          { time: '11:00', platforms: ['instagram_reel'], type: 'reel', priority: 'medium', reason: 'Saturday mid-morning reels' },
          { time: '14:00', platforms: ['facebook_post'], type: 'community', priority: 'medium', reason: 'Afternoon community content' }
        ]
      },
      {
        day: 'Sunday',
        slots: [
          { time: '10:00', platforms: ['facebook_post', 'instagram_post'], type: 'weekend_wrap', priority: 'high', reason: 'Sunday morning - highest Facebook engagement day' },
          { time: '12:00', platforms: ['instagram_post'], type: 'community', priority: 'medium', reason: 'Sunday lunch browsing' },
          { time: '18:00', platforms: ['facebook_post'], type: 'week_preview', priority: 'high', reason: 'Sunday evening - preview coming week' }
        ]
      }
    ],
    contentMix: {
      description: 'Recommended weekly content mix',
      targets: {
        facebook_posts: 14,
        instagram_posts: 10,
        facebook_reels: 5,
        instagram_reels: 7
      },
      categories: {
        breaking_news: '25%',
        community_spotlight: '20%',
        local_events: '20%',
        development_business: '15%',
        weekend_guide: '10%',
        human_interest: '10%'
      }
    },
    bestModels: {
      research: 'claude-opus-4-5',
      content_generation: 'claude-opus-4-5',
      image_prompts: 'claude-opus-4-5',
      quick_captions: 'claude-haiku-4-5'
    }
  };
}

function isValidScheduleEntry(time, platform, contentType) {
  const validPlatforms = ['facebook_post', 'facebook_reel', 'instagram_post', 'instagram_reel'];
  const validTypes = ['morning_news', 'community', 'reel', 'feature', 'weekend_guide', 'weekend_news', 'weekend_wrap', 'week_preview', 'spotlight'];
  const timeValid = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  return {
    valid: timeValid && validPlatforms.includes(platform) && validTypes.includes(contentType),
    issues: [
      !timeValid && 'Invalid time format (use HH:MM)',
      !validPlatforms.includes(platform) && 'Invalid platform',
      !validTypes.includes(contentType) && 'Invalid content type'
    ].filter(Boolean)
  };
}

function getPostingRecommendations() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 6=Sat
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const recommendations = [];

  // Best times analysis
  if (hour >= 6 && hour <= 9) recommendations.push({ type: 'morning_news', urgency: 'high', message: 'Peak morning news time! Post breaking news now.' });
  if (hour >= 11 && hour <= 13) recommendations.push({ type: 'community', urgency: 'high', message: 'Lunch break - great for community & feature stories.' });
  if (hour >= 17 && hour <= 19) recommendations.push({ type: 'reel', urgency: 'high', message: 'After-work scroll peak - perfect for Reels!' });
  if (hour >= 19 && hour <= 21) recommendations.push({ type: 'feature', urgency: 'medium', message: 'Evening browsing - good for longer feature posts.' });

  // Day-specific
  if (day === 5) recommendations.push({ type: 'weekend_guide', urgency: 'high', message: 'Friday! Post weekend events & things-to-do content.' });
  if (day === 0) recommendations.push({ type: 'week_preview', urgency: 'high', message: 'Sunday peak! Highest Facebook engagement day of the week.' });
  if (day === 2 || day === 4) recommendations.push({ type: 'reel', urgency: 'medium', message: 'Tue/Thu are top Reel engagement days on Instagram.' });

  return {
    currentTime: now.toISOString(),
    currentDay: dayNames[day],
    currentHour: hour,
    recommendations,
    nextBestTime: getNextBestTime(hour, day)
  };
}

function getNextBestTime(currentHour, currentDay) {
  const slots = [7, 12, 17, 20];
  const next = slots.find(h => h > currentHour);
  if (next) return `Today at ${next}:00 CST`;
  const tomorrow = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][(currentDay + 1) % 7];
  return `Tomorrow (${tomorrow}) at 07:00 CST`;
}
