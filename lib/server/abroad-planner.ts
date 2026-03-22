import fs from 'node:fs'
import path from 'node:path'

type CityCostRow = {
  id: string
  city: string
  country: string
  avgRentUsd: number
  foodUsd: number
  transportUsd: number
  totalMonthlyCostUsd: number
  sourceKind: string
  caution: string
}

const DATA_PATH = path.join(process.cwd(), 'data', 'abroad_city_cost_seed.jsonl')
let cachedRows: CityCostRow[] | null = null

function readJsonl<T>(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [] as T[]
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getRows() {
  if (cachedRows) {
    return cachedRows
  }

  cachedRows = readJsonl<CityCostRow>(DATA_PATH)
  return cachedRows
}

function detectStage(normalized: string) {
  if (normalized.includes('visa') || normalized.includes('cas') || normalized.includes('proof of funds')) {
    return 'visa_ready'
  }
  if (normalized.includes('offer') || normalized.includes('admit') || normalized.includes('admission')) {
    return 'admitted'
  }
  if (normalized.includes('sop') || normalized.includes('lor') || normalized.includes('application')) {
    return 'applying'
  }
  return 'research'
}

function findCityMatch(normalized: string) {
  return getRows().find((row) => normalized.includes(normalize(row.city)))
}

export function buildAbroadPlan(query: string) {
  const normalized = normalize(query)
  const stage = detectStage(normalized)
  const cityMatch = findCityMatch(normalized)

  const roadmapByStage = {
    research: [
      'Shortlist 3 realistic countries and 5 scholarships by fit, not prestige only.',
      'Check language-test, CGPA, and work-experience requirements early.',
      'Build a draft document map: transcript, passport, CV, SOP, LORs, test scores.',
    ],
    applying: [
      'Freeze your target list and align each SOP to program fit.',
      'Collect final transcripts, passport, and recommendation timelines now.',
      'Create one deadline tracker with scholarship, admission, and test dates.',
    ],
    admitted: [
      'Separate tuition, arrival buffer, and emergency money instead of one mixed number.',
      'Check housing options and first-month landing costs before paying deposits blindly.',
      'Prepare visa-stage documents in the order the destination country expects.',
    ],
    visa_ready: [
      'Recalculate proof-of-funds and arrival buffer using the latest official visa rules.',
      'Make one checklist for bank evidence, passport validity, offer/CAS/I-20, and insurance if needed.',
      'Prepare a first-8-week survival budget without assuming instant part-time work.',
    ],
  } as const

  const arrivalBuffer = cityMatch
    ? Math.round(cityMatch.totalMonthlyCostUsd * 2.5)
    : 2500

  const costRisk =
    cityMatch && cityMatch.totalMonthlyCostUsd >= 1600
      ? 'high'
      : cityMatch && cityMatch.totalMonthlyCostUsd >= 1100
        ? 'medium'
        : 'lower'

  return {
    stage,
    cityMatch:
      cityMatch
        ? {
            city: cityMatch.city,
            country: cityMatch.country,
            avgRentUsd: cityMatch.avgRentUsd,
            foodUsd: cityMatch.foodUsd,
            transportUsd: cityMatch.transportUsd,
            totalMonthlyCostUsd: cityMatch.totalMonthlyCostUsd,
            sourceKind: cityMatch.sourceKind,
            caution: cityMatch.caution,
          }
        : null,
    arrivalBufferUsd: arrivalBuffer,
    costRisk,
    roadmap: roadmapByStage[stage],
    partTimeWarning:
      'Treat part-time work as support money, not the main survival plan for visa or first-month budgeting.',
  }
}
