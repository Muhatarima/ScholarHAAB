export type DiagramType =
  | 'wave'
  | 'circuit'
  | 'energy_profile'
  | 'triangle'
  | 'ray_diagram'
  | 'graph'
  | 'force'
  | 'unknown';

export function matchDiagramType(
  questionText: string,
  subject: string,
  topic?: string
): DiagramType {
  const text = `${questionText} ${topic || ''}`.toLowerCase();
  const subjectLower = subject.toLowerCase();

  if (subjectLower === 'physics') {
    if (/wave|wavelength|frequency|amplitude|transverse|longitudinal/.test(text)) {
      return 'wave';
    }
    if (/circuit|current|voltage|resistance|resistor|battery/.test(text)) {
      return 'circuit';
    }
    if (/ray|lens|refraction|reflection|optical/.test(text)) {
      return 'ray_diagram';
    }
    if (/force|free body|tension|weight|normal/.test(text)) {
      return 'force';
    }
  }

  if (subjectLower === 'chemistry') {
    if (/energy profile|activation energy|enthalpy|exothermic|endothermic/.test(text)) {
      return 'energy_profile';
    }
  }

  if (subjectLower === 'mathematics') {
    if (/triangle|angle|sine|cosine|tangent|hypotenuse/.test(text)) {
      return 'triangle';
    }
    if (/graph|sketch|plot|curve|function|integration|differentiat|gradient|area under/.test(text)) {
      return 'graph';
    }
  }

  return 'unknown';
}
