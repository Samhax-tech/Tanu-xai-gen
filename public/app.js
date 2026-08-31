const $ = (id) => document.getElementById(id);

const views = {
  start: $('view-start'),
  pairing: $('view-pairing'),
  connected: $('view-connected'),
  error: $('view-error')
};

function showView(name) {
  for (const key of Object.keys(views)) {
    views[key].hidden = key !== name;
  }
}

const STATUS_LABELS = {
  created: 'Initializing…',
  connecting: 'Connecting to WhatsApp…',
  requesting_pairing_code: 'Generating pairing code…',
  waiting_for_auth: 'Waiting for authentication',
  authenticating: 'Authenticating…',
  connected: 'Connected!',
  reconnecting: 'Reconnecting…'
};

const ERROR_LABELS = {
  INVALID_PHONE_NUMBER: 'Invalid phone number',
  SESSION_ALREADY_ACTIVE: 'That number is already being paired',
  PAIRING_FAILED: 'Pairing code generation failed',
  PAIRING_TIMEOUT: 'Pairing expired',
  RATE_LIMITED: 'Too many attempts. Please wait a bit.',
  INTERNAL_ERROR: 'Server unavailable'
};

let pollHandle = null;
let currentSessionId = null;

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

async function pollStatus(sessionId) {
  try {
    const res = await fetch(`/api/session/${sessionId}/status`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error?.code || 'INTERNAL_ERROR');
    }

    $('status-text').textContent = STATUS_LABELS[data.status] || data.status;

    if (data.status === 'connected') {
      stopPolling();
      $('session-id').textContent = sessionId;
      showView('connected');
      return;
    }

    if (['logged_out', 'expired', 'failed'].includes(data.status)) {
      stopPolling();
      renderError(data.status === 'expired' ? 'PAIRING_TIMEOUT' : 'PAIRING_FAILED');
    }
  } catch (err) {
    stopPolling();
    renderError('INTERNAL_ERROR');
  }
}

function renderError(code) {
  $('error-text').textContent = ERROR_LABELS[code] || 'Something went wrong';
  showView('error');
}

$('start-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('start-btn');
  const errEl = $('start-error');
  errEl.hidden = true;

  btn.disabled = true;
  btn.textContent = 'Generating…';

  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: $('phone').value })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data?.error?.code || 'INTERNAL_ERROR');
    }

    currentSessionId = data.sessionId;
    $('pairing-code').textContent = data.pairingCode;
    $('status-text').textContent = STATUS_LABELS[data.status] || data.status;
    showView('pairing');

    stopPolling();
    pollHandle = setInterval(() => pollStatus(currentSessionId), 1500);
  } catch (err) {
    errEl.textContent = ERROR_LABELS[err.message] || 'Unable to create session';
    errEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate pairing code';
  }
});

function wireCopyButton(buttonId, sourceId) {
  $(buttonId).addEventListener('click', async () => {
    await navigator.clipboard.writeText($(sourceId).textContent.trim());
    const original = $(buttonId).textContent;
    $(buttonId).textContent = 'Copied!';
    setTimeout(() => { $(buttonId).textContent = original; }, 1500);
  });
}

wireCopyButton('copy-code', 'pairing-code');
wireCopyButton('copy-session', 'session-id');

$('retry-btn').addEventListener('click', () => {
  stopPolling();
  showView('start');
});

// Recover an in-progress pairing session across a page refresh via the
// session id in the URL (?session=TX_xxxxxxxx), matching Test 9.
(function recoverFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session');
  if (!sessionId) return;

  currentSessionId = sessionId;
  showView('pairing');
  pollHandle = setInterval(() => pollStatus(sessionId), 1500);
  pollStatus(sessionId);
})();
