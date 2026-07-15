export const metadata = { title: 'About — OPINIONPLUS' };

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-16">
      <p className="wire-tag mb-3">About</p>
      <h1 className="editorial-h text-4xl font-bold mb-8">Every voice deserves a masthead.</h1>

      <div className="prose-story text-ink-700 text-[1.05rem]">
        <p>
          Most platforms ask you to shrink your story to fit a feed. OpinionPlus starts from the
          opposite instinct: your name goes at the top, your logo sits beside it, and the page
          belongs to you before it belongs to an algorithm.
        </p>
        <p>
          We built OpinionPlus for the journalist without a masthead, the filmmaker without a
          distributor, and the person who simply has something true to say and nowhere that feels
          like theirs to say it. A story here isn&apos;t a post lost in a scroll — it&apos;s a
          publication with your byline, your archive, and readers who chose to follow you
          specifically.
        </p>
        <p>
          That&apos;s the whole idea, really. Give people the tools a real publisher would have
          — logo, profile, engagement, an audience — and get out of the way. The stories are
          yours. We just built the newsroom.
        </p>
        <p>
          OpinionPlus is moderated, not policed. Admins exist to handle abuse and false reports,
          not to referee opinions. If your story is true and it&apos;s yours, it belongs here.
        </p>
      </div>
    </div>
  );
}