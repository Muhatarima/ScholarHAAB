import sys
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from scripts.pattern_brain import *  # noqa: F401,F403
