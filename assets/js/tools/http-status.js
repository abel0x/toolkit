(function initHttpStatus() {
  const searchEl = document.getElementById('http-search');
  const gridEl = document.getElementById('http-grid');
  const filterBtns = document.querySelectorAll('.http-filter-btn');
  if (!gridEl) return;

  const CODES = [
    { code: 100, name: 'Continue', short: 'Request received, please continue.', cat: '1xx',
      desc: 'The server has received the request headers and the client should proceed to send the request body. Used with Expect: 100-continue header.' },
    { code: 101, name: 'Switching Protocols', short: 'Switching to a different protocol.', cat: '1xx',
      desc: 'The server is switching protocols as requested by the client. Common for WebSocket upgrades (Upgrade: websocket).' },
    { code: 200, name: 'OK', short: 'Request succeeded.', cat: '2xx',
      desc: 'Standard response for successful HTTP requests. The meaning depends on the request method (GET returns the resource, POST returns a description of the result).' },
    { code: 201, name: 'Created', short: 'New resource was created.', cat: '2xx',
      desc: 'The request has been fulfilled and a new resource has been created. The URI is provided in the Location header. Common after a successful POST.' },
    { code: 202, name: 'Accepted', short: 'Request accepted, processing later.', cat: '2xx',
      desc: 'The request has been accepted for processing but the processing has not been completed. Used for asynchronous operations.' },
    { code: 204, name: 'No Content', short: 'Success, no response body.', cat: '2xx',
      desc: 'The server successfully processed the request and is not returning any content. Often used for DELETE or PUT that do not return a body.' },
    { code: 206, name: 'Partial Content', short: 'Partial GET request fulfilled.', cat: '2xx',
      desc: 'The server is delivering only part of the resource due to a Range header in the request. Used for resumable downloads and media streaming.' },
    { code: 301, name: 'Moved Permanently', short: 'Resource permanently moved.', cat: '3xx',
      desc: 'The resource has been permanently moved to a new URL. Clients should update their links. Search engines pass link equity to the new URL.' },
    { code: 302, name: 'Found', short: 'Temporary redirect.', cat: '3xx',
      desc: 'The resource temporarily resides at a different URL. Clients should continue using the original URL for future requests.' },
    { code: 303, name: 'See Other', short: 'See a different resource (GET).', cat: '3xx',
      desc: 'Server directs client to get the requested resource at another URI using a GET request. Often used after a POST-Redirect-GET pattern.' },
    { code: 304, name: 'Not Modified', short: 'Cached version is still valid.', cat: '3xx',
      desc: 'The resource has not been modified since the version specified by If-Modified-Since or If-None-Match. Client should use its cached version.' },
    { code: 307, name: 'Temporary Redirect', short: 'Temporary redirect, same method.', cat: '3xx',
      desc: 'Same as 302, but the request method must not be changed. A POST redirect stays as POST. The redirect is temporary.' },
    { code: 308, name: 'Permanent Redirect', short: 'Permanent redirect, same method.', cat: '3xx',
      desc: 'Same as 301, but the request method must not be changed. A POST redirect stays as POST. The redirect is permanent.' },
    { code: 400, name: 'Bad Request', short: 'Malformed request syntax.', cat: '4xx',
      desc: 'The server cannot process the request due to a client error (e.g., malformed request syntax, invalid request message framing, or deceptive request routing).' },
    { code: 401, name: 'Unauthorized', short: 'Authentication required.', cat: '4xx',
      desc: 'The request has not been applied because it lacks valid authentication credentials. Client should authenticate itself to get the requested response.' },
    { code: 403, name: 'Forbidden', short: 'Server refuses the request.', cat: '4xx',
      desc: 'The client does not have access rights to the content — the server refuses to authorize it. Unlike 401, the client\'s identity is known to the server.' },
    { code: 404, name: 'Not Found', short: 'Resource not found.', cat: '4xx',
      desc: 'The server cannot find the requested resource. Links that lead to a 404 page are often called broken or dead links. The most famous HTTP status code.' },
    { code: 405, name: 'Method Not Allowed', short: 'HTTP method not supported.', cat: '4xx',
      desc: 'The request method is known by the server but is not supported by the target resource. The Allow header must contain a list of allowed methods.' },
    { code: 408, name: 'Request Timeout', short: 'Server timed out waiting.', cat: '4xx',
      desc: 'The server timed out waiting for the request. Some servers send this response without a prior request, so it can shut down idle connections.' },
    { code: 409, name: 'Conflict', short: 'Request conflicts with resource state.', cat: '4xx',
      desc: 'The request could not be processed because of a conflict in the current state of the resource. Used for version control conflicts or duplicate entries.' },
    { code: 410, name: 'Gone', short: 'Resource permanently deleted.', cat: '4xx',
      desc: 'The resource requested was previously in use but has been permanently deleted and will not be available again. Unlike 404, search engines can remove the page.' },
    { code: 422, name: 'Unprocessable Entity', short: 'Validation error.', cat: '4xx',
      desc: 'The request was well-formed but was unable to be followed due to semantic errors. Common in REST APIs when request body fails validation.' },
    { code: 429, name: 'Too Many Requests', short: 'Rate limit exceeded.', cat: '4xx',
      desc: 'The user has sent too many requests in a given amount of time (rate limiting). The response may include a Retry-After header indicating when to retry.' },
    { code: 500, name: 'Internal Server Error', short: 'Generic server-side error.', cat: '5xx',
      desc: 'A generic error message when the server encounters an unexpected condition. The most common server-side error status code.' },
    { code: 501, name: 'Not Implemented', short: 'Server lacks the feature.', cat: '5xx',
      desc: 'The server does not support the functionality required to fulfill the request. Often returned when the server does not recognize the request method.' },
    { code: 502, name: 'Bad Gateway', short: 'Upstream server error.', cat: '5xx',
      desc: 'The server, acting as a gateway or proxy, received an invalid response from an upstream server. Common with Nginx/Apache proxying to app servers.' },
    { code: 503, name: 'Service Unavailable', short: 'Server temporarily unavailable.', cat: '5xx',
      desc: 'The server is not ready to handle the request. Common causes include server maintenance or server overload. May include a Retry-After header.' },
    { code: 504, name: 'Gateway Timeout', short: 'Upstream server timeout.', cat: '5xx',
      desc: 'The server, while acting as a gateway or proxy, did not receive a timely response from an upstream server. Common in microservice architectures.' }
  ];

  let currentFilter = 'all';

  function catColor(cat) {
    return { '1xx': '#60a5fa', '2xx': '#34d399', '3xx': '#fbbf24', '4xx': '#f87171', '5xx': '#e879f9' }[cat] || '#94a3b8';
  }

  function render(filter, query) {
    const q = (query || '').toLowerCase().trim();
    const items = CODES.filter(c => {
      const matchCat = filter === 'all' || c.cat === filter;
      const matchQ = !q || c.code.toString().includes(q) || c.name.toLowerCase().includes(q) || c.short.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    if (items.length === 0) {
      gridEl.innerHTML = '<p class="ix-b13ac6">No matching status codes.</p>';
      return;
    }

    gridEl.innerHTML = items.map(c => `
      <div class="http-card" data-code="${c.code}" data-cat="${c.cat}">
        <div class="http-card-head">
          <span class="http-code">${c.code}</span>
          <span class="http-name">${escapeHTML(c.name)}</span>
          <span class="http-cat-badge">${c.cat}</span>
        </div>
        <p class="http-short">${escapeHTML(c.short)}</p>
        <div class="http-desc" hidden>${escapeHTML(c.desc)}</div>
      </div>
    `).join('');

    gridEl.querySelectorAll('.http-card').forEach(card => {
      // Category colours are set through the CSSOM because the CSP blocks style attributes in markup.
      const color = catColor(card.dataset.cat);
      card.style.setProperty('--cat-color', color);
      card.querySelector('.http-cat-badge').style.color = color;
      card.addEventListener('click', () => {
        const desc = card.querySelector('.http-desc');
        const isOpen = !desc.hidden;
        gridEl.querySelectorAll('.http-desc').forEach(d => { d.hidden = true; d.closest('.http-card').classList.remove('expanded'); });
        if (!isOpen) { desc.hidden = false; card.classList.add('expanded'); }
      });
    });
  }

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.cat;
      render(currentFilter, searchEl ? searchEl.value : '');
    });
  });

  if (searchEl) {
    searchEl.addEventListener('input', () => render(currentFilter, searchEl.value));
  }

  render('all', '');
})();
