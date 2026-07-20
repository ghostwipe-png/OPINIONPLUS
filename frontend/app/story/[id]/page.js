import { notFound } from 'next/navigation';
import StoryClientView from './StoryClientView';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://opinionplus.opinionplus.workers.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://opinionplus.online';

// ⚡ 1. Dynamic OpenGraph Metadata Generation
export async function generateMetadata({ params }) {
  const { id } = params;
  
  try {
    const res = await fetch(`${API_BASE}/stories/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return { title: 'Story Not Found | OpinionPlus' };
    
    const data = await res.json();
    const story = data.story;

    const title = story.title;
    // Strip HTML from the body to create a clean text summary for Twitter/WhatsApp
    const rawBody = story.body?.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() || '';
    const description = story.excerpt || `${rawBody.substring(0, 150)}...`;
    
    // Use the story image, or fall back to the default image we added in Step 1
    const image = story.cover_image || story.coverImage || `${SITE_URL}/default-og-image.jpg`;
    const storyUrl = `${SITE_URL}/story/${id}`;

    return {
      title: `${title} | OpinionPlus`,
      description,
      openGraph: {
        title,
        description,
        url: storyUrl,
        siteName: 'OpinionPlus',
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        type: 'article',
        publishedTime: story.created_at || story.createdAt || new Date().toISOString(),
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
    };
  } catch (e) {
    return { title: 'OpinionPlus Story' };
  }
}

// ⚡ 2. Server Page Component with JSON-LD Structured Data
export default async function StoryPage({ params }) {
  const { id } = params;

  let story = null;
  try {
    // Fetch the story data on the server
    const res = await fetch(`${API_BASE}/stories/${id}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      story = data.story;
    }
  } catch (e) {
    // Handled below
  }
  
  if (!story) {
    notFound();
  }

  const image = story.cover_image || story.coverImage || `${SITE_URL}/default-og-image.jpg`;

  // Build the Schema.org JSON-LD object for Google News & Search optimization
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: story.title,
    image: [image],
    datePublished: story.created_at || story.createdAt || new Date().toISOString(),
    dateModified: story.updated_at || story.updatedAt || story.created_at || story.createdAt || new Date().toISOString(),
    author: [{
      '@type': 'Person',
      name: 'OpinionPlus Publisher',
      url: `${SITE_URL}/profile/${story.author_id || story.authorId}`
    }],
    publisher: {
      '@type': 'Organization',
      name: 'OpinionPlus',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png` // Ensure you have a logo.png in your frontend/public folder!
      }
    }
  };

  return (
    <>
      {/* Inject the Structured Data into the DOM secretly for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Render the interactive client UI */}
      <StoryClientView />
    </>
  );
}