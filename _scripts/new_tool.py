#!/usr/bin/env python3
"""Add a tool from one JSON spec: the catalogue entry, its page, and its Turkish
name, description and search metadata.

    python3 _scripts/new_tool.py spec.json

spec.json:
    {
      "entry":   { ...the _data/tools.json entry: slug, name, cat, desc, meta,
                   tags, related, icon, and optionally io and share... },
      "before":  "slug of the conventional tool to insert before",
      "body":    "body.html (the tool's card markup, relative to spec.json)",
      "scripts": ["vendor/pdf-lib.min.js"],   (optional, loaded before the tool's script)
      "turkish": { "name": "...", "desc": "...", "meta": "..." }
    }

Conventional tools must come before the "shell" (expansion) tools in
tools.json, so "before" must name a conventional tool. Afterwards write
assets/js/tools/<slug>.js and its CSS, add the page's strings with
add_translations.py, and run python3 build.py --all.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATE = os.path.join(ROOT, 'tools', 'uuid-validator.html')
TEMPLATE_SLUG = 'uuid-validator'
TEMPLATE_NAME = 'UUID Validator'
TEMPLATE_HEADING = 'uuidValidatorHeading'
EXPANSION_ANCHOR = '      "Diff result": "Fark sonucu",\n'


def read(path):
    with open(path, encoding='utf-8') as handle:
        return handle.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(text)


def insert_entry(entry, before):
    path = os.path.join(ROOT, '_data', 'tools.json')
    lines = read(path).split('\n')
    target = next((i for i, line in enumerate(lines) if line.strip() == f'"slug": "{before}",'), None)
    if target is None:
        raise SystemExit(f'No tool "{before}" in _data/tools.json.')
    if any(line.strip() == f'"slug": "{entry["slug"]}",' for line in lines):
        raise SystemExit(f'"{entry["slug"]}" is already in _data/tools.json.')
    opening = target - 1
    indent = lines[target][:len(lines[target]) - len(lines[target].lstrip())]
    block = [lines[opening]] + [f'{indent}{json.dumps(key)}: {json.dumps(value, ensure_ascii=False)},' for key, value in entry.items()]
    block[-1] = block[-1].rstrip(',')
    block.append(lines[opening][:-1] + '},')
    lines[opening:opening] = block
    text = '\n'.join(lines)
    json.loads(text)
    write(path, text)


def category_label(cat):
    """The breadcrumb label another tool of the same category uses."""
    for name in sorted(os.listdir(os.path.join(ROOT, 'tools'))):
        match = re.search(rf'index\.html#category-{re.escape(cat)}">([^<]+)</a>', read(os.path.join(ROOT, 'tools', name)))
        if match:
            return match.group(1)
    raise SystemExit(f'No published tool in category "{cat}" to take the breadcrumb label from.')


def heading_id(slug):
    parts = slug.split('-')
    return parts[0] + ''.join(part.capitalize() for part in parts[1:]) + 'Heading'


def write_page(entry, body, scripts):
    slug = entry['slug']
    page = read(TEMPLATE)
    template_cat = re.search(r'index\.html#category-([a-z]+)">([^<]+)</a>', page)
    page = page.replace(TEMPLATE_SLUG, slug).replace(TEMPLATE_NAME, entry['name']).replace(TEMPLATE_HEADING, heading_id(slug))
    page = page.replace(f'index.html#category-{template_cat.group(1)}">{template_cat.group(2)}</a>',
                        f'index.html#category-{entry["cat"]}">{category_label(entry["cat"])}</a>')
    start = page.index('<!-- TOOL-HEADER:END -->') + len('<!-- TOOL-HEADER:END -->\n')
    end = page.index('        <!-- RELATED:START -->')
    page = page[:start] + body.rstrip('\n') + '\n' + page[end:]
    # build.py fills these in again: related tools, structured data, cache versions.
    page = re.sub(r'<!-- RELATED:START -->.*?<!-- RELATED:END -->', '<!-- RELATED:START -->\n        <!-- RELATED:END -->', page, flags=re.S)
    page = re.sub(r'  <script type="application/ld\+json">.*?</script>\n', '', page)
    page = re.sub(r'\?v=[0-9a-f]+', '', page)
    tag = f'  <script src="../assets/js/tools/{slug}.js" defer></script>'
    if scripts:
        page = page.replace(tag, ''.join(f'  <script src="../assets/js/{script}" defer></script>\n' for script in scripts) + tag)
    write(os.path.join(ROOT, 'tools', f'{slug}.html'), page)


def add_turkish(entry, turkish):
    path = os.path.join(ROOT, 'assets', 'js', 'core', 'i18n-expansion.js')
    text = read(path)
    lines = ''.join(f'      {json.dumps(key, ensure_ascii=False)}: {json.dumps(value, ensure_ascii=False)},\n'
                    for key, value in ((entry['name'], turkish['name']), (entry['desc'], turkish['desc'])))
    write(path, text.replace(EXPANSION_ANCHOR, EXPANSION_ANCHOR + lines, 1))
    seo_path = os.path.join(ROOT, '_data', 'seo-tr.json')
    seo = json.loads(read(seo_path))
    seo[f'tools/{entry["slug"]}.html'] = {
        'title': f'{turkish["name"]} — Toolkit', 'description': turkish['meta'],
        'source': {'title': f'{entry["name"]} — Toolkit', 'description': entry['meta']}
    }
    write(seo_path, json.dumps(seo, ensure_ascii=False, indent=2) + '\n')


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    spec_path = os.path.abspath(sys.argv[1])
    spec = json.loads(read(spec_path))
    entry = spec['entry']
    body = read(os.path.join(os.path.dirname(spec_path), spec['body']))
    insert_entry(entry, spec['before'])
    write_page(entry, body, spec.get('scripts', []))
    add_turkish(entry, spec['turkish'])
    print(f'Added {entry["slug"]}. Next: assets/js/tools/{entry["slug"]}.js, its strings (add_translations.py), python3 build.py --all.')


if __name__ == '__main__':
    main()
