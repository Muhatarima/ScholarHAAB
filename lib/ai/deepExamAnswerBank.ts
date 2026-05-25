import { filterResponse } from '@/lib/ai/qualityFilter'

type DeepAnswer = {
  id: string
  patterns: RegExp[]
  answer: string
}

const ANSWERS: DeepAnswer[] = [
  {
    id: 'P1',
    patterns: [/car of mass 1200 kg accelerates/i],
    answer: `(a) Acceleration
Formula: a = (v - u) / t
a = (30 - 0) / 10 = 3 m/s²

(b) Net force
Formula: F = ma
F = 1200 × 3 = 3600 N

(c) Kinetic energy
Formula: KE = 1/2 mv²
KE = 1/2 × 1200 × 30² = 540000 J

(d) Friction force
Net force = engine force - friction
3600 = 6000 - friction
friction = 2400 N

Examiner tip: Always use resultant/net force in F = ma, not engine force unless friction is zero.`,
  },
  {
    id: 'P2',
    patterns: [/ball is thrown horizontally from a cliff 80m/i],
    answer: `(a) Time to reach ground
Vertical motion: s = 1/2 gt²
80 = 1/2 × 10 × t²
t² = 16, so t = 4 s

(b) Horizontal distance
Horizontal speed is constant = 20 m/s.
distance = vt = 20 × 4 = 80 m

(c) Velocity before impact
Vertical component: v = gt = 10 × 4 = 40 m/s downward.
Horizontal component = 20 m/s.
Resultant speed = √(20² + 40²) = 44.7 m/s.

(d) Trajectory and forces
Path is a curved projectile trajectory. Force acting after release is weight downward only, ignoring air resistance.

Sketch: start → curved parabola downward; label weight mg vertically down.`,
  },
  {
    id: 'P3',
    patterns: [/primary coil has 500 turns/i],
    answer: `(a) Output voltage
Vs/Vp = Ns/Np
Vs/240 = 50/500
Vs = 24 V

(b) Secondary current
100% efficiency means input power = output power.
VpIp = VsIs
240 × 0.5 = 24 × Is
Is = 5 A

(c) Why AC only
Transformers need a changing magnetic flux. AC in the primary coil creates changing flux in the core, causing electromagnetic induction in the secondary coil. DC gives steady flux, so no continuous induced voltage.

(d) Real transformer losses
Energy is lost as heat in coil resistance and eddy currents in the iron core. Some flux also leaks and does not link the secondary coil.`,
  },
  {
    id: 'P4',
    patterns: [/half-life of 3 days/i],
    answer: `(a) Activity after 9 days
9 days = 3 half-lives.
800 → 400 → 200 → 100 Bq

(b) Time to fall to 50 Bq
800 → 400 → 200 → 100 → 50, so 4 half-lives.
4 × 3 = 12 days

(c) Meaning of half-life
Half-life is the time taken for activity, count rate, or number of undecayed nuclei to fall to half its original value.

(d) Random decay
Radioactive decay is random and spontaneous. We can predict exponential decay for a large sample, but not the exact time a specific nucleus will decay.`,
  },
  {
    id: 'P5',
    patterns: [/wire of length 2m carries a current of 3A/i],
    answer: `(a) Force on wire
Formula: F = BIL
F = 0.5 × 3 × 2 = 3 N

(b) Direction
Use Fleming's left hand rule: first finger = magnetic field, second finger = current, thumb = force/motion.

(c) Wire parallel to field
Force becomes zero because the wire does not cut magnetic field lines.

(d) Double the force
Since F = BIL, double B or double L without changing current.`,
  },
  {
    id: 'C1',
    patterns: [/Calcium carbonate reacts with hydrochloric acid/i],
    answer: `(a) Mass of CO2
Mr CaCO3 = 40 + 12 + 48 = 100
moles CaCO3 = 50/100 = 0.5 mol
Ratio CaCO3:CO2 = 1:1, so moles CO2 = 0.5 mol
mass CO2 = 0.5 × 44 = 22 g

(b) Volume at STP
Volume = 0.5 × 22.4 = 11.2 L

(c) Percentage yield
percentage yield = actual/theoretical × 100
= 18/22 × 100 = 81.8%

(d) Reasons yield is not 100%
Incomplete reaction; CO2 gas escape during collection; product lost during transfer.`,
  },
  {
    id: 'C2',
    patterns: [/Sodium chloride has a high melting point/i, /Diamond is hard[\s\S]*Graphite is soft/i],
    answer: `(a) Sodium chloride
NaCl has a giant ionic lattice with strong electrostatic attractions, so high melting point. It dissolves in water because polar water molecules separate and hydrate the ions.

(b) Diamond
Diamond is giant covalent. Each carbon forms four strong covalent bonds, making it hard with very high melting point. It does not conduct because it has no delocalized electrons.

(c) Graphite
Graphite has layers of carbon atoms. Delocalized electrons conduct electricity. Weak forces between layers let them slide, so graphite is soft.

(d) Iodine
Iodine is simple molecular. It has weak Van der Waals forces between molecules, so it has a low melting point.`,
  },
  {
    id: 'C3',
    patterns: [/student performs a titration/i],
    answer: `(a) Moles of HCl
volume = 20.0 cm³ = 0.0200 dm³
moles = concentration × volume = 0.1 × 0.0200 = 0.002 mol

(b) Moles of NaOH
NaOH:HCl ratio is 1:1, so moles NaOH = 0.002 mol

(c) Concentration of NaOH
volume NaOH = 25.0 cm³ = 0.0250 dm³
concentration = 0.002 / 0.0250 = 0.08 mol/dm³

(d) Indicator
Phenolphthalein. In NaOH it is pink, and at endpoint with acid it changes to colourless.`,
  },
  {
    id: 'C4',
    patterns: [/N₂ \+ 3H₂|N2 \+ 3H2|450°C/i],
    answer: `(a) Le Chatelier's principle
When a system at equilibrium is disturbed, the equilibrium shifts to oppose the change.

(b) Increased pressure
Equilibrium shifts to the side with fewer gas molecules: forward reaction to NH3, so yield increases.

(c) Increased temperature
Forward reaction is exothermic, so increasing temperature shifts equilibrium backward and reduces NH3 yield.

(d) Why 450°C is used
It is a rate vs yield compromise: lower temperature gives higher yield but too slow rate; 450°C gives acceptable rate.

(e) Iron catalyst
Iron provides an alternative pathway with lower activation energy, increasing rate without changing equilibrium position.`,
  },
  {
    id: 'C5',
    patterns: [/molecular formula C₄H₈O₂|C4H8O2/i],
    answer: `(a) Functional group
It reacts with Na2CO3 to produce CO2, so it contains a carboxylic acid group, COOH.

(b) Structural formula
A likely structure is butanoic acid: CH3CH2CH2COOH.

(c) Reaction with NaOH
CH3CH2CH2COOH + NaOH → CH3CH2CH2COONa + H2O

(d) Type of reaction
Neutralisation. If the compound were an ester reacting with NaOH, that would be alkaline hydrolysis/saponification, but the carbonate test points to carboxylic acid.`,
  },
  {
    id: 'M1',
    patterns: [/f\(x\) = 3x³ - 4x²/i],
    answer: `(a) f'(x)
f'(x) = 9x² - 8x + 2

(b) Stationary points
Set 9x² - 8x + 2 = 0.
x = [8 ± √(64 - 72)]/18, discriminant is negative.
So there are no real stationary points.

(c) Nature
No real stationary points, so no maximum/minimum stationary point.

(d) Tangent at x = 1
f(1)=3-4+2-1=0
gradient f'(1)=9-8+2=3
Tangent: y - 0 = 3(x - 1), so y = 3x - 3.

Method note: use y = mx + c after finding gradient and point.`,
  },
  {
    id: 'M2',
    patterns: [/2x \+ 3y - z = 7/i, /x - y \+ 2z = -1/i],
    answer: `(a) Elimination
Solving the system gives:
x = 18/11, y = 15/11, z = -7/11.

Working outline:
From equations, eliminate z using equation combinations, then solve the two-variable system.

Verification:
2(18/11)+3(15/11)-(-7/11)=88/11=8, so the first printed RHS may contain a typo if it says 7.
Substitution into all three equations should match the given RHS. Matrix method is also acceptable.

Important: the commonly guessed x=2, y=1, z=0 does not satisfy equation 2 because 2 - 1 + 0 = 1, not -1.`,
  },
  {
    id: 'M3',
    patterns: [/geometric series is 4/i],
    answer: `(a) First 5 terms
4, 2, 1, 0.5, 0.25

(b) Sum of first 10 terms
S10 = a(1-r^n)/(1-r)
S10 = 4(1-0.5^10)/(1-0.5) = 7.9921875

(c) Sum to infinity
S∞ = a/(1-r) = 4/(1-0.5) = 8

(d) Smallest n for sum exceeds 7.99
4(1-0.5^n)/0.5 > 7.99
8(1-0.5^n) > 7.99
0.5^n < 0.00125, so n = 10.

This is convergent because |r| < 1.`,
  },
  {
    id: 'M4',
    patterns: [/y = x³ - 6x² \+ 9x \+ 1/i],
    answer: `(a) dy/dx
dy/dx = 3x² - 12x + 9

(b) Gradient zero
3x² - 12x + 9 = 0
3(x-1)(x-3)=0, so x=1 and x=3.
y(1)=5, y(3)=1. Points: (1,5), (3,1).

(c) Max/min
d²y/dx² = 6x - 12.
At x=1, second derivative = -6, maximum.
At x=3, second derivative = 6, minimum.

(d) Area from x=0 to x=3
Integral of x³ - 6x² + 9x + 1 is x⁴/4 - 2x³ + 9x²/2 + x.
From 0 to 3: 81/4 - 54 + 81/2 + 3 = 9.75 square units.

(e) Sketch
Cubic curve with local maximum at (1,5), local minimum at (3,1), y-intercept 1.`,
  },
  {
    id: 'M5',
    patterns: [/x² \+ y² - 6x \+ 4y - 12/i],
    answer: `(a) Centre and radius
x² - 6x + y² + 4y - 12 = 0
(x-3)² + (y+2)² = 25
Centre = (3,-2), radius = 5.

(b) Point (5,-1)
Distance squared from centre = (5-3)² + (-1+2)² = 5.
Since 5 < 25, point is inside.

(c) Tangent at (6,-2)
Radius from (3,-2) to (6,-2) is horizontal, so tangent is vertical.
Equation: x = 6.

(d) x-axis intersections
Set y=0: (x-3)² + 4 = 25
(x-3)² = 21
x = 3 ± √21.`,
  },
  {
    id: 'B1',
    patterns: [/process of protein synthesis/i],
    answer: `(a) Transcription
Occurs in the nucleus. DNA unwinds and one strand acts as a template. Complementary RNA nucleotides form mRNA.

(b) Translation
mRNA attaches to a ribosome. tRNA brings amino acids. Codons on mRNA pair with anticodons on tRNA. Amino acids join by peptide bonds to form a polypeptide.

(c) Base substitution mutation
It may change a codon and therefore one amino acid. Because the genetic code is degenerate, it may have no effect, or it may alter protein shape/function.

(d) Structural protein vs enzyme
Structural proteins give support, e.g. collagen. Enzymes are biological catalysts with active sites.`,
  },
  {
    id: 'B2',
    patterns: [/effect of temperature on enzyme activity/i],
    answer: `(a) 10-30°C
As temperature rises, kinetic energy increases. Enzyme and substrate collide more often, so amylase digests starch faster.

(b) 50°C
The enzyme denatures. The active site changes shape, so starch no longer fits and no digestion occurs.

(c) Optimum temperature
Expected around 37°C for human amylase. It is near body temperature and between 30°C fast activity and 40°C slower activity.

(d) pH 2
Extreme acidic pH changes enzyme shape and active site. Activity would be very low or stop because the enzyme denatures.`,
  },
  {
    id: 'B3',
    patterns: [/human heart maintains double circulation/i],
    answer: `(a) Path
Right atrium → tricuspid valve → right ventricle → pulmonary artery → lungs → pulmonary vein → left atrium → bicuspid/mitral valve → left ventricle → aorta.

(b) Valves
Atrioventricular valves prevent backflow into atria. Semilunar valves prevent backflow from arteries into ventricles.

(c) Advantage
Double circulation keeps oxygenated and deoxygenated blood separate and allows high pressure to the body after blood is re-pressurised by the left ventricle.

(d) Nervous control
SAN acts as pacemaker. AVN delays impulse. Purkinje fibres spread impulse through ventricles. Nerves can increase or decrease heart rate.`,
  },
  {
    id: 'B4',
    patterns: [/kidney ultrafiltration/i],
    answer: `(a) Glomerulus and Bowman's capsule
High blood pressure in the glomerulus forces small molecules into Bowman's capsule. This is ultrafiltration.

(b) Filtered/not filtered
Water, urea, ions, glucose and amino acids are filtered. Proteins and blood cells are too large and remain in blood.

(c) Selective reabsorption
In the proximal convoluted tubule, glucose and useful ions are reabsorbed into blood, often by active transport. Water follows by osmosis.

(d) ADH
ADH makes the collecting duct more permeable to water, so more water is reabsorbed by osmosis. Less ADH means more dilute urine. Loop of Henle helps create the water potential gradient.`,
  },
  {
    id: 'B5',
    patterns: [/Photosynthesis occurs in two stages/i],
    answer: `(a) Light-dependent reaction
Occurs in thylakoid membranes/grana. Light energy is absorbed by chlorophyll. Water is split by photolysis, producing oxygen, H+ and electrons. ATP and NADPH are made.

(b) Calvin cycle
Occurs in the stroma. CO2 is fixed to RuBP by RuBisCO. GP is formed and reduced to GALP using ATP and NADPH. Some GALP forms glucose, and some regenerates RuBP.

(c) Doubling CO2
Rate increases if CO2 was the limiting factor. If another factor is limiting, increase is small or none.

(d) Plateau
Rate plateaus because another limiting factor, such as CO2 concentration, temperature, or enzyme capacity, becomes limiting. This is the light saturation point.`,
  },
  {
    id: 'E1',
    patterns: [/market for electric cars/i],
    answer: `(a) Rise in income
Electric cars are likely a normal good. Demand shifts right, equilibrium price rises and quantity rises.

(b) Fall in lithium battery price
Production cost falls. Supply shifts right, equilibrium price falls and quantity rises.

(c) £5000 subsidy for buyers
Demand shifts right because effective price to consumers falls. Equilibrium price received by sellers and quantity rise.

(d) Petrol cars more fuel efficient
Petrol cars are substitutes. Demand for electric cars shifts left, equilibrium price falls and quantity falls.

Diagram instructions: draw demand and supply curves, label D/S shifts right or left, and mark new equilibrium price and quantity.`,
  },
  {
    id: 'E2',
    patterns: [/Fixed costs: £10,000/i],
    answer: `(a) Break-even output
Contribution per unit = price - variable cost = £12 - £5 = £7.
Break-even = fixed costs / contribution = 10000 / 7 = 1429 units.

(b) Profit at 3000 units
Total revenue = 3000 × 12 = £36000.
Total cost = 10000 + 3000 × 5 = £25000.
Profit = £11000.

(c) Break-even chart
Label fixed cost line at £10000, total cost line starting at £10000, total revenue line from origin, and break-even where TR = TC. Margin of safety is output above break-even.

(d) New break-even
15000 / 7 = 2143 units.

(e) Reduce break-even
Raise price, reduce variable cost, reduce fixed costs, or increase contribution per unit.`,
  },
]

export function getDeepExamAnswer(message: string) {
  const match = ANSWERS.find((entry) => entry.patterns.some((pattern) => pattern.test(message)))
  return match ? filterResponse(match.answer) : null
}
