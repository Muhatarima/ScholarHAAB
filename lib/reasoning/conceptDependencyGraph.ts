export type DependencyGap = {
  concept: string
  missingPrerequisites: string[]
  recommendation: string
}

const DEPENDENCIES: Record<string, string[]> = {
  'Differential Equations': ['Differentiation', 'Integration', 'Algebra'],
  Integration: ['Differentiation', 'Functions', 'Algebra'],
  Differentiation: ['Functions', 'Algebra'],
  Functions: ['Algebra'],
  'Chemical Bonding': ['Atomic Structure', 'Electron Arrangement'],
  'Organic Chemistry': ['Chemical Bonding', 'Functional Groups'],
  'Wave Motion': ['Speed', 'Frequency', 'Wavelength'],
  Mechanics: ['Forces', 'Motion Graphs', 'Algebra'],
  'Normal Distribution': ['Probability', 'Standardisation'],
  Inflation: ['Price Level', 'Demand and Supply'],
}

function includesConcept(haystack: string[], needle: string) {
  return haystack.some((item) => item.toLowerCase() === needle.toLowerCase())
}

export function getPrerequisites(concept: string): string[] {
  return DEPENDENCIES[concept] ?? []
}

export function detectDependencyGaps(concepts: string[], knownWeakOrSkipped: string[] = []): DependencyGap[] {
  const gaps: DependencyGap[] = []

  for (const concept of concepts) {
    const missingPrerequisites = getPrerequisites(concept).filter((dependency) => {
      return includesConcept(knownWeakOrSkipped, dependency) || includesConcept(concepts, concept) && !includesConcept(concepts, dependency)
    })

    if (missingPrerequisites.length) {
      gaps.push({
        concept,
        missingPrerequisites,
        recommendation: `Revise ${missingPrerequisites[0]} briefly before deep practice on ${concept}.`,
      })
    }
  }

  return gaps
}

export function dependencyCoverage() {
  return Object.keys(DEPENDENCIES)
}
