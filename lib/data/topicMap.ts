export type TopicChapter = {
  chapter: string
  name: string
  syllabus_ref?: string
  topics: string[]
}

export type SubjectTopicMap = {
  level: string[]
  board: string[]
  chapters: TopicChapter[]
}

export type TopicMap = Record<string, SubjectTopicMap>

export const TOPIC_MAP = JSON.parse(String.raw`{
  "Physics": {
    "level": ["A Level", "O Level"],
    "board": ["Cambridge", "Edexcel"],
    "chapters": [
      {"chapter":"1","name":"Measurements and Units","syllabus_ref":"9702/1","topics":["SI units","Scalars and vectors","Errors and uncertainties","Significant figures"]},
      {"chapter":"2","name":"Kinematics","syllabus_ref":"9702/2","topics":["Distance and displacement","Speed and velocity","Acceleration","SUVAT equations","Projectile motion","Velocity-time graphs"]},
      {"chapter":"3","name":"Dynamics","syllabus_ref":"9702/3","topics":["Newton's first law","Newton's second law F=ma","Newton's third law","Momentum","Impulse","Conservation of momentum"]},
      {"chapter":"4","name":"Forces","syllabus_ref":"9702/4","topics":["Types of forces","Free body diagrams","Equilibrium","Moments and torques","Centre of gravity"]},
      {"chapter":"5","name":"Work Energy Power","syllabus_ref":"9702/5","topics":["Work done W=Fd","Kinetic energy KE=1/2mv^2","Gravitational potential energy PE=mgh","Conservation of energy","Power P=W/t","Efficiency"]},
      {"chapter":"6","name":"Deformation of Solids","topics":["Hooke's law F=kx","Elastic and plastic deformation","Young's modulus","Stress strain curves"]},
      {"chapter":"7","name":"Waves","topics":["Wave properties","Transverse and longitudinal waves","Wave speed v=f lambda","Electromagnetic spectrum","Doppler effect"]},
      {"chapter":"8","name":"Superposition","topics":["Principle of superposition","Interference","Diffraction","Standing waves","Young's double slit"]},
      {"chapter":"9","name":"Electricity","topics":["Current and charge","Potential difference","Resistance","Ohm's law V=IR","Resistivity","I-V characteristics"]},
      {"chapter":"10","name":"DC Circuits","topics":["Series circuits","Parallel circuits","EMF and internal resistance","Kirchhoff's laws","Potential divider","Wheatstone bridge"]},
      {"chapter":"11","name":"Particle Physics","topics":["Atomic structure","Nuclear notation","Alpha beta gamma","Radioactive decay","Half-life","Nuclear equations","E=mc^2"]},
      {"chapter":"12","name":"Quantum Physics","topics":["Photoelectric effect","Photon energy E=hf","Work function","de Broglie wavelength","Wave-particle duality","Energy levels"]},
      {"chapter":"13","name":"Gravitational Fields","topics":["Gravitational force F=Gm1m2/r^2","Gravitational field strength","Orbital motion","Gravitational potential","Escape velocity"]},
      {"chapter":"14","name":"Oscillations","topics":["Simple harmonic motion","SHM equations","Period and frequency","Energy in SHM","Damping","Resonance"]},
      {"chapter":"15","name":"Electric Fields","topics":["Coulomb's law","Electric field strength","Electric potential","Capacitors","Capacitance C=Q/V","Energy stored in capacitor","RC circuits"]},
      {"chapter":"16","name":"Magnetic Fields","topics":["Magnetic flux density","Force on conductor F=BIL","Force on moving charge F=BQv","Fleming's left hand rule","Magnetic flux","Electromagnetic induction","Faraday's law","Lenz's law","Transformers","Alternating current"]}
    ]
  },
  "Chemistry": {
    "level": ["A Level", "O Level"],
    "board": ["Cambridge", "Edexcel"],
    "chapters": [
      {"chapter":"1","name":"Atoms and Stoichiometry","syllabus_ref":"9701/1","topics":["Atomic structure","Isotopes","Relative atomic mass","Mole concept n=m/M","Empirical formula","Molecular formula","Percentage composition"]},
      {"chapter":"2","name":"Chemical Bonding","topics":["Ionic bonding","Covalent bonding","Metallic bonding","Electronegativity","Polar bonds","Intermolecular forces","Van der Waals forces","Hydrogen bonding","Giant structures","VSEPR theory"]},
      {"chapter":"3","name":"Energetics","topics":["Enthalpy changes","Hess's law","Bond energies","Lattice energy","Born-Haber cycle","Entropy","Gibbs free energy delta G=delta H - T delta S"]},
      {"chapter":"4","name":"Reaction Kinetics","topics":["Rate of reaction","Collision theory","Activation energy","Catalysts","Rate equations","Order of reaction","Rate constant","Arrhenius equation"]},
      {"chapter":"5","name":"Equilibria","topics":["Dynamic equilibrium","Le Chatelier's principle","Kc expression","Kp expression","Acid-base equilibria","pH calculations","Buffer solutions","Kw and pOH"]},
      {"chapter":"6","name":"Electrochemistry","topics":["Oxidation states","Redox reactions","Electrode potentials","Electrochemical cells","EMF calculations","Electrolysis","Faraday's laws"]},
      {"chapter":"7","name":"Organic Chemistry","topics":["Functional groups","Nomenclature","Alkanes","Alkenes","Halogenoalkanes","Alcohols","Aldehydes and ketones","Carboxylic acids","Esters","Amines","Amino acids","Polymers","Reaction mechanisms: nucleophilic substitution, electrophilic addition, nucleophilic addition, elimination"]},
      {"chapter":"8","name":"Analytical Chemistry","topics":["Mass spectrometry","IR spectroscopy","NMR spectroscopy","Chromatography","Titration calculations"]}
    ]
  },
  "Mathematics": {
    "level": ["A Level", "O Level"],
    "board": ["Cambridge", "Edexcel"],
    "chapters": [
      {"chapter":"1","name":"Algebra","topics":["Quadratic equations","Completing the square","Quadratic formula","Discriminant","Simultaneous equations","Inequalities","Binomial expansion"]},
      {"chapter":"2","name":"Functions","topics":["Domain and range","Composite functions","Inverse functions","Modulus function","Transformations of graphs"]},
      {"chapter":"3","name":"Coordinate Geometry","topics":["Straight line equations","Gradient and intercept","Distance formula","Midpoint formula","Circle equations","Tangent to circle"]},
      {"chapter":"4","name":"Trigonometry","topics":["Sine cosine tangent","Sine rule","Cosine rule","Radians","Trig identities","sin^2+cos^2=1","Double angle formulas","Solving trig equations"]},
      {"chapter":"5","name":"Calculus — Differentiation","topics":["First principles","Power rule d/dx(x^n)=nx^(n-1)","Chain rule","Product rule","Quotient rule","Stationary points","Second derivative","Implicit differentiation","Parametric differentiation"]},
      {"chapter":"6","name":"Calculus — Integration","topics":["Indefinite integration","Definite integration","Area under curve","Integration by parts","Integration by substitution","Partial fractions","Volume of revolution","Differential equations"]},
      {"chapter":"7","name":"Series","topics":["Arithmetic sequences","Arithmetic series Sn=n/2(2a+(n-1)d)","Geometric sequences","Geometric series","Sum to infinity","Convergence conditions"]},
      {"chapter":"8","name":"Vectors","topics":["Vector notation","Addition and subtraction","Scalar multiplication","Magnitude","Unit vectors","Dot product","Angle between vectors","3D vectors"]},
      {"chapter":"9","name":"Statistics and Probability","topics":["Probability rules","Conditional probability","Bayes theorem","Binomial distribution","Normal distribution","Hypothesis testing","Chi-squared test","Correlation"]}
    ]
  },
  "Biology": {
    "level": ["A Level", "O Level"],
    "board": ["Cambridge", "Edexcel"],
    "chapters": [
      {"chapter":"1","name":"Cell Structure","topics":["Prokaryotic cells","Eukaryotic cells","Cell organelles","Electron microscopy","Cell fractionation"]},
      {"chapter":"2","name":"Biological Molecules","topics":["Carbohydrates","Proteins","Lipids","DNA and RNA","ATP","Water properties","Inorganic ions"]},
      {"chapter":"3","name":"Enzymes","topics":["Enzyme structure","Lock and key model","Induced fit model","Factors affecting enzyme activity","Inhibitors","Cofactors and coenzymes"]},
      {"chapter":"4","name":"Cell Membranes","topics":["Fluid mosaic model","Diffusion","Osmosis","Active transport","Endocytosis","Exocytosis"]},
      {"chapter":"5","name":"Genetics","topics":["DNA replication","Transcription","Translation","Genetic code","Mutations","Mitosis","Meiosis","Mendelian genetics","Dihybrid crosses","Linkage","Chi-squared in genetics"]},
      {"chapter":"6","name":"Transport Systems","topics":["Heart structure","Cardiac cycle","Blood vessels","Blood components","Haemoglobin","Oxygen dissociation curve","Bohr effect","Transpiration","Xylem and phloem","Translocation"]},
      {"chapter":"7","name":"Respiration","topics":["Glycolysis","Link reaction","Krebs cycle","Oxidative phosphorylation","Chemiosmosis","ATP yield","Anaerobic respiration","Respiratory quotient"]},
      {"chapter":"8","name":"Photosynthesis","topics":["Light dependent reaction","Calvin cycle","Photosystems I and II","Photolysis","ATP synthesis","Carbon fixation","RuBisCO","Limiting factors"]},
      {"chapter":"9","name":"Homeostasis","topics":["Negative feedback","Kidney structure","Ultrafiltration","Selective reabsorption","ADH","Thermoregulation","Blood glucose control","Insulin and glucagon"]},
      {"chapter":"10","name":"Ecology and Evolution","topics":["Ecosystems","Food chains and webs","Energy flow","Nitrogen cycle","Carbon cycle","Natural selection","Speciation","Conservation"]}
    ]
  }
}`) as TopicMap
