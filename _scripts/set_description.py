#!/usr/bin/env python3
"""Change a tool's short description and search description, in English and Turkish.

    python3 _scripts/set_description.py SLUG "desc" "meta" "Turkish meta" ["Turkish desc"]

desc is the line under the page title and on the home card; meta is the
search and link-preview description. build.py copies both everywhere.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANCHOR = '      "Diff result": "Fark sonucu",\n'


def main():
    if len(sys.argv) not in (5, 6):
        raise SystemExit(__doc__)
    slug, desc, meta, tr_meta = sys.argv[1:5]
    tr_desc = sys.argv[5] if len(sys.argv) == 6 else None
    path = os.path.join(ROOT, '_data', 'tools.json')
    lines = open(path, encoding='utf-8').read().split('\n')
    out, current, old_desc = [], None, None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('"slug": '):
            current = json.loads('{' + stripped.rstrip(',') + '}')['slug']
        if current == slug and stripped.startswith('"meta": '):
            continue
        if current == slug and stripped.startswith('"desc": '):
            old_desc = json.loads('{' + stripped.rstrip(',') + '}')['desc']
            indent = line[:len(line) - len(line.lstrip())]
            out.append(f'{indent}"desc": {json.dumps(desc, ensure_ascii=False)},')
            out.append(f'{indent}"meta": {json.dumps(meta, ensure_ascii=False)},')
            continue
        out.append(line)
    if old_desc is None:
        raise SystemExit(f'No tool "{slug}" in _data/tools.json.')
    text = '\n'.join(out)
    json.loads(text)
    open(path, 'w', encoding='utf-8').write(text)
    seo_path = os.path.join(ROOT, '_data', 'seo-tr.json')
    seo = json.load(open(seo_path, encoding='utf-8'))
    entry = seo[f'tools/{slug}.html']
    entry['source']['description'] = meta
    entry['description'] = tr_meta
    open(seo_path, 'w', encoding='utf-8').write(json.dumps(seo, ensure_ascii=False, indent=2) + '\n')
    if tr_desc:
        exp_path = os.path.join(ROOT, 'assets', 'js', 'core', 'i18n-expansion.js')
        lines = open(exp_path, encoding='utf-8').read().split('\n')
        # The old description's translation goes; the new one is added.
        lines = [line for line in lines if not line.strip().startswith(json.dumps(old_desc, ensure_ascii=False) + ':')]
        text = '\n'.join(lines)
        text = text.replace(ANCHOR, ANCHOR + f'      {json.dumps(desc, ensure_ascii=False)}: {json.dumps(tr_desc, ensure_ascii=False)},\n', 1)
        open(exp_path, 'w', encoding='utf-8').write(text)
    print(f'Updated {slug}; run python3 build.py --all.')


if __name__ == '__main__':
    main()
