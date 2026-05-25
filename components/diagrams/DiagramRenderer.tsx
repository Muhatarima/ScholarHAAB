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

    if (type.includes('triangle') || topicLower.includes('trigonometry')) {
      return <TriangleDiagram />;
    }

    return null;
  };

  const autoSVG = getAutoSVG();

  return (
    <div className="my-4 p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">Diagram</span>
        <span className="text-sm font-medium text-gray-600">
          {subject ? `Subject - ${subject}` : 'Auto-generated visual aid'}
        </span>
      </div>

      {autoSVG && <div className="mb-3 flex justify-center">{autoSVG}</div>}

      {diagramDescription && (
        <div className="text-sm text-gray-700 bg-white p-3 rounded border">
          <strong>Diagram Description:</strong>
          <br />
          {diagramDescription}
        </div>
      )}

      {!autoSVG && !diagramDescription && (
        <div className="text-sm text-gray-500 italic">
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
      className="border border-gray-200 rounded bg-white max-w-full"
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
      <line x1="10" y1="60" x2="290" y2="60" stroke="#9CA3AF" strokeWidth="1" strokeDasharray="3" />
      <text x="8" y="18" fontSize="9" fill="#6B7280">
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
      className="border border-gray-200 rounded bg-white max-w-full"
      role="img"
      aria-label="Simple series circuit diagram"
    >
      <rect x="30" y="30" width="220" height="80" fill="none" stroke="#374151" strokeWidth="2" />
      <line x1="30" y1="55" x2="30" y2="45" stroke="#374151" strokeWidth="3" />
      <line x1="22" y1="65" x2="38" y2="65" stroke="#374151" strokeWidth="3" />
      <line x1="25" y1="75" x2="35" y2="75" stroke="#374151" strokeWidth="2" />
      <text x="35" y="63" fontSize="9" fill="#374151">
        +
      </text>
      <text x="8" y="63" fontSize="9" fill="#374151">
        EMF
      </text>
      <rect x="110" y="22" width="60" height="16" fill="white" stroke="#374151" strokeWidth="2" />
      <text x="125" y="34" fontSize="9" fill="#374151">
        R
      </text>
      <text x="200" y="26" fontSize="9" fill="#7C3AED">
        I -&gt;
      </text>
      <text x="90" y="120" fontSize="9" fill="#6B7280">
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
      className="border border-gray-200 rounded bg-white max-w-full"
      role="img"
      aria-label="Energy profile diagram showing activation energy"
    >
      <line x1="30" y1="130" x2="260" y2="130" stroke="#374151" strokeWidth="1.5" />
      <line x1="30" y1="20" x2="30" y2="130" stroke="#374151" strokeWidth="1.5" />
      <text x="100" y="148" fontSize="9" fill="#374151">
        Progress of Reaction
      </text>
      <text x="2" y="80" fontSize="9" fill="#374151" transform="rotate(-90, 15, 80)">
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
      <text x="40" y="107" fontSize="8" fill="#6B7280">
        Reactants
      </text>
      <text x="200" y="97" fontSize="8" fill="#6B7280">
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
      className="border border-gray-200 rounded bg-white max-w-full"
      role="img"
      aria-label="Right-angled triangle diagram"
    >
      <polygon points="30,130 170,130 30,30" fill="none" stroke="#374151" strokeWidth="2" />
      <rect x="30" y="110" width="15" height="15" fill="none" stroke="#374151" strokeWidth="1.5" />
      <text x="95" y="145" fontSize="11" fill="#374151">
        Adjacent
      </text>
      <text x="5" y="85" fontSize="11" fill="#374151">
        Opposite
      </text>
      <text x="95" y="75" fontSize="11" fill="#374151">
        Hypotenuse
      </text>
      <text x="155" y="128" fontSize="13" fill="#7C3AED">
        theta
      </text>
    </svg>
  );
}
