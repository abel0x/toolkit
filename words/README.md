# Word lists

`words/` is a dependency-free, reusable data layer for browser tools. A consumer reads `manifest.json` first, then lazily fetches only the selected list. All paths in the manifest are relative to this directory.

## Schema

The manifest has a `schemaVersion`, generation date, and language records. Each category has a stable kebab-case `id`, relative `file`, English source `label`, `group`, `type`, exact `count`, and integer `order`. Labels and groups are i18n source keys; add their Turkish values in `assets/js/core/i18n-expansion.js`.

Each word-list JSON file contains `schemaVersion`, `id`, `language`, `label`, `type`, `license`, `source`, `provenance`, `meta`, and either `words` or `quotes`. `provenance` records a controlled `method`, an ISO `reviewed` date, and one or more HTTPS source URLs; it describes how the pool was produced without implying that an editorially reviewed list was copied from its reference. A normal list has a flat `words` array. Quote lists use objects with `text`, `source`, and accurate `length` fields. A base passage also has its Project Gutenberg `bookId`; a combined excerpt has `parts`, the indices of its verified base passages in the same list. The English and Turkish lists have aligned indices and attributions. The English medical list additionally stores a parallel `provenance.descriptorIds` array with NLM identifiers. Every quote `source` names the literary author and the work (or clearly identifies a curated excerpt); the typing test renders that attribution below the passage and in the results view. `meta` records exact average and maximum entry lengths plus whether diacritics or multi-word entries are present.

## Adding a category

1. Add a UTF-8, LF-terminated, two-space JSON file under `words/en/` or `words/tr/`.
2. Register it in `manifest.json` with an immutable id and accurate count.
3. Add Turkish translations for its English label and group.
4. Run `python3 build.py --words` and `node tests/words-audit.mjs`.

Do not make an existing id mean something different. Keep word entries NFC-normalised, unique under the content locale, neutral, and free of hidden whitespace. Ordinary entries are one to 24 characters; only lists marked `hasMultiWordEntries` may use single ASCII spaces. Quotes must be 40 to 260 characters.

## Sources and licences

The common-word pools are independently curated typing vocabulary rather than claims to reproduce a proprietary ranking. English coverage is reviewed against the public-domain [Moby Words II frequency list](https://www.gutenberg.org/ebooks/3201). Turkish coverage is cross-checked against the Ministry of National Education's official [target-word and target-action lists](https://hakkari.meb.gov.tr/meb_iys_dosyalar/2015_01/23101147_09052705_lkokumayazmahazrlakeitimiplanveklavuzkitab.pdf), while current spelling is reviewed against the [TDK Güncel Türkçe Sözlük](https://sozluk.gov.tr/) and [Yazım Kılavuzu](https://yazim.tdk.gov.tr/). These official references are used only for editorial coverage and spelling review; the repository does not reproduce their rows or frequency order. English country and city names are reviewed against [United Nations M49](https://unstats.un.org/unsd/methodology/m49/) and [UN DESA World Urbanization Prospects](https://population.un.org/wup/). The 81 Turkish provinces and representative district sample are reviewed against the [Ministry of Interior province and district register](https://www.icisleri.gov.tr/kurumlar/icisleri.gov.tr/IcSite/illeridaresi/%C4%B0statistiki%20Bilgiler/%C4%B0l%20%C4%B0daresi%20ve%20M%C3%BClki%20B%C3%B6l%C3%BCmler/yillara%20gore%20kurulan%20il%20ilce%20sayilari_3.pdf).

The English medical list uses exact descriptor names from [NLM Medical Subject Headings (MeSH) Descriptor Data 2026](https://www.nlm.nih.gov/databases/download/mesh.html), with their descriptor IDs retained. **Courtesy of the U.S. National Library of Medicine.** This is a static 2026 selection, not the most current or complete NLM data, and neither this tool nor its scores are endorsed by NLM. Follow the [NLM Terms and Conditions](https://www.nlm.nih.gov/databases/download/terms_and_conditions.html); do not relabel these records as CC0. The Turkish medical list is independently curated clinical vocabulary under CC0, using [Ministry of Health ICD-10 terminology material](https://shgmsgudb.saglik.gov.tr/TR,6220/icd-10-trm-hastalik-ve-saglik-girisimi-siniflandirma-sistemleri-gelistirilmesi.html) and the [Sakarya Training and Research Hospital health glossary](https://sakaryaeah.saglik.gov.tr/TR-1072170/saglik-sozlugu.html) as editorial references. The unverified Wikidata import and mechanically combined medical roots/suffixes have been removed. No official database rows or definitions are copied into the Turkish pool. The English finance and legal lists contain selected term labels from the [U.S. Securities and Exchange Commission's Investor.gov glossary](https://www.investor.gov/introduction-investing/investing-basics/glossary) and official [United States Code editions on GovInfo](https://www.govinfo.gov/app/collection/uscode); they use only term labels, not definitions. The Turkish finance and legal lists are extracted from officially published legislation available through the [Grand National Assembly of Türkiye](https://www.tbmm.gov.tr/Yasama/Kanunlar), which may be reproduced under FSEK Article 31. The Turkish programming list is independently curated and reviewed against [BTK Akademi terminology material](https://files.btkakademi.gov.tr/307_DOKUMAN_TURLERI_VE_VERI_FORMATLARI/Terimler_Sozlugu.pdf) and [W3C Web platform documentation](https://www.w3.org/TR/). It contains no copied rows, definitions, or prose.

The `quotes` lists contain only public-domain literary passages by named authors. Each retained English base passage is matched, after punctuation and line-break normalisation, against a specific [Project Gutenberg](https://www.gutenberg.org/) edition listed in `provenance.sources`. The September 26 review corrected wrong work titles and removed sayings not found in the cited editions; a missing match is a reason not to publish that attribution, not proof that the author never said it. Turkish versions are original Toolkit translations of the same passages; no modern published translation is copied. There are 66 distinct base passages and 80 explicitly labelled combinations per language, for 146 selectable entries. These are **not 146 unrelated sayings**. Every combined entry names its works and refers back to two or three base passages by the same author. Both languages retain at least 40 entries in each length band. `idioms` is a separate, non-attributed category in both languages: the English pool is editorially checked against [Merriam-Webster's idiom entries](https://www.merriam-webster.com/), and the Turkish pool against the [TDK Atasözleri ve Deyimler Sözlüğü](https://sozluk.gov.tr/). These lists store only short expressions, never definitions or explanatory prose.

Prefer primary official publishers and sources with an explicit redistribution basis. A government or institution domain alone is not a licence: do not bulk-copy a source unless its terms permit static redistribution, or a specific legal reuse rule applies. Do not use GitHub, GitLab, Bitbucket, or another code-hosting repository as the source of word-list entries. Record the primary source, licence, review date, and whether entries were copied, transformed, or editorially checked in every JSON file. Do not copy copyrighted prose into quote lists. Do not use anonymous motivational copy, fabricated attributions, or a quote without an author/work field. A long entry may combine short passages from the same named public-domain author only when its `source` says that it is a curated excerpt.

## Review and refresh policy

The `common-*` categories are static, neutral typing-practice pools. Their labels communicate practical high-frequency vocabulary; they are not a live reproduction of a proprietary corpus ranking. A corpus reference may be used for editorial review, but its raw rows must not be copied unless its redistribution licence is compatible with this directory.

Review geographical names against an authoritative publisher before each release that changes them. For Turkey, use the Ministry of Interior's current governorates and district offices listing; it currently reports 81 provinces and 922 districts. A district list in this repository is explicitly a representative practice sample, not a claim to be the complete administrative register. Review broad international city and country names against a source with a documented redistribution licence.

Every new or materially refreshed list must record the source description, output licence, review date, production method, and source URLs. Use one of the audited provenance methods: `editorially-reviewed`, `transformed`, `public-domain-selection`, or `original-translation`. Do not use an ambiguous "compiled" source description. If a source is not compatible with static redistribution, use it only to review an independently curated pool and say so plainly.

Counts are quality floors, not targets to reach with synthetic forms or unsupported attributions. The September 26 removal of unverified data deliberately lowered the Turkish medical/idiom and quote floors; source-identity and excerpt-composition checks were added at the same time.

The complete payload must remain below 500 KB and no file may exceed 80 KB. The audit enforces these limits, manifest references, formatting, normalisation, duplicate detection, metadata accuracy, and basic content-safety checks.

## Current catalogue (2026-09-26)

| Category | English | Turkish |
| --- | ---: | ---: |
| Common 200 | 200 | 200 |
| Common 1000 | 1,000 | 1,000 |
| Cities / provinces | 240 | 81 |
| Countries / districts | 196 | 300 |
| Medical | 1,300 | 546 |
| Legal | 594 | 650 |
| Finance | 597 | 503 |
| Programming | 431 | 446 |
| Idioms | 339 | 331 |
| Literary excerpts | 146 | 146 |
| **Total** | **5,043** | **4,203** |

These totals count entries in files, including the intentional common-200/common-1000 overlap. Multi-word entries are phrases, not single words. The country pool uses familiar English labels, including shortened labels where necessary to respect the 24-character entry limit; it is not a United Nations membership register.

## Reproducible source checks

Run the ordinary structural audit without network access:

```bash
node tests/words-audit.mjs
```

For a release that changes medical descriptors or quotations, download the NLM `desc2026.gz` file from its recorded URL and the public-domain `pg<ID>.txt` editions referenced by the quote `bookId` values into a temporary directory **outside the repository**. Text-edition URLs follow `https://www.gutenberg.org/cache/epub/<ID>/pg<ID>.txt`. Then run:

```bash
python3 tests/word-sources-audit.py --mesh /absolute/path/desc2026.gz --gutenberg-dir /absolute/path/editions
```

The check is read-only and uses the Python standard library. It verifies all 1,300 English medical word/ID pairs, all 66 base passages against the bodies of 25 named editions, and the English/Turkish attribution/reference pairing. CI separately verifies each combined excerpt against its base passages. A published site's typing tool never contacts these sources.

A schema test cannot certify spelling, clinical appropriateness, the meaning of a translation, or the historical authorship of every quoted sentence. The Turkish medical pool and other editorial lists still need human linguistic/domain review when changed. Source matching establishes that text appears in an edition; it is not institutional endorsement, medical advice, or an assertion that a character's words express the author's personal beliefs. Do not claim that all lists are officially certified or that automated checks prove the absence of every possible error.
