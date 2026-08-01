// app/job/feed.xml/route.js
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.API_BASE || '';

export async function GET() {
  try {
    const res = await fetch(`${API_BASE}/jobs/feed.xml`, {
      // Revalidate at the Next.js layer every hour as well; the backend
      // itself also sets a 1-hour Cache-Control header.
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      throw new Error(`Upstream feed responded with ${res.status}`);
    }

    const xml = await res.text();

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=1800',
      },
    });
  } catch (e) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>OpinionPlus Jobs Board</title>
    <link>https://opinionplus.online/job</link>
    <description>Feed temporarily unavailable</description>
  </channel>
</rss>`;
    return new Response(fallback, {
      status: 502,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  }
}
