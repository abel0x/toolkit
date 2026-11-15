#!/usr/bin/env python3
"""Add a release to CHANGELOG.md and to the README (which keeps three releases).

    python3 _scripts/release_notes.py VERSION PREVIOUS changelog.md readme.md

changelog.md is the section body (an intro line, then ### Added / Changed /
Fixed / Tests); readme.md is the one-paragraph summary for the README.
The date is today's.
"""
import datetime
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEEP = 3


def main():
    if len(sys.argv) != 5:
        raise SystemExit(__doc__)
    version, previous, entry_file, readme_file = sys.argv[1:5]
    entry = open(entry_file, encoding='utf-8').read().rstrip('\n') + '\n\n'
    summary = open(readme_file, encoding='utf-8').read().strip()
    today = datetime.date.today().isoformat()
    path = os.path.join(ROOT, 'CHANGELOG.md')
    text = open(path, encoding='utf-8').read()
    if f'## [{version}]' in text:
        raise SystemExit(f'CHANGELOG.md already has {version}.')
    marker = f'## [{previous}] — '
    text = text.replace(marker, f'## [{version}] — {today}\n\n{entry}{marker}', 1)
    link = f'[{previous}]: https://github.com/abel0x/toolkit/compare/'
    text = text.replace(link, f'[{version}]: https://github.com/abel0x/toolkit/compare/v{previous}...v{version}\n{link}', 1)
    open(path, 'w', encoding='utf-8').write(text)
    path = os.path.join(ROOT, 'README.md')
    text = open(path, encoding='utf-8').read()
    start = text.index(f'### Latest release — {previous}')
    end = text.index('Earlier releases are described in the [changelog](CHANGELOG.md).')
    block = text[start:end].replace(f'### Latest release — {previous}', f'### {previous}')
    heads = [index for index in range(len(block)) if block.startswith('### ', index)]
    if len(heads) >= KEEP:
        block = block[:heads[KEEP - 1]]
    text = text[:start] + f'### Latest release — {version}\n\n{summary}\n\n' + block + text[end:]
    open(path, 'w', encoding='utf-8').write(text)
    print(f'CHANGELOG.md and README.md now describe {version} ({today}).')


if __name__ == '__main__':
    main()
