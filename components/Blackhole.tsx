export default function Blackhole() {
  return (
    <div style={{
      position: 'fixed',
      right: '-60px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '420px',
      height: '420px',
      pointerEvents: 'none',
      zIndex: 1,
      perspective: '600px',
    }}>
      {/* Halo */}
      <div style={{
        position: 'absolute',
        inset: '-30px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 50%, transparent 30%, #2d0a5e18 45%, #4a1090cc 52%, #6C63FF55 58%, #9b59b633 65%, transparent 78%)',
        animation: 'haloPulse 4s ease-in-out infinite',
      }} />

      {/* Jets */}
      <div style={{
        position: 'absolute', left: '50%', top: '10px',
        width: '4px', height: '120px', marginLeft: '-2px',
        borderRadius: '2px',
        background: 'linear-gradient(to top, #9933ffcc, #6611aaaa, #33006655, transparent)',
        filter: 'blur(1.5px)',
        animation: 'breathe 3s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', left: '50%', bottom: '10px',
        width: '4px', height: '120px', marginLeft: '-2px',
        borderRadius: '2px',
        background: 'linear-gradient(to bottom, #9933ffcc, #6611aaaa, #33006655, transparent)',
        filter: 'blur(1.5px)',
        animation: 'breathe 3s ease-in-out infinite',
        animationDelay: '0.5s',
      }} />

      {/* Disk wrapper */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: '320px', height: '320px', borderRadius: '50%', position: 'relative', transform: 'rotateX(75deg)' }}>
          <div style={{
            position: 'absolute', inset: '12px',
            borderRadius: '50%', border: '8px solid transparent',
            boxShadow: '0 0 0 1px #7733aa33, 0 0 14px 6px #55118822, 0 0 30px 14px #33006611',
            animation: 'diskCw 24s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '38px',
            borderRadius: '50%', border: '14px solid transparent',
            boxShadow: '0 0 0 1px #9955cc88, 0 0 10px 5px #6633aa55, 0 0 24px 10px #44118833',
            animation: 'diskCcw 16s linear infinite',
          }} />
          <div style={{
            position: 'absolute', inset: '60px',
            borderRadius: '50%', border: '22px solid transparent',
            boxShadow: '0 0 0 1px #cc88ff, 0 0 8px 4px #aa55ff, 0 0 20px 8px #7733cc88, 0 0 40px 16px #5511aa44',
            animation: 'diskCw 10s linear infinite',
          }} />
        </div>
      </div>

      {/* Photon ring */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: '160px', height: '160px',
        marginLeft: '-80px', marginTop: '-80px',
        borderRadius: '50%',
        border: '2px solid #cc88ffaa',
        boxShadow: '0 0 6px 3px #aa55ff88, 0 0 14px 6px #8833cc44, inset 0 0 6px 2px #aa55ff33',
        animation: 'breathe 3.5s ease-in-out infinite',
      }} />

      {/* Event horizon */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        width: '138px', height: '138px',
        marginLeft: '-69px', marginTop: '-69px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 38%, #0a0015 0%, #000 50%)',
        boxShadow: '0 0 0 3px #1a0030, 0 0 24px 12px #000, inset 0 0 20px 8px #000',
        zIndex: 3,
      }} />
    </div>
  )
}