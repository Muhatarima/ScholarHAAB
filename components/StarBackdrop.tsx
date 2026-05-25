type StarBackdropProps = {
  variant?: 'auth' | 'chat'
}

export default function StarBackdrop({ variant = 'auth' }: StarBackdropProps) {
  const showBlackhole = variant === 'auth'
  const starCount = variant === 'chat' ? 76 : 58

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <style>{`
        @keyframes shaabTwinkle {
          0%, 100% { opacity: 0.1; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.55); }
        }
        @keyframes shaabPulseGlow {
          0%, 100% { box-shadow: 0 0 80px rgba(170,85,255,0.58), inset 0 0 70px rgba(0,0,0,0.9); }
          50% { box-shadow: 0 0 116px rgba(170,85,255,0.88), inset 0 0 78px rgba(0,0,0,0.96); }
        }
        @keyframes shaabDiskCw {
          from { transform: translateY(-50%) rotate(-9deg) rotateX(74deg) rotate(0deg); }
          to { transform: translateY(-50%) rotate(-9deg) rotateX(74deg) rotate(360deg); }
        }
        @keyframes shaabDiskCcw {
          from { transform: translateY(-50%) rotate(10deg) rotateX(74deg) rotate(0deg); }
          to { transform: translateY(-50%) rotate(10deg) rotateX(74deg) rotate(-360deg); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            variant === 'chat'
              ? 'radial-gradient(circle at 78% 14%, rgba(170,85,255,0.16), transparent 30%), radial-gradient(circle at 28% 82%, rgba(204,136,255,0.1), transparent 34%)'
              : 'radial-gradient(circle at 72% 38%, rgba(170,85,255,0.16), transparent 34%)',
        }}
      />

      {Array.from({ length: starCount }).map((_, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            top: `${(index * 37) % 100}%`,
            left: `${(index * 61) % 100}%`,
            width: index % 5 === 0 ? 2 : 1,
            height: index % 5 === 0 ? 2 : 1,
            borderRadius: '50%',
            background: index % 7 === 0 ? '#ffffff' : '#cda8ff',
            opacity: index % 3 === 0 ? 0.82 : 0.32,
            boxShadow: index % 6 === 0 ? '0 0 12px rgba(205,168,255,0.85)' : undefined,
            animation: `shaabTwinkle ${2.4 + (index % 4) * 0.7}s ease-in-out infinite`,
            animationDelay: `${index * 0.08}s`,
          }}
        />
      ))}

      {showBlackhole ? (
        <div
          style={{
            position: 'absolute',
            right: 'max(16px, 9vw)',
            top: '48%',
            width: 320,
            height: 320,
            transform: 'translateY(-50%)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 40,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 42% 42%, rgba(230,200,255,0.96) 0 7%, rgba(170,85,255,0.9) 18%, rgba(65,18,116,0.88) 39%, rgba(0,0,13,0.98) 66%)',
              boxShadow: '0 0 80px rgba(170,85,255,0.72), inset 0 0 70px rgba(0,0,0,0.9)',
              animation: 'shaabPulseGlow 4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '50%',
              height: 120,
              transform: 'translateY(-50%) rotate(-9deg)',
              borderRadius: '50%',
              border: '2px solid rgba(204,136,255,0.48)',
              boxShadow: '0 0 42px rgba(170,85,255,0.35)',
              animation: 'shaabDiskCw 12s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 20,
              right: 20,
              top: '50%',
              height: 86,
              transform: 'translateY(-50%) rotate(10deg)',
              borderRadius: '50%',
              border: '1px solid rgba(119,68,170,0.62)',
              animation: 'shaabDiskCcw 16s linear infinite',
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
