"""Command-line interface for Caspian harmonic analysis tool."""

from __future__ import annotations

import argparse
import sys

from caspian.parsing.input_parser import parse_format_a
from caspian.parsing.registry import get_global_registry
from caspian.analysis.analyzer import analyze_song
from caspian.output.terminal import print_analysis


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="caspian",
        description="Hebrew harmonic analysis tool for Israeli song chord progressions",
    )
    parser.add_argument(
        "input_file",
        nargs="?",
        help="Path to Format A input file (reads from stdin if omitted)",
    )
    parser.add_argument(
        "--no-color",
        action="store_true",
        help="Disable ANSI color output",
    )
    args = parser.parse_args()

    # Read input
    if args.input_file:
        with open(args.input_file, encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    if not text.strip():
        print("Error: empty input", file=sys.stderr)
        sys.exit(1)

    # Parse → Analyze → Print
    # Use registry for auto-detection and parsing
    registry = get_global_registry()
    song_input = registry.parse(text)
    analysis = analyze_song(song_input)
    print_analysis(analysis)


if __name__ == "__main__":
    main()
