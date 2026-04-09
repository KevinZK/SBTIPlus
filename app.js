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

  // 稀有度元数据
  const RARITY = {
    common:   { label: '常见',   stars: '★',     short: 'COMMON'    },
    uncommon: { label: '普通',   stars: '★★',    short: 'UNCOMMON'  },
    rare:     { label: '稀有',   stars: '★★★',   short: 'RARE'      },
    epic:     { label: '史诗',   stars: '★★★★',  short: 'EPIC'      },
    legend:   { label: '传说',   stars: '★★★★★', short: 'LEGENDARY' },
  };

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

    $('resName').textContent = top.type.name;
    $('resCode').textContent = top.type.sub;
    $('resMatch').textContent = `匹配度 ${top.match}%`;

    // 稀有度徽章
    const r = RARITY[top.type.rarity] || RARITY.common;
    const badge = $('resRarity');
    badge.className = 'rarity-badge rarity-' + top.type.rarity;
    badge.innerHTML = `<span class="stars">${r.stars}</span><span class="rarity-label">${r.short} · ${r.label}</span>`;
    $('resTagline').textContent = `"${top.type.tagline}"`;
    $('resDesc').textContent = top.type.desc;

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
