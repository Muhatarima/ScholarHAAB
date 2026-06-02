'use client';

interface DiagramRendererProps {
  hasDiagram: boolean;
  diagramDescription?: string;
  diagramType?: string;
  subject?: string;
  topic?: string;
  source?: string;
}

export default function DiagramRenderer({
  hasDiagram,
  diagramDescription,
  diagramType,
  subject,
  topic,
  source,
}: DiagramRendererProps) {
  if (!hasDiagram) return null;

  const getAutoSVG = () => {
    const type = diagramType?.toLowerCase() || '';
    const topicLower = (topic || '').toLowerCase();

    if (type.includes('wave') || topicLower.includes('wave')) {
      return <WaveDiagram />;
    }

    if (type.includes('circuit') || topicLower.includes('electric')) {
      return <CircuitDiagram />;
    }

    if (type.includes('energy') || topicLower.includes('energetics')) {
      return <EnergyProfileDiagram />;
    }

    if (type.includes('ray') || topicLower.includes('lens') || topicLower.includes('refraction')) {
      return <RayDiagram />;
    }

    if (type.includes('force') || topicLower.includes('force')) {
      return <ForceDiagram />;
    }

    if (type.includes('molecule') || topicLower.includes('bonding') || topicLower.includes('molecule')) {
      return <MoleculeDiagram />;
    }

    if (type.includes('cell') || topicLower.includes('cell')) {
      return <CellDiagram />;
    }

    if (type.includes('triangle') || topicLower.includes('trigonometry')) {
      return <TriangleDiagram />;
    }

    if (type.includes('graph') || topicLower.includes('coordinate')) {
      return <CoordinateDiagram />;
    }

    return null;
  };

  const autoSVG = getAutoSVG();

  return (
    <div className="my-4 rounded-2xl border border-violet-400/20 bg-[#090719]/85 p-4 text-violet-50 shadow-[0_18px_60px_rgba(88,28,135,0.22)]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg font-semibold text-violet-100">Diagram</span>
        <span className="text-sm font-medium text-violet-200/70">
          {subject ? `Subject - ${subject}` : 'Auto-generated visual aid'}
        </span>
      </div>

      {autoSVG && <div className="mb-3 flex justify-center">{autoSVG}</div>}

      {diagramDescription && (
        <div className="rounded-xl border border-violet-300/15 bg-white/[0.04] p-3 text-sm text-violet-100/80">
          <strong>Diagram Description:</strong>
          <br />
          {diagramDescription}
        </div>
      )}

      {!autoSVG && !diagramDescription && (
        <div className="text-sm text-violet-200/60 italic">
          This question includes a diagram.
          {source && (
            <span>
              {' '}
              Refer to: <strong>{source}</strong> for the original diagram.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function WaveDiagram() {
  return (
    <svg
      width="300"
      height="120"
      viewBox="0 0 300 120"
      className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]"
      role="img"
      aria-label="Wave diagram showing amplitude and wavelength"
    >
      <path
        d="M 10 60 C 35 20, 65 20, 90 60 S 145 100, 170 60 S 225 20, 250 60 S 285 100, 290 60"
        stroke="#7C3AED"
        strokeWidth="2"
        fill="none"
      />
      <line x1="90" y1="60" x2="90" y2="20" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4" />
      <text x="94" y="42" fontSize="10" fill="#EF4444">
        A
      </text>
      <line x1="10" y1="100" x2="170" y2="100" stroke="#2563EB" strokeWidth="1.5" />
      <line x1="10" y1="95" x2="10" y2="105" stroke="#2563EB" strokeWidth="1.5" />
      <line x1="170" y1="95" x2="170" y2="105" stroke="#2563EB" strokeWidth="1.5" />
      <text x="80" y="113" fontSize="10" fill="#2563EB">
        lambda
      </text>
      <line x1="10" y1="60" x2="290" y2="60" stroke="#8B7CB8" strokeWidth="1" strokeDasharray="3" />
      <text x="8" y="18" fontSize="9" fill="#C4B5FD">
        Amplitude
      </text>
    </svg>
  );
}

function CircuitDiagram() {
  return (
    <svg
      width="280"
      height="140"
      viewBox="0 0 280 140"
      className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]"
      role="img"
      aria-label="Simple series circuit diagram"
    >
      <rect x="30" y="30" width="220" height="80" fill="none" stroke="#E9D5FF" strokeWidth="2" />
      <line x1="30" y1="55" x2="30" y2="45" stroke="#E9D5FF" strokeWidth="3" />
      <line x1="22" y1="65" x2="38" y2="65" stroke="#E9D5FF" strokeWidth="3" />
      <line x1="25" y1="75" x2="35" y2="75" stroke="#E9D5FF" strokeWidth="2" />
      <text x="35" y="63" fontSize="9" fill="#E9D5FF">
        +
      </text>
      <text x="8" y="63" fontSize="9" fill="#C4B5FD">
        EMF
      </text>
      <rect x="110" y="22" width="60" height="16" fill="#100B24" stroke="#E9D5FF" strokeWidth="2" />
      <text x="125" y="34" fontSize="9" fill="#E9D5FF">
        R
      </text>
      <text x="200" y="26" fontSize="9" fill="#7C3AED">
        I -&gt;
      </text>
      <text x="90" y="120" fontSize="9" fill="#C4B5FD">
        Simple Series Circuit
      </text>
    </svg>
  );
}

function EnergyProfileDiagram() {
  return (
    <svg
      width="280"
      height="160"
      viewBox="0 0 280 160"
      className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]"
      role="img"
      aria-label="Energy profile diagram showing activation energy"
    >
      <line x1="30" y1="130" x2="260" y2="130" stroke="#E9D5FF" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="30" y2="130" stroke="#E9D5FF" strokeWidth="1.5" />
      <text x="100" y="148" fontSize="9" fill="#C4B5FD">
        Progress of Reaction
      </text>
      <text x="2" y="80" fontSize="9" fill="#C4B5FD" transform="rotate(-90, 15, 80)">
        Energy
      </text>
      <path
        d="M 50 110 C 80 110, 90 30, 140 30 S 190 110, 230 100"
        stroke="#7C3AED"
        strokeWidth="2"
        fill="none"
      />
      <line x1="50" y1="110" x2="140" y2="110" stroke="#EF4444" strokeWidth="1" strokeDasharray="3" />
      <line x1="140" y1="30" x2="140" y2="110" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3" />
      <text x="145" y="75" fontSize="9" fill="#EF4444">
        Ea
      </text>
      <line x1="215" y1="100" x2="215" y2="110" stroke="#2563EB" strokeWidth="1.5" />
      <text x="218" y="107" fontSize="9" fill="#2563EB">
        delta H
      </text>
      <text x="40" y="107" fontSize="8" fill="#C4B5FD">
        Reactants
      </text>
      <text x="200" y="97" fontSize="8" fill="#C4B5FD">
        Products
      </text>
    </svg>
  );
}

function TriangleDiagram() {
  return (
    <svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]"
      role="img"
      aria-label="Right-angled triangle diagram"
    >
      <polygon points="30,130 170,130 30,30" fill="none" stroke="#E9D5FF" strokeWidth="2" />
      <rect x="30" y="110" width="15" height="15" fill="none" stroke="#E9D5FF" strokeWidth="1.5" />
      <text x="95" y="145" fontSize="11" fill="#C4B5FD">
        Adjacent
      </text>
      <text x="5" y="85" fontSize="11" fill="#C4B5FD">
        Opposite
      </text>
      <text x="95" y="75" fontSize="11" fill="#C4B5FD">
        Hypotenuse
      </text>
      <text x="155" y="128" fontSize="13" fill="#7C3AED">
        theta
      </text>
    </svg>
  );
}

function RayDiagram() {
  return (
    <svg width="300" height="150" viewBox="0 0 300 150" className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]" role="img" aria-label="Ray diagram showing refraction through a lens">
      <line x1="150" y1="12" x2="150" y2="138" stroke="#8B7CB8" strokeWidth="1" strokeDasharray="4" />
      <ellipse cx="150" cy="75" rx="22" ry="58" fill="rgba(147,51,234,0.18)" stroke="#C084FC" strokeWidth="2" />
      <line x1="20" y1="52" x2="150" y2="75" stroke="#FDE68A" strokeWidth="2" />
      <line x1="150" y1="75" x2="278" y2="75" stroke="#FDE68A" strokeWidth="2" />
      <line x1="20" y1="105" x2="150" y2="75" stroke="#FDE68A" strokeWidth="2" />
      <line x1="150" y1="75" x2="278" y2="75" stroke="#FDE68A" strokeWidth="2" />
      <circle cx="245" cy="75" r="3" fill="#FDE68A" />
      <text x="126" y="142" fontSize="10" fill="#C4B5FD">lens</text>
      <text x="232" y="94" fontSize="10" fill="#C4B5FD">focus</text>
    </svg>
  );
}

function ForceDiagram() {
  return (
    <svg width="260" height="180" viewBox="0 0 260 180" className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]" role="img" aria-label="Free body force diagram">
      <rect x="104" y="72" width="52" height="36" rx="8" fill="#100B24" stroke="#C084FC" strokeWidth="2" />
      <line x1="130" y1="72" x2="130" y2="22" stroke="#86EFAC" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="130" y1="108" x2="130" y2="158" stroke="#F87171" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="104" y1="90" x2="34" y2="90" stroke="#FDE68A" strokeWidth="2" markerEnd="url(#arrow)" />
      <line x1="156" y1="90" x2="226" y2="90" stroke="#60A5FA" strokeWidth="2" markerEnd="url(#arrow)" />
      <defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#C084FC" /></marker></defs>
      <text x="136" y="32" fontSize="10" fill="#86EFAC">normal</text>
      <text x="136" y="154" fontSize="10" fill="#F87171">weight</text>
      <text x="34" y="82" fontSize="10" fill="#FDE68A">friction</text>
      <text x="182" y="82" fontSize="10" fill="#60A5FA">force</text>
    </svg>
  );
}

function MoleculeDiagram() {
  return (
    <svg width="260" height="150" viewBox="0 0 260 150" className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]" role="img" aria-label="Bonding diagram showing shared electrons">
      <circle cx="95" cy="75" r="38" fill="rgba(96,165,250,0.14)" stroke="#60A5FA" strokeWidth="2" />
      <circle cx="155" cy="75" r="38" fill="rgba(192,132,252,0.14)" stroke="#C084FC" strokeWidth="2" />
      <circle cx="124" cy="72" r="4" fill="#FDE68A" />
      <circle cx="136" cy="82" r="4" fill="#FDE68A" />
      <text x="84" y="80" fontSize="14" fill="#DBEAFE">Cl</text>
      <text x="146" y="80" fontSize="14" fill="#F3E8FF">Cl</text>
      <text x="85" y="132" fontSize="10" fill="#C4B5FD">shared pair = covalent bond</text>
    </svg>
  );
}

function CellDiagram() {
  return (
    <svg width="280" height="170" viewBox="0 0 280 170" className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]" role="img" aria-label="Cell diagram showing nucleus, cytoplasm and membrane">
      <ellipse cx="140" cy="86" rx="105" ry="58" fill="rgba(34,197,94,0.08)" stroke="#86EFAC" strokeWidth="2" />
      <circle cx="128" cy="82" r="24" fill="rgba(192,132,252,0.24)" stroke="#C084FC" strokeWidth="2" />
      <ellipse cx="190" cy="92" rx="18" ry="9" fill="rgba(250,204,21,0.18)" stroke="#FDE68A" />
      <ellipse cx="86" cy="92" rx="16" ry="8" fill="rgba(96,165,250,0.18)" stroke="#60A5FA" />
      <text x="112" y="86" fontSize="10" fill="#F3E8FF">nucleus</text>
      <text x="172" y="120" fontSize="10" fill="#FDE68A">mitochondrion</text>
      <text x="60" y="50" fontSize="10" fill="#86EFAC">cell membrane</text>
    </svg>
  );
}

function CoordinateDiagram() {
  return (
    <svg width="280" height="180" viewBox="0 0 280 180" className="max-w-full rounded-xl border border-violet-300/20 bg-[#050514]" role="img" aria-label="Coordinate geometry diagram">
      <line x1="30" y1="150" x2="260" y2="150" stroke="#8B7CB8" />
      <line x1="45" y1="15" x2="45" y2="160" stroke="#8B7CB8" />
      <path d="M45 135 C90 98, 125 75, 170 58 S225 38, 250 25" fill="none" stroke="#C084FC" strokeWidth="2" />
      <line x1="82" y1="104" x2="180" y2="56" stroke="#FDE68A" strokeDasharray="5" />
      <text x="240" y="166" fontSize="10" fill="#C4B5FD">x</text>
      <text x="28" y="24" fontSize="10" fill="#C4B5FD">y</text>
      <text x="116" y="125" fontSize="10" fill="#FDE68A">gradient</text>
    </svg>
  );
}
