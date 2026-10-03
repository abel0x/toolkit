#!/usr/bin/env python3
"""Verify published selections against locally downloaded primary-source editions.

This optional release check never fetches data or changes the website. Supply the
NLM desc2026.gz file and Project Gutenberg pg<ID>.txt files downloaded from the
HTTPS URLs recorded in words/*/{medical,quotes}.json. See words/README.md.
"""

import argparse
import gzip
import json
from pathlib import Path
import re
import unicodedata
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]


def normalise_quote(value):
  return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", value).lower())


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--mesh", required=True, type=Path)
  parser.add_argument("--gutenberg-dir", required=True, type=Path)
  args = parser.parse_args()
  medical = json.loads((ROOT / "words/en/medical.json").read_text())
  expected = dict(zip(medical["provenance"]["descriptorIds"], medical["words"], strict=True))
  found = set()
  with gzip.open(args.mesh, "rb") as source:
    for _, record in ET.iterparse(source, events=("end",)):
      if record.tag != "DescriptorRecord":
        continue
      identifier = record.findtext("DescriptorUI")
      if identifier in expected:
        actual = record.findtext("DescriptorName/String").lower()
        assert actual == expected[identifier], (identifier, expected[identifier], actual)
        found.add(identifier)
      record.clear()
  assert found == set(expected), "A published descriptor was not found in the supplied NLM edition."
  english = json.loads((ROOT / "words/en/quotes.json").read_text())["quotes"]
  turkish = json.loads((ROOT / "words/tr/quotes.json").read_text())["quotes"]
  assert len(english) == len(turkish)
  books = {}
  checked = 0
  for index, quote in enumerate(english):
    assert quote["source"] == turkish[index]["source"], "Paired translations must retain their attribution."
    assert quote.get("parts") == turkish[index].get("parts"), "Paired excerpts must have the same base passages."
    if quote.get("parts"):
      continue
    identifier = quote["bookId"]
    assert identifier == turkish[index]["bookId"]
    if identifier not in books:
      raw = (args.gutenberg_dir / f"pg{identifier}.txt").read_text(encoding="utf-8-sig")
      body = re.split(r"\*\*\* START OF[^\n]+\n", raw, maxsplit=1)
      assert len(body) == 2, f"Missing source-edition body: {identifier}"
      books[identifier] = normalise_quote(body[1].split("*** END OF")[0])
    assert normalise_quote(quote["text"]) in books[identifier], (index, quote["source"], quote["text"])
    checked += 1
  print(f"Primary-source audit passed: {len(found)} exact MeSH descriptors, {checked} base passages in {len(books)} editions, {len(english)} paired excerpts. Translation quality still requires editorial review.")


if __name__ == "__main__":
  main()
