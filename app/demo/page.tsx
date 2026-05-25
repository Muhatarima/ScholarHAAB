'use client';

import { useRef, useState } from 'react';
import SocialProof from '@/components/analytics/SocialProof';
import DiagramRenderer from '@/components/diagrams/DiagramRenderer';
import { trackEvent } from '@/lib/analytics/usageTracker';
import { matchDiagramType } from '@/lib/diagrams/diagramMatcher';
import { getOfflineAnswer } from '@/lib/offline/fallbackEngine';

type DemoAnswer = {
  question: string;
  subject?: string;
  topic?: string;
  confidence: string;
  source: string;
  answer: string;
  markScheme: string[];
  examinerTip?: string;
  hasDiagram?: boolean;
  diagramType?: string;
  isOffline?: boolean;
};

const DEMO_ANSWERS: Record<string, DemoAnswer> = {
  wave_speed: {
    question: 'Calculate wave speed if frequency = 500Hz and wavelength = 0.68m',
    subject: 'Physics',
    topic: 'Waves',
    confidence: 'VERIFIED',
    source: 'Cambridge O Level Physics 2021 May/June Paper 2 Q3',
    answer:
      'Step 1: Write wave equation\nv = f lambda\n\nStep 2: Substitute values\nv = 500 x 0.68\n\nStep 3: Calculate\nv = 340 m/s',
    markScheme: [
      'v = f lambda stated or implied (1 mark)',
      'Correct substitution: 500 x 0.68 (1 mark)',
      'v = 340 m/s with correct unit (1 mark)',
    ],
    examinerTip:
      'Always write the formula first. Cambridge awards 1 mark just for stating v = f lambda correctly.',
    hasDiagram: true,
    diagramType: 'wave',
  },
  newton_third: {
    question: "State Newton's Third Law with an example",
    subject: 'Physics',
    topic: 'Forces',
    confidence: 'VERIFIED',
    source: 'Cambridge O Level Physics 2020 Oct/Nov Paper 1 Q7',
    answer:
      "Newton's Third Law:\nWhen object A exerts a force on object B, object B exerts an equal and opposite force on object A.\n\nKey points:\n- Forces are equal in magnitude\n- Forces are opposite in direction\n- Forces act on different objects\n\nExample: when you push a wall, the wall pushes back on you with equal force.",
    markScheme: [
      'Equal and opposite forces (1 mark)',
      'Forces act on different objects (1 mark)',
      'Correct real-world example (1 mark)',
    ],
    examinerTip:
      'Most students forget that the forces must act on different objects. That is the common mark-loser.',
    hasDiagram: false,
  },
  integration: {
    question: 'Find integral of x e^x dx using integration by parts',
    subject: 'Mathematics',
    topic: 'Calculus',
    confidence: 'VERIFIED',
    source: 'Cambridge A Level Mathematics 2022 May/June Paper 3 Q5',
    answer:
      'Integration by Parts: integral u dv = uv - integral v du\n\nStep 1: Choose u and dv\nLet u = x, so du = dx\nLet dv = e^x dx, so v = e^x\n\nStep 2: Apply formula\nintegral x e^x dx = x e^x - integral e^x dx\n\nStep 3: Integrate\n= x e^x - e^x + C\n\nStep 4: Factorise\n= e^x(x - 1) + C',
    markScheme: [
      'Correct choice: u = x, dv = e^x dx (1 mark)',
      'du = dx and v = e^x correctly stated (1 mark)',
      'Applying integration by parts formula (1 mark)',
      'x e^x - integral e^x dx (1 mark)',
      'e^x(x - 1) + C with constant (1 mark)',
    ],
    examinerTip:
      'Always include the constant of integration and simplify the final expression if possible.',
    hasDiagram: false,
  },
  ethanol: {
    question: 'Name CH3CH2OH and state its functional group',
    subject: 'Chemistry',
    topic: 'Organic Chemistry',
    confidence: 'VERIFIED',
    source: 'Cambridge O Level Chemistry 2021 May/June Paper 2 Q4',
    answer:
      "Name: Ethanol\n\nNaming steps:\n1. Count carbons: CH3CH2- has 2 carbons, so prefix is 'eth-'.\n2. Identify functional group: -OH is hydroxyl.\n3. Suffix for alcohol: '-ol'.\n4. Full name: ethanol.\n\nFunctional group: hydroxyl group (-OH)\nCompound class: alcohol",
    markScheme: ['Ethanol (1 mark)', 'Hydroxyl group / -OH (1 mark)'],
    examinerTip: 'Naming is prefix from carbon count plus suffix from functional group.',
    hasDiagram: false,
  },
  photosynthesis: {
    question: 'Write the word equation for photosynthesis',
    subject: 'Biology',
    topic: 'Photosynthesis',
    confidence: 'VERIFIED',
    source: 'Cambridge O Level Biology 2020 May/June Paper 1 Q12',
    answer:
      'Word equation for photosynthesis:\n\nCarbon dioxide + water -> glucose + oxygen\n\nConditions needed:\n- light energy\n- chlorophyll\n\nReactants: carbon dioxide and water.\nProducts: glucose and oxygen.',
    markScheme: [
      'Reactants: carbon dioxide + water (1 mark)',
      'Products: glucose + oxygen (1 mark)',
      'Conditions: light and chlorophyll (1 mark)',
    ],
    examinerTip:
      'Include light and chlorophyll when conditions are requested. Students often lose the easy condition mark.',
    hasDiagram: false,
  },
};

const DEMO_CHIPS = [
  { key: 'wave_speed', label: 'Wave Speed Calc', color: 'bg-blue-100 text-blue-700' },
  { key: 'newton_third', label: "Newton's 3rd Law", color: 'bg-red-100 text-red-700' },
  { key: 'integration', label: 'Integration by Parts', color: 'bg-purple-100 text-purple-700' },
  { key: 'ethanol', label: 'CH3CH2OH Name', color: 'bg-green-100 text-green-700' },
  { key: 'photosynthesis', label: 'Photosynthesis', color: 'bg-emerald-100 text-emerald-700' },
];

export default function DemoPage() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<DemoAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [signedUp, setSignedUp] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  const scrollToAnswer = () => {
    window.setTimeout(() => {
      answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleChipClick = (key: string) => {
    const demo = DEMO_ANSWERS[key];
    if (!demo) return;

    setQuery(demo.question);
    setLoading(true);
    trackEvent('question_asked', {
      subject: demo.subject,
      topic: demo.topic,
      question: demo.question,
      page: '/demo',
    });

    window.setTimeout(() => {
      setAnswer(demo);
      setLoading(false);
      scrollToAnswer();
    }, 800);
  };

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setAnswer(null);
    trackEvent('question_asked', { question: query, page: '/demo' });

    try {
      const response = await fetch('/api/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) throw new Error(`Tutor API failed: ${response.status}`);

      const data = (await response.json()) as {
        answer?: string;
        response?: string;
        message?: string;
        confidence?: string;
        source?: string;
        markScheme?: string[];
        examinerTip?: string;
        subject?: string;
        topic?: string;
      };

      const subject = data.subject || 'Physics';
      const topic = data.topic || 'General';
      const diagramType = matchDiagramType(`${query} ${data.answer || ''}`, subject, topic);

      setAnswer({
        question: query,
        answer: data.response || data.message || data.answer || 'ScholarHAAB generated a response.',
        confidence: data.confidence || 'PARTIAL',
        source: data.source || 'ScholarHAAB AI',
        markScheme: data.markScheme || [],
        examinerTip: data.examinerTip || '',
        subject,
        topic,
        hasDiagram: diagramType !== 'unknown' && /diagram|wave|circuit|triangle|graph|sketch/i.test(query),
        diagramType,
      });
    } catch {
      const offline = getOfflineAnswer(query);
      if (offline.found && offline.question) {
        setAnswer({
          question: query,
          answer: offline.question.step_by_step,
          confidence: 'PARTIAL (Cached)',
          source: offline.question.source,
          markScheme: offline.question.mark_scheme_points,
          subject: offline.question.subject,
          topic: offline.question.topic,
          examinerTip: offline.message,
          hasDiagram: /wave|circuit|triangle|energy/i.test(
            `${offline.question.topic} ${offline.question.question_text}`
          ),
          diagramType: matchDiagramType(
            offline.question.question_text,
            offline.question.subject,
            offline.question.topic
          ),
          isOffline: true,
        });
      } else {
        setAnswer({
          question: query,
          answer: offline.message,
          confidence: 'OFFLINE',
          source: 'Cached response',
          markScheme: [],
          isOffline: true,
        });
      }
    } finally {
      setLoading(false);
      scrollToAnswer();
    }
  };

  const handleBetaSignup = async () => {
    if (!email || !email.includes('@')) return;

    try {
      await fetch('/api/beta/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      await trackEvent('beta_signup', { page: '/demo' });
    } finally {
      setSignedUp(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="text-center pt-12 pb-8 px-4">
        <div className="inline-block bg-purple-900 text-purple-300 text-sm font-medium px-3 py-1 rounded-full mb-4">
          Built for Bangladesh
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          Bangladesh&apos;s AI Tutor
          <br />
          <span className="text-purple-400">for A/O Level Students</span>
        </h1>
        <p className="text-gray-400 text-lg max-w-xl mx-auto mb-6">
          Ask any past paper question. Get verified Cambridge and Edexcel answers with full
          mark schemes instantly.
        </p>

        <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
          {[
            '50,000+ Questions',
            'Cambridge Verified',
            'Instant Answers',
            '10 Years of Papers',
            'All Subjects',
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Ask Any Question</h2>

            <textarea
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. Calculate wave speed if f=500Hz and wavelength=0.68m"
              className="w-full bg-gray-800 text-white rounded-xl p-3 text-sm resize-none h-24 border border-gray-700 focus:border-purple-500 focus:outline-none mb-3"
            />

            <button
              onClick={handleSubmit}
              disabled={loading || !query.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white font-medium py-3 rounded-xl transition-colors mb-4"
              type="button"
            >
              {loading ? 'Searching Cambridge papers...' : 'Get Verified Answer'}
            </button>

            <div className="border-t border-gray-800 pt-4">
              <p className="text-xs text-gray-500 mb-3">Try these demo questions:</p>
              <div className="flex flex-wrap gap-2">
                {DEMO_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    onClick={() => handleChipClick(chip.key)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium transition-opacity hover:opacity-80 ${chip.color}`}
                    type="button"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div ref={answerRef} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 min-h-64">
            {!answer && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
                <div className="text-4xl mb-3">Q</div>
                <p className="text-sm text-center">
                  Click a demo question or type your own
                  <br />
                  to see verified Cambridge answers.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-full py-8">
                <div className="flex gap-1 mb-3">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${index * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-400">Searching verified question memory...</p>
              </div>
            )}

            {answer && !loading && (
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{answer.confidence}</span>
                  {answer.isOffline && (
                    <span className="text-xs bg-yellow-900 text-yellow-300 px-2 py-0.5 rounded">
                      Offline Cache
                    </span>
                  )}
                </div>

                <div className="text-xs text-gray-400 bg-gray-800 px-3 py-2 rounded-lg">
                  Source: {answer.source}
                </div>

                {answer.hasDiagram && (
                  <DiagramRenderer
                    hasDiagram
                    diagramType={answer.diagramType}
                    subject={answer.subject}
                    topic={answer.topic}
                  />
                )}

                <div>
                  <div className="text-purple-400 font-medium mb-2">Step-by-Step Solution:</div>
                  <pre className="whitespace-pre-wrap text-gray-200 bg-gray-800 p-3 rounded-lg text-xs leading-relaxed font-mono">
                    {answer.answer}
                  </pre>
                </div>

                {answer.markScheme.length > 0 && (
                  <div>
                    <div className="text-green-400 font-medium mb-2">Mark Scheme Points:</div>
                    <ul className="space-y-1">
                      {answer.markScheme.map((point, index) => (
                        <li key={`${point}-${index}`} className="flex gap-2 text-gray-300 text-xs">
                          <span className="text-green-400 shrink-0">{index + 1}.</span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {answer.examinerTip && (
                  <div className="bg-amber-950 border border-amber-800 rounded-lg p-3">
                    <div className="text-amber-400 font-medium text-xs mb-1">Examiner Tip:</div>
                    <div className="text-amber-200 text-xs">{answer.examinerTip}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border-y border-gray-800 py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <SocialProof />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 text-center text-sm text-gray-400">
            <div>
              <div className="text-white font-semibold mb-1">10 Years of Papers</div>
              <div>2014-2024 Cambridge and Edexcel</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-1">RAG-Verified</div>
              <div>Answers grounded in mark schemes</div>
            </div>
            <div>
              <div className="text-white font-semibold mb-1">All Core Subjects</div>
              <div>Physics, Math, Chemistry, Biology and more</div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-12 px-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Join the Beta - Free for Students</h2>
        <p className="text-gray-400 mb-6">
          Be among the first A/O Level students to use ScholarHAAB.
        </p>

        {signedUp ? (
          <div className="inline-block bg-green-900 text-green-300 px-6 py-3 rounded-xl">
            You are on the list. Welcome to ScholarHAAB.
          </div>
        ) : (
          <div className="flex gap-2 max-w-sm mx-auto">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-gray-800 text-white px-4 py-3 rounded-xl border border-gray-700 focus:border-purple-500 focus:outline-none text-sm"
              onKeyDown={(event) => event.key === 'Enter' && handleBetaSignup()}
            />
            <button
              onClick={handleBetaSignup}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-medium transition-colors"
              type="button"
            >
              Join
            </button>
          </div>
        )}

        <p className="text-gray-600 text-xs mt-3">No spam. Free forever for students.</p>
      </div>
    </div>
  );
}
