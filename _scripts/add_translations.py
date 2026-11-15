#!/usr/bin/env python3
"""Add Turkish strings to the dictionaries, skipping keys that already exist.

    python3 _scripts/add_translations.py strings.json [--patterns patterns.js] [--samples]

strings.json maps English text to Turkish. --patterns adds translatePattern
rules (JavaScript lines: match = key.match(...); if (match) return ...;) for
text built from variables. --samples adds example starter names, which the
site audit expects as single-quoted keys.
"""
import argparse
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORE = os.path.join(ROOT, 'assets', 'js', 'core', 'i18n-tr.js')
EXPANSION = os.path.join(ROOT, 'assets', 'js', 'core', 'i18n-expansion.js')
STRING_ANCHOR = '      "Diff result": "Fark sonucu",\n'
SAMPLE_ANCHOR = "      'Visa test card': 'Visa test kartı',\n"
PATTERN_ANCHOR = "    match = key.match(/^(\\d+) matches?$/);"


def read(path):
    with open(path, encoding='utf-8') as handle:
        return handle.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(text)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('strings')
    parser.add_argument('--patterns')
    parser.add_argument('--samples', action='store_true')
    args = parser.parse_args()
    entries = json.loads(read(args.strings))
    core = read(CORE)
    expansion = read(EXPANSION)

    def known(key):
        return re.search(r'["\']' + re.escape(key).replace("'", "(?:'|\\\\')") + r'["\']\s*:', core + expansion) is not None

    if args.samples:
        bad = [key for key, value in entries.items() if "'" in key + value]
        if bad:
            raise SystemExit(f'Sample names cannot contain a straight apostrophe: {bad}')
        lines = ''.join(f"      '{key}': '{value}',\n" for key, value in entries.items() if not known(key))
        expansion = expansion.replace(SAMPLE_ANCHOR, lines + SAMPLE_ANCHOR, 1)
    else:
        lines = ''.join(f'      {json.dumps(key, ensure_ascii=False)}: {json.dumps(value, ensure_ascii=False)},\n'
                        for key, value in entries.items() if not known(key))
        expansion = expansion.replace(STRING_ANCHOR, STRING_ANCHOR + lines, 1)
    write(EXPANSION, expansion)
    if args.patterns:
        if core.count(PATTERN_ANCHOR) != 1:
            raise SystemExit('The pattern anchor in i18n-tr.js has moved; update PATTERN_ANCHOR.')
        patterns = read(args.patterns).rstrip('\n') + '\n'
        write(CORE, core.replace(PATTERN_ANCHOR, patterns + PATTERN_ANCHOR, 1))
    print(f'{lines.count(chr(10))} new strings added; run python3 build.py --all.')


if __name__ == '__main__':
    main()
