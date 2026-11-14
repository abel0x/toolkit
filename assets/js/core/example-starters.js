/* Ready-made, local examples for first-time tool exploration. */

(function initExampleStarters() {
  'use strict';

  const examples = Object.freeze({
    base64: [
      { name: 'Friendly hello', values: { '#b64Input': 'Hello, curious human!' }, action: '#b64EncodeBtn' },
      { name: 'Tiny weather note', values: { '#b64Input': 'Sunny in Istanbul; tea recommended.' }, action: '#b64EncodeBtn' }
    ],
    base32: [
      { name: 'Pocket compass', values: { '#base32Input': 'North, snacks, and a small adventure.' }, action: '#base32EncodeBtn' },
      { name: 'Robot postcard', values: { '#base32Input': 'Beep boop! Greetings from Toolkit.' }, action: '#base32EncodeBtn' }
    ],
    hash: [
      { name: 'Secret garden', values: { '#hashInput': 'violets grow quietly after midnight' }, action: '#hashGenBtn' },
      { name: 'Snack order', values: { '#hashInput': 'two simits, one tea, extra sesame' }, action: '#hashGenBtn' }
    ],
    regex: [
      { name: 'Email parade', values: { '#regexPattern': '[\\w.+-]+@[\\w-]+\\.[\\w.-]+', '#regexFlags': 'g', '#regexTest': 'ada@example.com, lin@toolkit.dev, and not-an-email' } },
      { name: 'Release notes', values: { '#regexPattern': 'v\\d+\\.\\d+\\.\\d+', '#regexFlags': 'g', '#regexTest': 'Shipped v1.2.0, then planned v1.3.0 and v2.0.0.' } }
    ],
    'url-codec': [
      { name: 'Istanbul picnic', values: { '#urlInput': 'https://example.com/search?q=çay & simit&city=İstanbul' }, action: '#urlEncodeBtn' },
      { name: 'Emoji postcard', values: { '#urlInput': 'Hello from Toolkit ✨ with spaces' }, action: '#urlEncodeBtn' }
    ],
    'query-string': [
      { name: 'Weekend search', values: { '#qsParseInput': '?city=Istanbul&drink=tea&snacks=simit%20and%20cheese' } },
      { name: 'Tiny campaign', values: { '#qsParseInput': '?utm_source=moonlight&utm_medium=postcard&utm_campaign=curious-tools' } }
    ],
    'json-formatter': [
      { name: 'Pocket profile', values: { '#jsonInput': '{"name":"Mira","level":7,"snacks":["fig","tea"],"curious":true}' }, action: '#jsonBeautifyBtn' },
      { name: 'Space launch', values: { '#jsonInput': '{"mission":"Comet Tea","crew":3,"launch":"06:45","ready":true}' }, action: '#jsonBeautifyBtn' }
    ],
    'json-validator': [
      { name: 'Tiny recipe', values: { '#jval-input': '{"recipe":"Midnight toast","minutes":4,"ingredients":["bread","honey"]}' }, action: '#jval-btn' },
      { name: 'Desk plant', values: { '#jval-input': '{"plant":"Pothos","water":"Friday","sun":"gentle"}' }, action: '#jval-btn' }
    ],
    'json-minifier': [
      { name: 'Mini playlist', values: { '#jmin-input': '{\n  "playlist": "Focus mode",\n  "tracks": 12,\n  "mood": "bright"\n}' }, action: '#jmin-btn' },
      { name: 'Travel checklist', values: { '#jmin-input': '{\n  "passport": true,\n  "charger": true,\n  "snacks": ["nuts", "fruit"]\n}' }, action: '#jmin-btn' }
    ],
    'json-sorter': [
      { name: 'Fruit basket', values: { '#jsort-input': '{"zebra":1,"apple":2,"mango":3,"banana":4}' }, action: '#jsort-btn' },
      { name: 'Tiny config', values: { '#jsort-input': '{"theme":"night","autosave":true,"fontSize":16,"language":"en"}' }, action: '#jsort-btn' }
    ],
    'json-to-yaml': [
      { name: 'Robot profile', values: { '#j2y-input': '{"robot":"Nora","battery":86,"tasks":["wave","organise","tea"]}' }, action: '#j2y-btn' },
      { name: 'Reading nook', values: { '#j2y-input': '{"lamp":"warm","books":5,"blanket":true,"tea":"earl grey"}' }, action: '#j2y-btn' }
    ],
    'csv-to-json': [
      { name: 'Studio roster', values: { '#csv2j-input': 'name,role,superpower\nAda,Designer,Color sense\nLin,Developer,Fast keyboard\nMira,Writer,Good questions' }, action: '#csv2j-btn' },
      { name: 'Movie night', values: { '#csv2j-input': 'title,minutes,snack\nMoonlight,111,Popcorn\nArrival,116,Tea\nKiki,103,Toast' }, action: '#csv2j-btn' }
    ],
    markdown: [
      { name: 'Tiny adventure', values: { '#mdInput': '# A tiny adventure\n\nPack **tea**, a map, and one good question.\n\n- Follow the blue door\n- Say hello to the cat\n- Celebrate with `simit`\n\n> Curiosity is excellent luggage.' } },
      { name: 'Recipe card', values: { '#mdInput': '## Cloudy-day toast\n\n1. Toast bread\n2. Add honey and cinnamon\n3. Enjoy near a window\n\n`Mood: restored`' } }
    ],
    'meta-tags': [
      { name: 'Moonlight café', values: { '#metaTitle': 'Moonlight Café — Late Tea and Good Ideas', '#metaDesc': 'A small imaginary café for tea, notebooks, and curious conversations.', '#metaKw': 'tea, café, notebooks', '#metaAuthor': 'Toolkit Studio', '#metaCanon': 'https://example.com/moonlight-cafe', '#metaOgTitle': 'Moonlight Café', '#metaOgDesc': 'Late tea and good ideas.', '#metaOgImage': 'https://example.com/images/moonlight-cafe.png', '#metaOgSite': 'Moonlight Café', '#metaTwitter': '@moonlightcafe' } },
      { name: 'Pocket museum', values: { '#metaTitle': 'Pocket Museum — Small Objects, Big Stories', '#metaDesc': 'A playful collection of objects worth looking at twice.', '#metaKw': 'museum, objects, stories', '#metaAuthor': 'Toolkit Studio', '#metaCanon': 'https://example.com/pocket-museum', '#metaOgTitle': 'Pocket Museum', '#metaOgDesc': 'Small objects, big stories.', '#metaOgImage': 'https://example.com/images/pocket-museum.png', '#metaOgSite': 'Pocket Museum', '#metaTwitter': '@pocketmuseum' } }
    ],
    'open-graph': [
      { name: 'Tea journal', values: { '#ogTitle': 'Tea Journal', '#ogDesc': 'A small notebook for memorable cups of tea.', '#ogUrl': 'https://example.com/tea-journal', '#ogImage': 'https://example.com/images/tea-journal.png', '#ogSite': 'Tea Journal', '#twHandle': '@teajournal' } },
      { name: 'Quiet library', values: { '#ogTitle': 'Quiet Library', '#ogDesc': 'Stories, notes, and a very comfortable chair.', '#ogUrl': 'https://example.com/quiet-library', '#ogImage': 'https://example.com/images/quiet-library.png', '#ogSite': 'Quiet Library', '#twHandle': '@quietlibrary' } }
    ],
    'xml-formatter': [
      { name: 'Garden catalogue', values: { '#xml-input': '<garden>\n  <plant type="herb">mint</plant>\n  <plant type="flower">violet</plant>\n</garden>' }, action: '#xml-format-btn' },
      { name: 'Train timetable', values: { '#xml-input': '<trains><train time="09:15" destination="Coast"/><train time="10:40" destination="Hills"/></trains>' }, action: '#xml-format-btn' }
    ],
    'yaml-to-json': [
      { name: 'Morning plan', values: { '#y2j-input': 'day: Saturday\nbreakfast: simit\nplans:\n  - read\n  - walk\n  - call a friend' }, action: '#y2j-btn' },
      { name: 'Tiny server', values: { '#y2j-input': 'server:\n  host: localhost\n  port: 8080\n  cache: true' }, action: '#y2j-btn' }
    ],
    'json-to-csv': [
      { name: 'Studio library', values: { '#j2csv-input': '[{"title":"The Map","pages":124,"shelf":"A"},{"title":"Night Tea","pages":88,"shelf":"B"}]' }, action: '#j2csv-btn' },
      { name: 'Weekend market', values: { '#j2csv-input': '[{"item":"figs","price":6,"stock":12},{"item":"tea","price":4,"stock":20}]' }, action: '#j2csv-btn' }
    ],
    'sql-formatter': [
      { name: 'Book shelf', values: { '#sql-input': 'select title, author from books where year >= 2020 order by title asc;' }, action: '#sql-btn' },
      { name: 'Tea orders', values: { '#sql-input': 'select customer, count(*) as cups from orders where drink = \'tea\' group by customer having count(*) > 1;' }, action: '#sql-btn' }
    ],
    'html-minifier': [
      { name: 'Picnic card', values: { '#hmin-input': '<!-- A tiny invitation -->\n<section class="picnic">\n  <h1>Meet at the park</h1>\n  <p>Bring tea and a blanket.</p>\n</section>' }, action: '#hmin-btn' },
      { name: 'Tiny profile', values: { '#hmin-input': '<div class="profile">\n  <strong>Mira</strong>\n  <span>Collector of good questions</span>\n</div>' }, action: '#hmin-btn' }
    ],
    'css-minifier': [
      { name: 'Night card', values: { '#cssmin-input': '/* A calm card */\n.card {\n  padding: 1rem;\n  border-radius: 0.75rem;\n  color: white;\n}' }, action: '#cssmin-btn' },
      { name: 'Button states', values: { '#cssmin-input': '.button { padding: 0.5rem 1rem; }\n.button:hover { transform: translateY(-1px); }' }, action: '#cssmin-btn' }
    ],
    'js-minifier': [
      { name: 'Greeting machine', values: { '#jsmin-input': '// A friendly greeting\nfunction greet(name) {\n  const message = `Hello, ${name}!`;\n  return message;\n}' }, action: '#jsmin-btn' },
      { name: 'Counter note', values: { '#jsmin-input': '/* Count small wins */\nlet wins = 0;\nwins += 1;\nconsole.log(wins);' }, action: '#jsmin-btn' }
    ],
    'url-parser': [
      { name: 'Event map', values: { '#urlInput': 'https://events.example.com/autumn/tea?guests=4&music=soft#schedule' }, action: '#parseBtn' },
      { name: 'Recipe link', values: { '#urlInput': 'https://cook.example.com/recipes/cloudy-toast?servings=2&sweet=true#ingredients' }, action: '#parseBtn' }
    ],
    'url-builder': [
      { name: 'Reading club', urlBuilder: { base: 'https://example.com', paths: ['clubs', 'reading'], params: [['month', 'september'], ['tea', 'yes']], hash: 'welcome' } },
      { name: 'Garden path', urlBuilder: { base: 'https://example.com', paths: ['garden', 'herbs'], params: [['season', 'spring'], ['open', 'true']], hash: 'mint' } }
    ],
    'user-agent': [
      { name: 'Pocket browser', values: { '#uaInput': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' }, action: '#uaParseBtn' },
      { name: 'Desktop explorer', values: { '#uaInput': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }, action: '#uaParseBtn' }
    ],
    'text-diff': [
      { name: 'Before launch', values: { '#diffA': 'Pack the map\nBring tea\nMeet at nine', '#diffB': 'Pack the map\nBring warm tea\nMeet at ten' }, action: '#diffCompareBtn' },
      { name: 'Updated note', values: { '#diffA': 'The blue door opens quietly.\nThe cat waits nearby.', '#diffB': 'The green door opens quietly.\nThe cat is already inside.' }, action: '#diffCompareBtn' }
    ],
    'find-replace': [
      { name: 'Tea swap', values: { '#fr-find': 'tea', '#fr-replace': 'coffee', '#fr-input': 'Tea is ready.\nOne tea for Mira, one tea for Lin.\nSave the last tea for later.' }, action: '#fr-replace-btn' },
      { name: 'Name badges', values: { '#fr-find': 'guest', '#fr-replace': 'friend', '#fr-input': 'guest one\nguest two\nguest three' }, action: '#fr-replace-btn' }
    ],
    'text-sorter': [
      { name: 'Fruit shelf', values: { '#ts-input': 'pear\nfig\napple\norange\nplum' }, action: '#ts-sort-btn' },
      { name: 'Scoreboard', values: { '#ts-input': '42\n7\n19\n3\n28' }, action: '#ts-sort-btn' }
    ],
    'word-counter': [
      { name: 'Tiny manifesto', values: { '#wc-input': 'Make useful things. Keep them clear. Leave room for curiosity.' } },
      { name: 'Calm paragraph', values: { '#wc-input': 'A quiet afternoon can hold a walk, a notebook, and one excellent cup of tea. Small rituals make room for better ideas.' } }
    ],
    'json-diff': [
      { name: 'Garden update', values: { '#jdiff-a': '{"plants":["mint","violet"],"open":true,"visitors":12}', '#jdiff-b': '{"plants":["mint","sage","violet"],"open":false,"visitors":18}' }, action: '#jdiff-btn' },
      { name: 'Team change', values: { '#jdiff-a': '{"name":"Orion","members":3,"remote":false}', '#jdiff-b': '{"name":"Orion","members":4,"remote":true,"channel":"design"}' }, action: '#jdiff-btn' }
    ],
    'csp-generator': [
      { name: 'Locked-down site', values: { '#cspDirectives': 'default-src \'self\'\nbase-uri \'self\'\nobject-src \'none\'\nframe-ancestors \'none\'\nimg-src \'self\' data:\nstyle-src \'self\'\nscript-src \'self\'' }, action: '#cspBuild' },
      { name: 'Image-friendly page', values: { '#cspDirectives': 'default-src \'self\'\nimg-src \'self\' data: https://images.example.com\nstyle-src \'self\' \'unsafe-inline\'\nfont-src \'self\'\nobject-src \'none\'' }, action: '#cspBuild' }
    ],
    'curl-builder': [
      { name: 'Create a note', values: { '#curlMethod': 'POST', '#curlUrl': 'https://api.example.com/notes', '#curlHeaders': 'Authorization: Bearer demo-token\nContent-Type: application/json', '#curlBody': '{"title":"Tea note","done":false}' }, action: '#curlBuild' },
      { name: 'Search catalogue', values: { '#curlMethod': 'GET', '#curlUrl': 'https://api.example.com/books?tag=travel&limit=3', '#curlHeaders': 'Accept: application/json', '#curlBody': '' }, action: '#curlBuild' }
    ],
    'http-header-analyzer': [
      { name: 'Hardened response', values: { '#headerInput': 'HTTP/2 200 OK\nContent-Security-Policy: default-src \'self\'\nStrict-Transport-Security: max-age=31536000; includeSubDomains\nX-Content-Type-Options: nosniff\nReferrer-Policy: strict-origin-when-cross-origin\nPermissions-Policy: camera=(), microphone=()' }, action: '#headerAnalyze' },
      { name: 'Bare response', values: { '#headerInput': 'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\nCache-Control: no-cache' }, action: '#headerAnalyze' }
    ],
    'cron-assistant': [
      { name: 'Weekday report', values: { '#cronInput': '0 9 * * 1-5' }, action: '#cronRun' },
      { name: 'Sunday backup', values: { '#cronInput': '30 2 * * 0' }, action: '#cronRun' }
    ],
    'unix-permissions': [
      { name: 'Shared script', values: { '#permOctal': '755' } },
      { name: 'Private note', values: { '#permOctal': '600' } }
    ],
    'css-specificity': [
      { name: 'Card title', values: { '#specificityInput': '#app .card[data-state="open"] > h2::before' }, action: '#specificityRun' },
      { name: 'Navigation item', values: { '#specificityInput': 'nav.main a:hover:not(.is-muted)' }, action: '#specificityRun' }
    ],
    'json-to-typescript': [
      { name: 'Team profile', values: { '#tsInput': '{"team":"Orion","members":[{"name":"Mira","role":"Designer"}],"remote":true}' }, action: '#tsRun' },
      { name: 'Product shelf', values: { '#tsInput': '{"id":7,"title":"Pocket Atlas","price":14.5,"tags":["travel","paper"]}' }, action: '#tsRun' }
    ],
    'json-to-markdown': [
      { name: 'Workshop roster', values: { '#markdownJsonInput': '[{"name":"Mira","seat":2,"tea":"mint"},{"name":"Lin","seat":5,"tea":"black"}]' }, action: '#markdownJsonRun' },
      { name: 'Tiny inventory', values: { '#markdownJsonInput': '[{"item":"notebook","stock":8,"aisle":"A"},{"item":"pencil","stock":24,"aisle":"B"}]' }, action: '#markdownJsonRun' }
    ],
    'xml-to-json': [
      { name: 'Book collection', values: { '#xmlJsonInput': '<books><book id="1"><title>Night Tea</title><pages>88</pages></book><book id="2"><title>The Map</title><pages>124</pages></book></books>' }, action: '#xmlJsonRun' },
      { name: 'Garden stock', values: { '#xmlJsonInput': '<garden season="spring"><plant>mint</plant><plant>violet</plant></garden>' }, action: '#xmlJsonRun' }
    ],
    'csv-viewer': [
      { name: 'Workshop seats', values: { '#csvViewerInput': 'name,seat,drink\nMira,2,mint tea\nLin,5,black tea\nAda,7,water' }, action: '#csvViewerRun' },
      { name: 'Tea shelf', values: { '#csvViewerInput': 'tea,origin,stock\nEarl Grey,India,12\nJasmine,China,8\nMint,Turkey,16' }, action: '#csvViewerRun' }
    ],
    'jwt-decoder': [
      { name: 'Designer badge', values: { '#jwtInput': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJtaXJhIiwibmFtZSI6Ik1pcmEgVGVhIiwicm9sZSI6ImRlc2lnbmVyIiwiaWF0IjoxNzY3MjI1NjAwLCJleHAiOjE3OTg3NjE2MDB9.mSig8FydfX_JV4csPEtr0ApHw5W5-0NA19rBJkm_CDA' }, action: '#jwtDecodeBtn' },
      { name: 'Expired notes pass', values: { '#jwtInput': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsaW4iLCJzY29wZSI6Im5vdGVzOnJlYWQgbm90ZXM6d3JpdGUiLCJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJpYXQiOjE3NjMwNzg0MDAsImV4cCI6MTc2MzA4MjAwMH0.EPVluFdz3jLhvtdpC6v6N8uZ2HKlG_yCx_gT0Qqx-so' }, action: '#jwtDecodeBtn' }
    ],
    hmac: [
      { name: 'Signed webhook', values: { '#hmacMessage': '{"event":"order.paid","order":1042,"total":"18.50"}', '#hmacKey': 'whsec_demo_tea_garden' }, action: '#hmacBtn' },
      { name: 'Signed note', values: { '#hmacMessage': 'Meet at the blue door at nine.', '#hmacKey': 'pocket-secret' }, action: '#hmacBtn' }
    ],
    timestamp: [
      { name: 'Launch moment', values: { '#tsUnixInput': '1700000000' }, action: ['#tsSecBtn', '#tsToDateBtn'] },
      { name: 'Y2K38 edge', values: { '#tsUnixInput': '2147483647' }, action: ['#tsSecBtn', '#tsToDateBtn'] }
    ],
    'number-base': [
      { name: 'This year', values: { '#numDec': '2026' } },
      { name: 'Answer to everything', values: { '#numDec': '42' } }
    ],
    'case-converter': [
      { name: 'Variable name', values: { '#caseInput': 'user profile image url' } },
      { name: 'Shouty headline', values: { '#caseInput': 'THE CAT FOUND THE WARMEST WINDOW' } }
    ],
    'hex-codec': [
      { name: 'Hello in hex', values: { '#hexInput': 'Hello, Toolkit!' }, action: '#hexEncodeBtn' },
      { name: 'Hidden message', values: { '#hexInput': '54 65 61 20 74 69 6d 65' }, action: '#hexDecodeBtn' }
    ],
    'html-codec': [
      { name: 'Snippet to escape', values: { '#htmlInput': '<a href="/menu?tea=1&simit=2">Tea & simit</a>' }, action: '#htmlEncodeBtn' },
      { name: 'Escaped quote', values: { '#htmlInput': '&lt;p&gt;&quot;Curiosity&quot; &amp; tea&lt;/p&gt;' }, action: '#htmlDecodeBtn' }
    ],
    'binary-text': [
      { name: 'Robot greeting', values: { '#binInput': 'Hi, robot!' }, action: '#binEncodeBtn' },
      { name: 'Binary secret', values: { '#binInput': '01110100 01100101 01100001' }, action: '#binDecodeBtn' }
    ],
    'color-converter': [
      { name: 'Ocean teal', values: { '#colorHex': '#0f766e' } },
      { name: 'Sunset coral', values: { '#colorHex': '#f97362' } }
    ],
    'text-cleaner': [
      { name: 'Messy paste', values: { '#tc-input': '   Pack   the map.   \n\n\n  Bring    tea.\t\n\n   Meet at nine.   ' }, action: '#tc-clean-btn' },
      { name: 'Spaced list', values: { '#tc-input': '  figs  \n\n  honey   \n\n\n  warm   bread  ' }, action: '#tc-clean-btn' }
    ],
    'deduplicate-lines': [
      { name: 'Guest list', values: { '#dd-input': 'Mira\nLin\nAda\nMira\nLin\nNora' }, action: '#dd-dedup-btn' },
      { name: 'Shopping list', values: { '#dd-input': 'tea\nsimit\nfigs\ntea\nhoney\nsimit' }, action: '#dd-dedup-btn' }
    ],
    'line-numbers': [
      { name: 'Tiny poem', values: { '#ln-input': 'The kettle hums,\nthe window glows,\nthe cat decides\nwhere morning goes.' }, action: '#ln-apply-btn' },
      { name: 'Recipe steps', values: { '#ln-input': 'Warm the pot\nAdd the leaves\nPour the water\nWait four minutes' }, action: '#ln-apply-btn' }
    ],
    'text-reverser': [
      { name: 'Palindrome check', values: { '#tr-input': 'Was it a car or a cat I saw?' }, action: '#tr-reverse-btn' },
      { name: 'Backwards note', values: { '#tr-input': 'Tea is ready.\nThe cat is asleep.' }, action: '#tr-reverse-btn' }
    ],
    rot13: [
      { name: 'Puzzle hint', values: { '#rot13Input': 'The key is under the blue flowerpot.' }, action: '#rot13ApplyBtn' },
      { name: 'Spoiler line', values: { '#rot13Input': 'Gur png jnf gur qrgrpgvir nyy nybat.' }, action: '#rot13ApplyBtn' }
    ],
    ascii: [
      { name: 'Short word', values: { '#asciiInput': 'Tea' }, action: '#asciiConvertBtn' },
      { name: 'Punctuation mix', values: { '#asciiInput': 'Hi! #42 @home' }, action: '#asciiConvertBtn' }
    ],
    slug: [
      { name: 'Blog title', values: { '#slug-input': '10 Small Rituals for a Calmer Morning!' } },
      { name: 'Accented title', values: { '#slug-input': 'Çay & Simit: İstanbul’da Bir Sabah' } }
    ],
    'mime-lookup': [
      { name: 'Web image', values: { '#mime-input': 'webp' }, action: ['#mime-mode-ext', '#mime-btn'] },
      { name: 'Data file', values: { '#mime-input': 'json' }, action: ['#mime-mode-ext', '#mime-btn'] }
    ],
    'password-strength': [
      { name: 'Short and guessable', values: { '#psInput': 'summer2024' } },
      { name: 'Long passphrase', values: { '#psInput': 'violet-kettle-orbit-91-mapleleaf' } }
    ],
    'color-contrast': [
      { name: 'Readable night', values: { '#contrastForeground': '#ededed', '#contrastBackground': '#111111' }, action: '#contrastRun' },
      { name: 'Too faint', values: { '#contrastForeground': '#9ca3af', '#contrastBackground': '#f3f4f6' }, action: '#contrastRun' }
    ],
    'css-clamp': [
      { name: 'Hero heading', values: { '#clampMin': '32', '#clampMax': '64', '#clampVmin': '360', '#clampVmax': '1280' }, action: '#clampRun' },
      { name: 'Body text', values: { '#clampMin': '15', '#clampMax': '18', '#clampVmin': '320', '#clampVmax': '1200' }, action: '#clampRun' }
    ],
    'unicode-inspector': [
      { name: 'Emoji family', values: { '#unicodeInput': 'Tea 🍵 and a wave 👋🏽' }, action: '#unicodeRun' },
      { name: 'Accented letters', values: { '#unicodeInput': 'Çay, İstanbul, café, naïve' }, action: '#unicodeRun' }
    ],
    'date-duration': [
      { name: 'Summer holiday', values: { '#durationStart': '2026-06-15', '#durationEnd': '2026-09-07' }, action: '#durationRun' },
      { name: 'One leap year', values: { '#durationStart': '2028-01-01', '#durationEnd': '2029-01-01' }, action: '#durationRun' }
    ],
    'time-zone-converter': [
      { name: 'Team call', values: { '#zoneDate': '2026-12-01T16:00', '#zoneList': 'Europe/Istanbul\nEurope/London\nAmerica/New_York\nAsia/Tokyo' }, action: '#zoneRun' },
      { name: 'New Year countdown', values: { '#zoneDate': '2026-12-31T23:59', '#zoneList': 'Pacific/Auckland\nEurope/Istanbul\nAmerica/Los_Angeles' }, action: '#zoneRun' }
    ],
    'aes-gcm': [
      { name: 'Secret recipe', values: { '#aesText': 'Grandma’s tea: two spoons, four minutes, one cinnamon stick.', '#aesPass': 'correct-kettle-violet-42' }, action: '#aesEncrypt' },
      { name: 'Locked diary', values: { '#aesText': 'Dear diary, the cat learned to open the door today.', '#aesPass': 'moonlight-notebook-17' }, action: '#aesEncrypt' }
    ]
  });
  const lastExample = new Map();

  function t(key, values) {
    return window.ToolkitI18n ? window.ToolkitI18n.t(key, values) : key;
  }

  function randomIndex(length) {
    if (typeof window.secureRandInt === 'function') return window.secureRandInt(length);
    return Math.floor(Math.random() * length);
  }

  function selectExample(group) {
    const choices = examples[group] || [];
    if (!choices.length) return null;
    let index = randomIndex(choices.length);
    if (choices.length > 1 && index === lastExample.get(group)) index = (index + 1) % choices.length;
    lastExample.set(group, index);
    return choices[index];
  }

  function setValue(target, value) {
    if (!target) return;
    target.value = value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function loadUrlBuilder(setup) {
    if (!setup) return false;
    const pathRows = document.getElementById('ubPathRows');
    const paramRows = document.getElementById('ubParamRows');
    const addPath = document.getElementById('ubAddPath');
    const addParam = document.getElementById('ubAddParam');
    if (!pathRows || !paramRows || !addPath || !addParam) return false;
    pathRows.replaceChildren();
    paramRows.replaceChildren();
    setValue(document.getElementById('ubBase'), setup.base);
    setup.paths.forEach((path, index) => {
      addPath.click();
      setValue(pathRows.querySelectorAll('input')[index], path);
    });
    setup.params.forEach(([key, value], index) => {
      addParam.click();
      const inputs = paramRows.querySelectorAll('div')[index].querySelectorAll('input');
      setValue(inputs[0], key);
      setValue(inputs[1], value);
    });
    setValue(document.getElementById('ubHash'), setup.hash);
    return true;
  }

  function loadExample(button) {
    const group = button.dataset.exampleGroup;
    const example = selectExample(group);
    if (!example) return;
    let applied = false;
    Object.entries(example.values || {}).forEach(([selector, value]) => {
      const target = document.querySelector(selector);
      if (!target) return;
      setValue(target, value);
      applied = true;
    });
    if (loadUrlBuilder(example.urlBuilder)) applied = true;
    if (!applied) return;
    // An action is one selector, or several clicked in order (choose a unit, then run).
    [].concat(example.action || []).forEach((selector) => document.querySelector(selector)?.click());
    button.dataset.exampleLoaded = example.name;
    if (typeof window.showToast === 'function') {
      window.showToast(t('Example loaded: {{name}}', { name: t(example.name) }), 'success');
    }
  }

  document.querySelectorAll('[data-example-group]').forEach((button) => {
    button.addEventListener('click', () => loadExample(button));
  });
}());
