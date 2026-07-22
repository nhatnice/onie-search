//await exportFBReactions('ZmVlZGJhY2s6Mjc3NTg1MTY3NTA0NTYwMjQ=')

(function () {
  'use strict';

  const FB_GRAPHQL = 'https://www.facebook.com/api/graphql/';
  const DOC_ID = '7311826188912908';
  const APP_ID = '2220391788200892';
  const PAGE_SIZE = 50;
  // ponytail: jittered delay giữa các GraphQL pages — community recommend 2-3s tránh bot detection
  const REQUEST_DELAY_BASE_MS = 2000;
  const REQUEST_DELAY_JITTER_MS = 1000;

  const REACTION_TYPES = [
    { id: '1635855486666999', display_name: 'Like', name: 'like' },
    { id: '1678524932434102', display_name: 'Love', name: 'love' },
    { id: '613557422527858', display_name: 'Care', name: 'support' },
    { id: '115940658764963', display_name: 'Haha', name: 'haha' },
    { id: '478547315650144', display_name: 'Wow', name: 'wow' },
    { id: '908563459236466', display_name: 'Sad', name: 'sorry' },
    { id: '444813342392137', display_name: 'Angry', name: 'anger' },
  ];

  function reactionName(id) {
    const r = REACTION_TYPES.find((x) => x.id === id);
    return r ? r.display_name : id;
  }

  function parseToken(text, re, group) {
    const m = text.match(re);
    return m && m.groups ? m.groups[group] : undefined;
  }

  function getToken() {
    const scripts = Array.from(document.querySelectorAll('script[type="application/json"]'));
    const userScript = scripts.find((s) => s.innerText.includes('__user='));
    const siteData = scripts.find((s) => s.innerText.includes('"SiteData"'));

    const tokens = {
      __user: undefined,
      fb_dtsg: undefined,
      lsd: undefined,
      jazoest: undefined,
      __comet_req: undefined,
      __hs: undefined,
      __hsi: undefined,
      __spin_r: undefined,
      __spin_b: undefined,
      __spin_t: undefined,
      __rev: undefined,
    };

    if (userScript) {
      const t = userScript.innerText;
      tokens.__user = parseToken(t, /__user=(?<u>\d+)/, 'u');
      tokens.jazoest = parseToken(t, /jazoest=(?<v>\d+)/, 'v');
      tokens.__comet_req = parseToken(t, /__comet_req=(?<v>\d+)/, 'v');
    }

    const searchOrder = siteData ? [siteData, ...scripts] : scripts;
    for (const s of searchOrder) {
      const t = s.innerText;
      if (!tokens.fb_dtsg) {
        tokens.fb_dtsg =
          parseToken(t, /"DTSGInitialData",\[\],\{"token":"(?<v>[\w.:-]+)"/, 'v') ||
          parseToken(t, /"DTSGInitData"[^}]*"token":"(?<v>[\w.:-]+)"/, 'v');
      }
      if (!tokens.lsd) {
        tokens.lsd = parseToken(t, /"LSD",\[\],\{"token":"(?<v>[\w.:]+)"/, 'v');
      }
      if (!tokens.__hs) {
        tokens.__hs = parseToken(t, /"haste_session":"(?<v>[\w.:]+)"/, 'v');
      }
      if (!tokens.__hsi) {
        tokens.__hsi = parseToken(t, /"hsi":"(?<v>[\w.:]+)"/, 'v');
      }
      if (!tokens.__spin_r) {
        tokens.__spin_r = parseToken(t, /"__spin_r":(?<v>\d+),/, 'v');
      }
      if (!tokens.__spin_b) {
        tokens.__spin_b = parseToken(t, /"__spin_b":"(?<v>[\w.:]+)"/, 'v');
      }
      if (!tokens.__spin_t) {
        tokens.__spin_t = parseToken(t, /"__spin_t":(?<v>\d+),/, 'v');
      }
      if (!tokens.__rev) {
        tokens.__rev = parseToken(t, /"server_revision":(?<v>\d+),/, 'v');
      }
      if (tokens.fb_dtsg && tokens.lsd) break;
    }

    tokens.__a = '1';
    tokens.__aaid = '0';
    tokens.__ccg = 'GOOD';
    tokens.av = tokens.__user;
    return tokens;
  }

  async function extractFeedbackId(postUrl) {
    if (/^[A-Za-z0-9+/=._:-]+$/.test(postUrl) && !/^https?:\/\//.test(postUrl)) {
      return postUrl;
    }

    const res = await fetch(postUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { 'sec-fetch-site': 'none' },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch post (HTTP ${res.status})`);
    }
    const html = await res.text();

    const patterns = [
      /"feedbackTargetID"\s*:\s*["'](?<id>[A-Za-z0-9+/=._:-]+)["']/,
      /"feedback_id"\s*:\s*["']?(?<id>\d{10,})/,
      /"feedbackTargetId"\s*:\s*["'](?<id>[A-Za-z0-9+/=._:-]+)["']/,
      /feedbackTargetID=(?<id>[A-Za-z0-9+/=._:-]+)/,
      /feedback_id=(?<id>\d{10,})/,
      /"top_level_post_id"\s*:\s*["'](?<id>\d{10,})["']/,
    ];
    for (const re of patterns) {
      const id = parseToken(html, re, 'id');
      if (id) return id;
    }
    throw new Error('feedbackTargetID not found in post HTML — paste it manually');
  }

  function parseGraphQLResponse(text) {
    if (!text) throw new Error('Empty response');
    let body = text;
    if (body.startsWith('for (;;);')) body = body.substring(9);
    if (body.startsWith('{')) return JSON.parse(body);
    const lines = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsed = lines.map((l) => JSON.parse(l));
    return parsed.length === 1 ? parsed[0] : parsed;
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function extractUID(id, profileUrl) {
    if (!id) return '';
    if (/^\d{5,}$/.test(id)) return id;
    if (profileUrl) {
      const m =
        profileUrl.match(/[?&]id=(\d{5,})/) ||
        profileUrl.match(/facebook\.com\/(\d{5,})(?:\/|$|\?)/);
      if (m) return m[1];
    }
    return '';
  }

  function fmtDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m${r}s`;
  }

  function ts() {
    const d = new Date();
    const pad = (n, w = 2) => String(n).padStart(w, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  }

  async function fetchReactions({
    feedbackTargetID,
    reactionID,
    signal,
    onProgress,
    limit,
    startCursor,
  }) {
    const token = getToken();
    if (!token.fb_dtsg) {
      const diag = {
        url: document.location.href,
        scriptCount: document.querySelectorAll('script[type="application/json"]').length,
        bodySample: ((document.body && document.body.innerText) || '').slice(0, 200),
      };
      console.error('FB_DTSG_DIAG', JSON.stringify(diag));
      const sessionDead = /\/login|\/checkpoint|\/cookie/i.test(diag.url);
      const spaNotReady = diag.scriptCount === 0 && !sessionDead;
      if (sessionDead) throw new Error('FB_SESSION_DEAD: re-export FB_COOKIE — url=' + diag.url);
      if (spaNotReady)
        throw new Error('FB_SPA_NOT_READY: Comet hydrate race — scriptCount=0 url=' + diag.url);
      throw new Error(
        'FB_DTSG_PARSE_FAIL: HTML format changed — scriptCount=' +
          diag.scriptCount +
          ' url=' +
          diag.url,
      );
    }
    if (!token.lsd) throw new Error('lsd not found — open facebook.com first');

    const reactors = [];
    let cursor = startCursor || null;
    let page = 0;
    let hasNext = true;
    let retries = 0;
    const startedAt = Date.now();
    let lastPageAt = startedAt;
    const cap = limit && limit > 0 ? limit : Infinity;

    console.log(
      `[${ts()}] start — feedbackTargetID=${feedbackTargetID} reactionID=${reactionID || 'ALL'} limit=${limit || 'none'} pageSize=${PAGE_SIZE} startCursor=${startCursor ? 'yes' : 'no'}`,
    );

    while (hasNext) {
      page++;
      const pageStart = Date.now();
      const variables = {
        count: PAGE_SIZE,
        cursor: cursor,
        feedbackTargetID: feedbackTargetID,
        reactionID: reactionID || null,
        scale: window.devicePixelRatio || 1,
        id: feedbackTargetID,
      };
      const params = {
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'CometUFIReactionsDialogTabContentRefetchQuery',
        server_timestamps: true,
        doc_id: DOC_ID,
        ...token,
        variables: JSON.stringify(variables),
      };
      const body = new URLSearchParams();
      for (const k in params) body.set(k, String(params[k]));

      const headers = {
        accept: '*/*',
        'content-type': 'application/x-www-form-urlencoded',
        'x-fb-friendly-name': 'CometUFIReactionsDialogTabContentRefetchQuery',
        'x-ig-app-id': APP_ID,
      };
      if (token.lsd) headers['x-fb-lsd'] = token.lsd;
      if (token.fb_dtsg) headers['x-csrftoken'] = token.fb_dtsg;

      let res;
      try {
        res = await fetch(FB_GRAPHQL, {
          method: 'POST',
          headers,
          body: body.toString(),
          credentials: 'include',
          signal,
        });
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        if (retries++ < 2) {
          await sleep(5000);
          continue;
        }
        throw e;
      }

      if (res.status === 429 || res.status === 401) {
        if (retries++ < 1) {
          console.warn(`HTTP ${res.status} — waiting 60s and retrying once…`);
          await sleep(60000);
          continue;
        }
        throw new Error(`FB_RATE_LIMITED: HTTP ${res.status} from GraphQL — try again later`);
      }

      const text = await res.text();
      let json;
      try {
        json = parseGraphQLResponse(text);
      } catch (e) {
        throw new Error('Failed to parse GraphQL response: ' + e.message, { cause: e });
      }

      const payload = Array.isArray(json) ? json[0] : json;
      if (payload && payload.error) {
        throw new Error('GraphQL error: ' + JSON.stringify(payload.error));
      }

      let node = null;
      if (Array.isArray(json)) {
        const found = json.find((x) => x && x.data && x.data.node);
        node = found ? found.data.node : null;
      } else if (payload && payload.data && payload.data.node) {
        node = payload.data.node;
      }

      if (!node || !node.reactors || !Array.isArray(node.reactors.edges)) {
        if (page === 1) {
          throw new Error('No reactors.edges in response (post may be private or doc_id outdated)');
        }
        break;
      }

      for (const edge of node.reactors.edges) {
        const u = edge.node || {};
        const ri = edge.feedback_reaction_info || {};
        const profileUrl = u.profile_url || '';
        reactors.push({
          'User Id': u.id,
          UID: extractUID(u.id, profileUrl),
          Username: u.name,
          'Profile URL': profileUrl,
          'Avatar URL': (u.profile_picture && u.profile_picture.uri) || '',
          'Reaction Type': reactionName(ri.id),
          'Friendship Status': u.friendship_status || '',
          'Subscribe Status': u.subscribe_status || '',
          'Mutual Friends Number': (u.mutual_friends && u.mutual_friends.count) || 0,
        });
      }

      const pageInfo = node.reactors.page_info || {};
      hasNext = !!pageInfo.has_next_page;
      cursor = pageInfo.end_cursor || null;
      retries = 0;

      const pageMs = Date.now() - pageStart;
      const elapsedMs = Date.now() - startedAt;
      const rate = reactors.length / (elapsedMs / 1000);
      const newCount = node.reactors.edges.length;
      const hitCap = reactors.length >= cap;
      const etaText = hitCap
        ? 'limit hit'
        : hasNext && rate > 0
          ? `~${fmtDuration(((cap - reactors.length) / rate) * 1000)} to limit`
          : '—';

      console.log(
        `[${ts()}] page=${page} +${newCount} (total=${reactors.length}` +
          (limit ? `/${limit}` : '') +
          `) ${pageMs}ms rate=${rate.toFixed(1)}/s eta=${etaText}` +
          (hasNext ? ' hasNext=…' : ' hasNext=✓ done'),
      );

      if (onProgress)
        onProgress({
          page,
          total: reactors.length,
          hasNext,
          cursor: cursor,
          pageReactors: reactors.slice(reactors.length - newCount),
        });

      if (hitCap) {
        console.log(`[${ts()}] limit reached — stopping.`);
        break;
      }
      if (hasNext && cursor)
        await sleep(REQUEST_DELAY_BASE_MS + Math.floor(Math.random() * REQUEST_DELAY_JITTER_MS));
    }

    const totalMs = Date.now() - startedAt;
    console.log(
      `[${ts()}] finished — ${reactors.length} reactors in ${fmtDuration(totalMs)} across ${page} page(s)`,
    );
    return reactors;
  }

  function csvEscape(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    if (!rows.length) return '';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(',')];
    for (const r of rows) lines.push(headers.map((h) => csvEscape(r[h])).join(','));
    return '\ufeff' + lines.join('\r\n');
  }

  function downloadCSV(filename, csv) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.visibility = 'hidden';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function dateStamp() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  async function main(input, opts = {}) {
    if (!input) {
      throw new Error(
        "Usage: exportFBReactions('<postUrl | feedbackTargetID>', { reactionID?, limit? })",
      );
    }
    console.log(`[${ts()}] resolving feedbackTargetID…`);
    const feedbackTargetID = await extractFeedbackId(input);
    console.log(`[${ts()}] feedbackTargetID = ${feedbackTargetID}`);

    console.log(`[${ts()}] fetching reactions…`);
    const reactors = await fetchReactions({
      feedbackTargetID,
      reactionID: opts.reactionID,
      limit: opts.limit,
      onProgress: opts.onProgress,
      startCursor: opts.startCursor || null,
    });

    console.log(`[${ts()}] total reactors: ${reactors.length}`);
    if (!reactors.length) {
      console.warn('No reactions to export.');
      return [];
    }
    if (!opts.skipDownload) {
      const csv = toCSV(reactors);
      const fname = `fb-reactions_${feedbackTargetID}_${reactors.length}_${dateStamp()}.csv`;
      downloadCSV(fname, csv);
      console.log(`[${ts()}] downloaded: ${fname}`);
    }
    return reactors;
  }

  window.exportFBReactions = main;
  window.fbReactionTypes = REACTION_TYPES;
  console.log(
    "FB Reaction Exporter loaded. Use: exportFBReactions('<postUrl | feedbackId>', { limit: 20 })",
  );
})();
