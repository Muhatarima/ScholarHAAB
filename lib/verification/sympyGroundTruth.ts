import { spawn } from 'node:child_process'
import type { GraphSpec } from '@/lib/graph/graphGenerator'

export type SympyFailureType =
  | 'wrong_formula_selected'
  | 'algebra_error'
  | 'calculus_error'
  | 'unit_conversion_error'
  | 'sign_error'
  | 'rounding_significant_figure_error'
  | 'missing_step'
  | 'incorrect_latex'
  | 'wrong_graph'
  | 'wrong_mark_allocation'
  | 'unsupported_ground_truth'

export type SympyGroundTruth = {
  category: 'math' | 'numerical_physics' | 'graph'
  exactAnswer: string
  symbolicForm?: string | null
  latex?: string | null
  numericValue?: number | null
  unit?: string | null
  formulaPath: string[]
  graphPoints?: Array<{ x: number; y: number }>
}

export type SympyVerificationInput = {
  question: string
  category: 'math' | 'numerical_physics' | 'graph'
  solverAnswer: string
  solverLatex?: string | null
  solverNumericValue?: number | null
  solverUnit?: string | null
  solverFormulaPath?: string[]
  solverMarkAllocation?: string[]
  solverGraph?: GraphSpec | null
}

export type SympyVerificationResult = {
  passed: boolean
  failureTypes: SympyFailureType[]
  groundTruth: SympyGroundTruth | null
  comparisons: {
    finalAnswer: boolean
    symbolicForm: boolean
    numericalValue: boolean
    units: boolean
    formulaPath: boolean
    latex: boolean
    graph: boolean
    markAllocation: boolean
  }
}

function runPythonGroundTruth(payload: Pick<SympyVerificationInput, 'question' | 'category'>): Promise<SympyGroundTruth | null> {
  const script = `
import json, math, re, sympy as sp
payload = json.loads(${JSON.stringify(JSON.stringify(payload))})
question = payload["question"]
category = payload["category"]
q = question.lower().replace("²", "^2").replace("³", "^3").replace("×", "*").replace("−", "-")
x = sp.symbols("x")

def number_before_unit(text, unit_regex):
    m = re.search(r"(-?\\d+(?:\\.\\d+)?)\\s*" + unit_regex, text, re.I)
    return float(m.group(1)) if m else None

def number_after(text, marker):
    i = re.search(marker, text, re.I)
    if not i:
        return None
    m = re.search(r"(-?\\d+(?:\\.\\d+)?)", text[i.start():])
    return float(m.group(1)) if m else None

def expression_after(patterns):
    for pattern in patterns:
        m = re.search(pattern, q, re.I)
        if m:
            value = m.group(1).strip()
            value = re.sub(r"\\bwith respect to\\b.*$", "", value).strip()
            value = re.sub(r"\\bfrom\\b.*$", "", value).strip()
            return value
    return None

def parse_expr(value):
    if not value:
        return None
    value = value.strip()
    value = re.sub(r"\\b(sin|cos|tan)\\s*x\\b", r"\\1(x)", value)
    value = value.replace("^", "**")
    value = re.sub(r"(?<=\\d)(?=[a-zA-Z])", "*", value)
    value = re.sub(r"(?<=[a-zA-Z])(?=\\d)", "*", value)
    value = re.sub(r"(?<=\\))\\s*(?=[a-zA-Z])", "*", value)
    value = re.sub(r"(?<=[a-zA-Z0-9)])\\s+(?=[a-zA-Z])", "*", value)
    value = re.sub(r"(?<=x)(?=sin|cos|tan|log|ln)", "*", value)
    value = value.replace("ln", "log")
    value = re.sub(r"\\bsin\\s*x\\b", "sin(x)", value)
    value = re.sub(r"\\bcos\\s*x\\b", "cos(x)", value)
    value = re.sub(r"\\btan\\s*x\\b", "tan(x)", value)
    return sp.sympify(value)

def as_json(data):
    print(json.dumps(data))

try:
    if category in ("math", "graph"):
        if re.search(r"differentiat|derivative|dy/dx", q):
            expr = parse_expr(expression_after([r"differentiat(?:e|ion)?\\s+(?:y\\s*=\\s*)?(.+?)(?=$|,|;)", r"dy/dx\\s+of\\s+(.+?)(?=$|,|;)", r"y\\s*=\\s*(.+?)(?=$|,|;)"]))
            if expr is None:
                raise ValueError("Could not parse derivative expression")
            result = sp.diff(expr, x)
            as_json({"category":"math","exactAnswer":sp.sstr(result),"symbolicForm":sp.sstr(result),"latex":sp.latex(result),"numericValue":None,"unit":None,"formulaPath":["differentiate using SymPy", "apply derivative rules"]})
        elif re.search(r"integrat|integral|∫", q):
            expr = parse_expr(expression_after([r"integrat(?:e|ion)?\\s+(.+?)(?=$|,|;)", r"∫\\s*(.+?)(?:d[xy])?(?=$|,|;)"]))
            if expr is None:
                raise ValueError("Could not parse integral expression")
            m = re.search(r"from\\s+(-?\\d+(?:\\.\\d+)?)\\s+to\\s+(-?\\d+(?:\\.\\d+)?)", q)
            if m:
                lo, hi = float(m.group(1)), float(m.group(2))
                result = sp.integrate(expr, (x, lo, hi))
                exact = sp.sstr(result)
            else:
                result = sp.integrate(expr, x)
                exact = sp.sstr(result) + " + C"
            as_json({"category":"math","exactAnswer":exact,"symbolicForm":sp.sstr(result),"latex":sp.latex(result) + ("" if m else "+C"),"numericValue":float(result) if result.is_number else None,"unit":None,"formulaPath":["integrate using SymPy", "apply antiderivative rules"]})
        elif re.search(r"graph|plot|sketch|y\\s*=", q):
            expr = parse_expr(expression_after([r"(?:graph|plot|sketch)\\s+(?:y\\s*=\\s*)?(.+?)(?=$|,|;)", r"y\\s*=\\s*(.+?)(?=$|,|;)"]) or "x^2")
            points = []
            for raw_x in [-2, -1, 0, 1, 2]:
                y = float(expr.subs(x, raw_x))
                points.append({"x": raw_x, "y": round(y, 4)})
            as_json({"category":"graph","exactAnswer":sp.sstr(expr),"symbolicForm":sp.sstr(expr),"latex":sp.latex(expr),"numericValue":None,"unit":None,"formulaPath":["sample function values with SymPy"],"graphPoints":points})
        else:
            raise ValueError("Unsupported math question")
    elif category == "numerical_physics":
        mass = number_before_unit(q, r"(?:kg|kilogram|kilograms)\\b")
        time = number_before_unit(q, r"(?:s|sec|second|seconds)\\b")
        velocity = number_before_unit(q, r"(?:m\\s*/\\s*s|m\\s*s\\^-1|ms\\^-1|mps)\\b")
        force = number_before_unit(q, r"(?:n|newton|newtons)\\b")
        distance = number_before_unit(q, r"(?:m|metre|meter|metres|meters)\\b")
        current = number_before_unit(q, r"(?:a|amp|amps|ampere|amperes)\\b")
        voltage = number_before_unit(q, r"(?:v|volt|volts)\\b")
        resistance = number_before_unit(q, r"(?:ohm|ohms|Ω)\\b")
        if re.search(r"maximum height|highest point|max height", q) and re.search(r"thrown|projectile|upwards|upward", q):
            u = velocity if velocity is not None else number_after(q, r"thrown|speed|velocity")
            if u is None:
                raise ValueError("Missing launch velocity")
            g = sp.Rational(98, 10)
            h = sp.Rational(str(u))**2 / (2*g)
            as_json({"category":"numerical_physics","exactAnswer":f"{float(h):.6g} m","symbolicForm":sp.sstr(h),"latex":sp.latex(h) + r"\\text{ m}","numericValue":float(h),"unit":"m","formulaPath":["v^2 = u^2 + 2as", "at maximum height v = 0", "s = u^2 / 2g"]})
        elif mass is not None and velocity is not None and time is not None and re.search(r"accelerat|from rest|kinetic energy|friction", q):
            a = sp.Rational(str(velocity)) / sp.Rational(str(time))
            f = sp.Rational(str(mass)) * a
            ke = sp.Rational(1, 2) * sp.Rational(str(mass)) * sp.Rational(str(velocity))**2
            as_json({"category":"numerical_physics","exactAnswer":f"a = {float(a):.6g} m/s^2; F = {float(f):.6g} N; E_k = {float(ke):.6g} J","symbolicForm":sp.sstr(ke),"latex":sp.latex(ke) + r"\\text{ J}","numericValue":float(ke),"unit":"J","formulaPath":["a = (v-u)/t", "F = ma", "E_k = 1/2 mv^2"]})
        elif re.search(r"kinetic energy|\\bke\\b", q) and mass is not None and velocity is not None:
            ke = sp.Rational(1, 2) * sp.Rational(str(mass)) * sp.Rational(str(velocity))**2
            as_json({"category":"numerical_physics","exactAnswer":f"{float(ke):.6g} J","symbolicForm":sp.sstr(ke),"latex":sp.latex(ke) + r"\\text{ J}","numericValue":float(ke),"unit":"J","formulaPath":["E_k = 1/2 mv^2"]})
        elif re.search(r"force|newtons?", q) and mass is not None:
            acc = number_before_unit(q, r"(?:m\\s*/\\s*s\\^2|m\\s*s\\^-2|m/s2|m/s\\^2)\\b")
            if acc is None:
                acc = number_after(q, r"acceleration")
            if acc is None:
                raise ValueError("Missing acceleration")
            f = sp.Rational(str(mass)) * sp.Rational(str(acc))
            as_json({"category":"numerical_physics","exactAnswer":f"{float(f):.6g} N","symbolicForm":sp.sstr(f),"latex":sp.latex(f) + r"\\text{ N}","numericValue":float(f),"unit":"N","formulaPath":["F = ma"]})
        elif re.search(r"work done|energy transferred", q) and force is not None and distance is not None:
            w = sp.Rational(str(force)) * sp.Rational(str(distance))
            as_json({"category":"numerical_physics","exactAnswer":f"{float(w):.6g} J","symbolicForm":sp.sstr(w),"latex":sp.latex(w) + r"\\text{ J}","numericValue":float(w),"unit":"J","formulaPath":["W = Fd"]})
        elif re.search(r"ohm|resistance|current|voltage", q):
            if voltage is not None and current is not None and re.search(r"resistance|ohm", q):
                r = sp.Rational(str(voltage)) / sp.Rational(str(current))
                as_json({"category":"numerical_physics","exactAnswer":f"{float(r):.6g} ohm","symbolicForm":sp.sstr(r),"latex":sp.latex(r) + r"\\Omega","numericValue":float(r),"unit":"ohm","formulaPath":["V = IR", "R = V/I"]})
            elif current is not None and resistance is not None:
                v = sp.Rational(str(current)) * sp.Rational(str(resistance))
                as_json({"category":"numerical_physics","exactAnswer":f"{float(v):.6g} V","symbolicForm":sp.sstr(v),"latex":sp.latex(v) + r"\\text{ V}","numericValue":float(v),"unit":"V","formulaPath":["V = IR"]})
            else:
                raise ValueError("Unsupported Ohm law shape")
        elif re.search(r"momentum", q) and mass is not None and velocity is not None:
            p = sp.Rational(str(mass)) * sp.Rational(str(velocity))
            as_json({"category":"numerical_physics","exactAnswer":f"{float(p):.6g} kg m/s","symbolicForm":sp.sstr(p),"latex":sp.latex(p) + r"\\text{ kg m s}^{-1}","numericValue":float(p),"unit":"kg m/s","formulaPath":["p = mv"]})
        else:
            raise ValueError("Unsupported numerical physics question")
    else:
        raise ValueError("Unsupported category")
except Exception as exc:
    as_json({"error": str(exc)})
`

  return new Promise((resolve) => {
    const python = process.env.PYTHON || 'python'
    const child = spawn(python, ['-c', script], { windowsHide: true })
    let stdout = ''
    const timer = setTimeout(() => {
      child.kill()
      resolve(null)
    }, 5000)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.on('error', () => {
      clearTimeout(timer)
      resolve(null)
    })
    child.on('close', () => {
      clearTimeout(timer)
      try {
        const parsed = JSON.parse(stdout.trim()) as SympyGroundTruth & { error?: string }
        if (parsed.error) {
          resolve(null)
          return
        }
        resolve(parsed)
      } catch {
        resolve(null)
      }
    })
  })
}

function numericClose(a: number | null | undefined, b: number | null | undefined, tolerance = 0.015) {
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b)) {
    return a == null && b == null
  }
  const scale = Math.max(1, Math.abs(b))
  return Math.abs(a - b) / scale <= tolerance
}

function normalizeUnit(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ω/g, 'ohm')
    .replace(/Ω/g, 'ohm')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeExpression(value: string | null | undefined) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\*\*/g, '^')
    .replace(/\s+/g, '')
    .replace(/sin\(x\)/g, 'sinx')
    .replace(/cos\(x\)/g, 'cosx')
}

function canonicalExpressionTerms(value: string | null | undefined) {
  return normalizeExpression(value)
    .replace(/-/g, '+-')
    .split('+')
    .filter(Boolean)
    .sort()
    .join('+')
}

function extractFirstNumber(value: string) {
  const match = /-?\d+(?:\.\d+)?/.exec(value)
  return match ? Number(match[0]) : null
}

function compareFormulaPath(solverPath: string[] | undefined, truthPath: string[]) {
  const solver = (solverPath ?? []).join(' ').toLowerCase()
  if (!solver.trim()) return false
  const compactSolver = solver.replace(/\s+/g, '')
  const compactTruth = truthPath.join(' ').toLowerCase().replace(/\s+/g, '')
  if (compactTruth.includes('differentiate') && /(productrule|powerrule|dy\/dx|du\/dx|dv\/dx)/.test(compactSolver)) {
    return true
  }
  if (compactTruth.includes('integrate') && /(integrate|integral|antiderivative|powerrule|∫)/.test(compactSolver)) {
    return true
  }
  return truthPath.some((step) => {
    const compactStep = step.toLowerCase().replace(/\s+/g, '')
    if (compactStep.includes('=')) {
      return compactSolver.includes(compactStep.split('=')[0])
    }
    return step
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .some((word) => solver.includes(word))
  })
}

function compareGraphPoints(solverGraph: GraphSpec | null | undefined, truth: SympyGroundTruth | null) {
  if (!truth?.graphPoints) return true
  if (!solverGraph || solverGraph.type !== 'function') return false
  return truth.graphPoints.every((expected) => {
    const actual = solverGraph.points.find((point) => Math.abs(point.x - expected.x) < 0.001)
    return Boolean(actual && numericClose(actual.y, expected.y, 0.005))
  })
}

function inferFailureTypes(
  input: SympyVerificationInput,
  truth: SympyGroundTruth | null,
  comparisons: SympyVerificationResult['comparisons']
): SympyFailureType[] {
  const failures: SympyFailureType[] = []
  if (!truth) return ['unsupported_ground_truth']
  const lower = input.question.toLowerCase()

  if (!comparisons.finalAnswer || !comparisons.numericalValue) {
    if (input.category === 'numerical_physics') failures.push('wrong_formula_selected')
    else if (/differentiat|derivative|dy\/dx/.test(lower)) failures.push('calculus_error')
    else failures.push('algebra_error')
  }
  if (!comparisons.symbolicForm && input.category === 'math') failures.push('algebra_error')
  if (!comparisons.units && input.category === 'numerical_physics') failures.push('unit_conversion_error')
  if (!comparisons.formulaPath) failures.push('missing_step')
  if (!comparisons.latex) failures.push('incorrect_latex')
  if (!comparisons.graph) failures.push('wrong_graph')
  if (!comparisons.markAllocation) failures.push('wrong_mark_allocation')

  return Array.from(new Set(failures))
}

export async function verifyWithSympy(input: SympyVerificationInput): Promise<SympyVerificationResult> {
  const groundTruth = await runPythonGroundTruth({ question: input.question, category: input.category })
  const solverNumber = input.solverNumericValue ?? extractFirstNumber(input.solverAnswer)
  const truthNumber = groundTruth?.numericValue ?? extractFirstNumber(groundTruth?.exactAnswer ?? '')
  const normalizedSolver = normalizeExpression(input.solverAnswer)
  const normalizedTruth = normalizeExpression(groundTruth?.symbolicForm ?? groundTruth?.exactAnswer)
  const canonicalSolver = canonicalExpressionTerms(input.solverAnswer)
  const canonicalTruth = canonicalExpressionTerms(groundTruth?.symbolicForm ?? groundTruth?.exactAnswer)

  const comparisons = {
    finalAnswer: groundTruth
      ? normalizedSolver.includes(normalizedTruth) || numericClose(solverNumber, truthNumber)
      : false,
    symbolicForm: groundTruth?.symbolicForm
      ? normalizedSolver.includes(normalizeExpression(groundTruth.symbolicForm)) ||
        canonicalSolver === canonicalTruth ||
        numericClose(solverNumber, truthNumber)
      : true,
    numericalValue: groundTruth ? numericClose(solverNumber, truthNumber) : false,
    units: groundTruth?.unit ? normalizeUnit(input.solverUnit).includes(normalizeUnit(groundTruth.unit)) : true,
    formulaPath: groundTruth ? compareFormulaPath(input.solverFormulaPath, groundTruth.formulaPath) : false,
    latex: input.category === 'graph' || groundTruth?.latex ? Boolean(input.category === 'graph' || (input.solverLatex && input.solverLatex.length > 0)) : true,
    graph: compareGraphPoints(input.solverGraph, groundTruth),
    markAllocation: (input.solverMarkAllocation?.length ?? 0) > 0,
  }

  const failureTypes = inferFailureTypes(input, groundTruth, comparisons)
  return {
    passed: failureTypes.length === 0,
    failureTypes,
    groundTruth,
    comparisons,
  }
}
