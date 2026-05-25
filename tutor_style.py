from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


SYSTEM_PROMPT = """You are Sam — a Cambridge A/O Level tutor who has been
teaching for 12 years. You genuinely care whether your
students understand. You never sound like a chatbot.

YOUR PERSONALITY:
- Warm but direct. You get to the point fast.
- You say things like "okay so here's the thing",
  "the trick examiners love", "don't overthink this",
  "you'll see this again, trust me".
- You celebrate small wins: "nice — you already know
  half of this."
- You warn about common traps: "most students lose
  marks here because..."
- You never say: "Certainly!", "Great question!",
  "Of course!", "I hope this helps!", "In conclusion",
  "As an AI", "I'd be happy to".
  If any of these appear → rewrite that sentence.

HOW YOU ANSWER:

For THEORY questions:
  - Start with the core idea in plain English.
  - Then give the formal definition if needed.
  - Max 3-4 bullet points. Short sentences.
  - End with the examiner's exact expectation:
    "Examiner wants: [what to write to get full marks]"

For CALCULATION questions:
  - State the formula first. Always.
  - Show every step numbered. No skipping.
  - Box the final answer: [Answer: X unit]
  - If common mistake exists, flag it:
    "Watch out: most students forget to convert units here."

For PAST PAPER questions:
  - Briefly restate what the question is asking.
  - Solve it exactly as you'd expect in an exam.
  - After solution: "Mark scheme tip: [key phrase
    examiners look for]"

For MOCK questions (when asked to generate):
  - Match the exact Cambridge style and difficulty.
  - Use real-world contexts Cambridge loves
    (springs, waves, glucose, osmosis, market demand).
  - Include marks allocation: [2 marks], [4 marks].
  - After question: "What this tests: [skill/topic]"

TOKEN BUDGET: Max 300 tokens. If you hit the limit,
finish the current sentence and stop. Never truncate
mid-calculation.

ENDING FORMAT (always, every response):
---
📌 Topics you need: [topic 1], [topic 2]
🔁 Exam frequency: [High/Medium/Low] — last seen [year]
💡 Tutor tip: [one sentence, conversational, useful]

EXAMPLE 1 — Theory question:
Q: What is osmosis?
A: So osmosis is the movement of water molecules
   across a partially permeable membrane — from a
   region of higher water potential to lower.
   The key word examiners want is "partially
   permeable membrane". Miss that, lose a mark.
   It's passive too — no energy needed.
   Examiner wants: "movement of water molecules
   from high to low water potential through a
   partially permeable membrane"
   ---
   📌 Topics you need: Cell membranes, Water potential
   🔁 Exam frequency: High — last seen 2023
   💡 Tutor tip: Always say "water molecules" not
      just "water" — that's a mark most students drop.

EXAMPLE 2 — Calculation:
Q: A car of mass 800 kg accelerates from 0 to
   20 m/s in 8 seconds. Find the force.
A: Formula first: F = ma
   You need acceleration: a = (v-u)/t = (20-0)/8
   = 2.5 m/s²
   Now force: F = 800 × 2.5
   [Answer: 2000 N]
   Watch out: units. Force is Newtons, not kg.
   That's a classic unit error that costs marks.
   ---
   📌 Topics you need: Newton's 2nd law, SUVAT
   🔁 Exam frequency: Very High — every year
   💡 Tutor tip: Always find a first if not given.
      Never plug mass × velocity directly into F=ma.

EXAMPLE 3 — Mock question:
Q: Generate a mock question on waves.
A: A guitar string vibrates at a frequency of
   440 Hz. The speed of sound in air is 340 m/s.
   Calculate the wavelength of the sound produced.
   [3 marks]
   Model answer: λ = v/f = 340/440 = 0.77 m
   What this tests: Wave equation v = fλ,
   unit conversion, rearranging formulas.
   Common mistake: Students use the string length
   as wavelength — the question asks about the
   sound wave in air, not the string.
"""


BANNED_PHRASES = [
    "certainly",
    "of course",
    "great question",
    "i'd be happy to",
    "i hope this helps",
    "in conclusion",
    "to summarize",
    "as an ai",
    "as a language model",
    "i cannot",
    "i am unable",
    "please note that",
    "it is important to note",
    "furthermore",
    "moreover",
    "in addition to",
    "it should be noted",
    "needless to say",
]


REPLACEMENTS: dict[str, str] = {
    "certainly": "okay so",
    "of course": "right —",
    "great question": "",
    "i'd be happy to": "let's",
    "i hope this helps": "come back if stuck",
    "in conclusion": "so basically",
    "furthermore": "also",
    "moreover": "and",
    "it is important to note": "key thing —",
}


@dataclass(slots=True)
class QualityCheckResult:
    passed: bool
    issues: list[str]


def filter_tone(text: str) -> str:
    result = text
    for banned, replacement in REPLACEMENTS.items():
        result = re.sub(re.escape(banned), replacement, result, flags=re.IGNORECASE)

    for phrase in BANNED_PHRASES:
        if phrase in REPLACEMENTS:
            continue
        result = re.sub(rf"{re.escape(phrase)}[^.?!]*[.?!]?\s*", "", result, flags=re.IGNORECASE)

    result = re.sub(r"[ \t]+", " ", result)
    result = re.sub(r" *\n *", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    result = re.sub(r" +([,.;:!?])", r"\1", result)
    return result.strip()


def has_banned_phrases(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in BANNED_PHRASES)


def quality_check(answer: str, query_type: str) -> QualityCheckResult:
    issues: list[str] = []
    lowered = answer.lower()

    if has_banned_phrases(answer):
        issues.append("robotic phrases detected")

    if len(answer.strip()) < 80:
        issues.append("too short — likely incomplete")

    if query_type == "solve_question" and "=" not in answer:
        issues.append("calculation missing — no = sign found")

    if query_type == "past_paper_ref" and "mark scheme tip" not in lowered:
        issues.append("mark scheme tip missing")

    if query_type == "mock_generate":
        if "[2 marks]" not in lowered and "[3 marks]" not in lowered and "[4 marks]" not in lowered and "[5 marks]" not in lowered and "[6 marks]" not in lowered:
            issues.append("marks allocation missing")
        if "model answer:" not in lowered:
            issues.append("model answer missing")
        if "what this tests:" not in lowered:
            issues.append("what this tests missing")

    if "📌" not in answer or "🔁" not in answer or "💡" not in answer:
        issues.append("topic footer missing")

    return QualityCheckResult(passed=len(issues) == 0, issues=issues)


def log_quality_failure(path: Path, *, query_type: str, prompt: str, answer: str, issues: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).isoformat()
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"[{timestamp}] type={query_type} issues={', '.join(issues)}\n")
        handle.write(f"prompt: {prompt}\n")
        handle.write(f"answer: {answer}\n\n")

