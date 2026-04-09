(() => {
  const { DIMS, QUESTIONS, TYPES } = window.SBTI;

  const $ = (id) => document.getElementById(id);
  const screens = {
    intro:  $('screen-intro'),
    quiz:   $('screen-quiz'),
    result: $('screen-result'),
  };
  const show = (name) => {
    Object.entries(screens).forEach(([k, el]) => el.classList.toggle('active', k === name));
    window.scrollTo({ top: 0 });
  };

  // DIMS 按 code 映射，方便查
  const DIM_BY_CODE = Object.fromEntries(DIMS.map((d) => [d.code, d]));

  // 稀有度元数据（color 同时供 SVG 头像使用）
  const RARITY = {
    common:   { label: '常见',   stars: '★',     short: 'COMMON',    color: '#9aa0ac' },
    uncommon: { label: '普通',   stars: '★★',    short: 'UNCOMMON',  color: '#7ed0a0' },
    rare:     { label: '稀有',   stars: '★★★',   short: 'RARE',      color: '#7ad0ff' },
    epic:     { label: '史诗',   stars: '★★★★',  short: 'EPIC',      color: '#c58cff' },
    legend:   { label: '传说',   stars: '★★★★★', short: 'LEGENDARY', color: '#ffd34d' },
  };

  // 根据人格 key + 稀有度生成一张 SVG 头像
  function makeAvatar(typeKey, rarityKey, size = 180) {
    const rar = RARITY[rarityKey] || RARITY.common;
    const emoji = (window.SBTI_AVATARS && window.SBTI_AVATARS[typeKey]) || '❓';
    const c = rar.color;
    const id = 'g-' + typeKey + '-' + size;
    const fontSize = Math.round(size * 0.52);
    const cy = Math.round(size / 2);
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="${id}" cx="50%" cy="42%" r="58%">
            <stop offset="0%"  stop-color="${c}" stop-opacity="0.55"/>
            <stop offset="70%" stop-color="${c}" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
          </radialGradient>
          <radialGradient id="${id}-ring" cx="50%" cy="50%" r="50%">
            <stop offset="92%" stop-color="${c}" stop-opacity="0"/>
            <stop offset="100%" stop-color="${c}" stop-opacity="0.9"/>
          </radialGradient>
        </defs>
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#1e222b"/>
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="url(#${id})"/>
        <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="none"
                stroke="${c}" stroke-width="2" stroke-opacity="0.7"/>
        <text x="${size/2}" y="${cy}" font-size="${fontSize}"
              text-anchor="middle" dominant-baseline="central"
              style="font-family:-apple-system,'Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text>
      </svg>`;
  }

  // state
  let answers = new Array(QUESTIONS.length).fill(null);

  // ---------- Quiz ----------
  function renderQuiz() {
    const list = $('questionList');
    list.innerHTML = '';
    QUESTIONS.forEach((q, i) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <p class="q-text"><span class="q-idx">${i + 1}.</span>${escapeHtml(q.text)}</p>
        <div class="opts" data-q="${i}">
          ${q.opts.map((o, j) =>
            `<label class="opt" data-opt="${j}">
               <input type="radio" name="q${i}" value="${j}">
               ${escapeHtml(o.label)}
             </label>`
          ).join('')}
        </div>
      `;
      list.appendChild(li);
    });
    list.addEventListener('change', onAnswer);
    updateProgress();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function onAnswer(e) {
    const input = e.target;
    if (input.tagName !== 'INPUT') return;
    const qIdx = Number(input.name.slice(1));
    const optIdx = Number(input.value);
    answers[qIdx] = optIdx;
    const group = input.closest('.opts');
    group.querySelectorAll('.opt').forEach((el, j) => {
      el.classList.toggle('checked', j === optIdx);
    });
    updateProgress();
  }

  function updateProgress() {
    const done = answers.filter((a) => a !== null).length;
    const total = QUESTIONS.length;
    $('progressText').textContent = `${done} / ${total}`;
    $('progressFill').style.width = (done / total * 100) + '%';
    $('submitBtn').disabled = done < total;
    $('hint').textContent = done < total
      ? `还有 ${total - done} 题没答，答完才放行。`
      : '全部答完，随时提交。';
  }

  // ---------- Scoring ----------
  function computeScores() {
    const dim = {};
    DIMS.forEach((d) => dim[d.code] = 50);
    answers.forEach((optIdx, qIdx) => {
      if (optIdx == null) return;
      const delta = QUESTIONS[qIdx].opts[optIdx].delta;
      Object.entries(delta).forEach(([k, v]) => {
        if (dim[k] != null) dim[k] = Math.max(0, Math.min(100, dim[k] + v));
      });
    });
    return dim;
  }

  // 把 0~100 分值映射到 H / M / L
  function levelOf(v) {
    if (v >= 65) return 'H';
    if (v <= 35) return 'L';
    return 'M';
  }

  // 匹配人格：只看 profile 里的维度，H→85 / M→50 / L→15
  function matchTypes(dims) {
    const targets = { H: 85, M: 50, L: 15 };
    return TYPES.map((t) => {
      const keys = Object.keys(t.profile);
      let sum = 0;
      keys.forEach((k) => {
        const tgt = targets[t.profile[k]];
        const diff = Math.abs(dims[k] - tgt);
        sum += Math.max(0, 100 - diff);
      });
      const match = Math.round(sum / keys.length);
      return { type: t, match };
    }).sort((a, b) => b.match - a.match);
  }

  // ---------- Result ----------
  function renderResult() {
    const dims = computeScores();
    const ranked = matchTypes(dims);
    const top = ranked[0];

    // 人格头像
    $('resAvatar').innerHTML = makeAvatar(top.type.k, top.type.rarity, 180);

    $('resName').textContent = top.type.name;
    $('resCode').textContent = top.type.sub;
    $('resMatch').textContent = `匹配度 ${top.match}%`;

    // 稀有度徽章
    const r = RARITY[top.type.rarity] || RARITY.common;
    const badge = $('resRarity');
    badge.className = 'rarity-badge rarity-' + top.type.rarity;
    badge.innerHTML = `<span class="stars">${r.stars}</span><span class="rarity-label">${r.short} · ${r.label}</span>`;
    $('resTagline').textContent = `"${top.type.tagline}"`;
    // 把描述里的【...】高亮成稀有度徽章段，并按段落拆分渲染
    const descEl = $('resDesc');
    descEl.innerHTML = '';
    const paragraphs = top.type.desc.split(/(?=【)|\n+/).filter(Boolean);
    paragraphs.forEach((para) => {
      const p = document.createElement('p');
      // 【xxx】段作为高亮前缀
      const m = para.match(/^【([^】]+)】(.*)$/);
      if (m) {
        const tag = document.createElement('span');
        tag.className = 'desc-tag rarity-' + top.type.rarity;
        tag.textContent = m[1];
        p.appendChild(tag);
        p.appendChild(document.createTextNode(' ' + m[2]));
      } else {
        p.textContent = para;
      }
      descEl.appendChild(p);
    });
    if (top.type.tone) {
      const toneEl = document.createElement('p');
      toneEl.className = 'desc-tone';
      toneEl.textContent = `—— 人格基调：${top.type.tone}`;
      descEl.appendChild(toneEl);
    }

    // 维度卡片 —— 像原作那种
    $('dimList').innerHTML = DIMS.map((d) => {
      const v = dims[d.code];
      const lv = levelOf(v);
      const meta = d[lv]; // {tag, score, desc}
      return `
        <li class="dim-card">
          <header>
            <div class="dim-title">
              <span class="dim-code">${d.code}</span>
              <span class="dim-name">${escapeHtml(d.name)}</span>
            </div>
            <div class="dim-score lv-${lv}">
              <span>${lv}</span><span class="sep">/</span><span>${meta.score}分</span>
            </div>
          </header>
          <p class="dim-tag">${escapeHtml(meta.tag)}</p>
          <p class="dim-desc">${escapeHtml(meta.desc)}</p>
        </li>`;
    }).join('');

    // 备选 Top 2~4
    $('altList').innerHTML = ranked.slice(1, 4).map((a) => {
      const rar = RARITY[a.type.rarity] || RARITY.common;
      return `
      <li>
        <span class="alt-avatar">${makeAvatar(a.type.k, a.type.rarity, 48)}</span>
        <span class="alt-name">
          ${escapeHtml(a.type.name)}
          <span class="alt-sub">${a.type.k}</span>
          <span class="alt-rarity rarity-${a.type.rarity}">${rar.stars}</span>
        </span>
        <span class="alt-pct">${a.match}%</span>
      </li>`;
    }).join('');
  }

  // ---------- Wiring ----------
  function resetAnswers() {
    answers = new Array(QUESTIONS.length).fill(null);
    document.querySelectorAll('.opt.checked').forEach((el) => el.classList.remove('checked'));
    document.querySelectorAll('input[type=radio]').forEach((el) => { el.checked = false; });
    updateProgress();
  }

  $('startBtn').addEventListener('click', () => show('quiz'));
  $('backBtn').addEventListener('click', () => show('intro'));
  $('submitBtn').addEventListener('click', () => {
    if (answers.some((a) => a === null)) return;
    renderResult();
    show('result');
  });
  $('restartBtn').addEventListener('click', () => { resetAnswers(); show('quiz'); });
  $('homeBtn').addEventListener('click', () => { resetAnswers(); show('intro'); });

  renderQuiz();
})();
