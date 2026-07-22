'use client';

export default function EmojiOverlay({ reactions }) {
  if (!reactions || reactions.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes emoji-float {
          0% { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
          10% { transform: translate(-50%, -20px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -120px) scale(1); opacity: 0; }
        }
      `}} />
      {reactions.map((r, i) => {
        // Stagger horizontally based on index to prevent overlap
        const offset = (i % 5) * 40 - 80;
        return (
          <div 
            key={r.id} 
            className="absolute bottom-24 left-1/2 flex flex-col items-center"
            style={{ 
              animation: 'emoji-float 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              marginLeft: `${offset}px`
            }}
          >
            <span className="text-4xl drop-shadow-lg filter">{r.emoji}</span>
            <span className="text-[10px] font-bold text-white/80 bg-black/40 px-1.5 py-0.5 rounded mt-1 backdrop-blur-sm">
              {r.senderName}
            </span>
          </div>
        );
      })}
    </div>
  );
}