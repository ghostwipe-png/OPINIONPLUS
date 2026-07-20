// Shared helper: derive a display category + tag color scheme for a story.
// "news" is inferred from the newsdesk author, mirroring the existing feed filter logic.
export const CATEGORY_COLORS = {
  story: { bg: '#1C1917', text: '#FFFFFF', label: 'Story' },
  documentary: { bg: '#C99A3B', text: '#1C1917', label: 'Documentary' },
  news: { bg: '#E0492B', text: '#FFFFFF', label: 'News' },
  default: { bg: '#6B7180', text: '#FFFFFF', label: 'Opinion' },
};

export function getStoryCategory(story) {
  if (!story) return 'default';
  if (story.authorId === 'u_newsdesk') return 'news';
  if (story.type === 'story' || story.type === 'documentary') return story.type;
  return 'default';
}

export function getCategoryStyle(story) {
  const key = getStoryCategory(story);
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.default;
}