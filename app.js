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
  let currentQ = 0;

  // ---------- Quiz ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  // 渲染当前这一题
  function renderCurrentQuestion(direction) {
    const total = QUESTIONS.length;
    const q = QUESTIONS[currentQ];
    const card = $('questionCard');

    // 切换动画：根据方向给一个入场 class
    card.classList.remove('slide-in-left', 'slide-in-right');
    void card.offsetWidth; // 强制重排让动画生效
    card.classList.add(direction === 'back' ? 'slide-in-left' : 'slide-in-right');

    $('qIdx').textContent = (currentQ + 1) + '.';
    $('qText').textContent = q.text;

    const optsEl = $('qOpts');
    optsEl.innerHTML = q.opts.map((o, j) => `
      <button type="button" class="opt ${answers[currentQ] === j ? 'checked' : ''}"
              data-opt="${j}">
        <span class="opt-letter">${String.fromCharCode(65 + j)}</span>
        <span class="opt-label">${escapeHtml(o.label)}</span>
      </button>
    `).join('');

    // 点击任意选项 → 记录答案 + 自动跳转
    optsEl.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => onPickOption(Number(btn.dataset.opt)));
    });

    // 上一题按钮可用性
    $('prevBtn').disabled = currentQ === 0;
    // 最后一题：如果已答，显示"查看结果"按钮
    const isLast = currentQ === total - 1;
    $('submitBtn').style.display = (isLast && answers[currentQ] != null) ? '' : 'none';

    updateProgress();
  }

  function onPickOption(optIdx) {
    answers[currentQ] = optIdx;
    // 视觉反馈：高亮选中
    $('qOpts').querySelectorAll('.opt').forEach((el, j) => {
      el.classList.toggle('checked', j === optIdx);
    });
    updateProgress();

    const total = QUESTIONS.length;
    if (currentQ < total - 1) {
      // 自动跳到下一题（短暂延迟让用户看清自己选了什么）
      setTimeout(() => {
        currentQ += 1;
        renderCurrentQuestion('forward');
      }, 260);
    } else {
      // 最后一题：显示提交按钮
      $('submitBtn').style.display = '';
      $('hint').textContent = '已经是最后一题，可以查看你的人格了 →';
    }
  }

  function goPrev() {
    if (currentQ === 0) return;
    currentQ -= 1;
    renderCurrentQuestion('back');
  }

  function updateProgress() {
    const done = answers.filter((a) => a !== null).length;
    const total = QUESTIONS.length;
    const cur = currentQ + 1;
    $('progressText').textContent = `${cur} / ${total}`;
    // 进度条按"已答题数"显示
    $('progressFill').style.width = (done / total * 100) + '%';
    if (done < total) {
      $('hint').textContent = answers[currentQ] != null
        ? '✓ 已选，自动进入下一题…'
        : '点选项即可，选完自动跳下一题';
    } else {
      $('hint').textContent = '全部答完，随时查看结果 →';
    }
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
    currentQ = 0;
    renderCurrentQuestion('forward');
  }

  // 结果页切换进来时触发 AdSense 填充（SPA 模式必须手动 push）
  function loadAds() {
    try {
      document.querySelectorAll('.ad-slot ins.adsbygoogle').forEach((el) => {
        if (el.getAttribute('data-adsbygoogle-status')) return;
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      });
    } catch (e) { /* ignore */ }
  }

  $('startBtn').addEventListener('click', () => {
    resetAnswers();
    show('quiz');
  });
  $('backBtn').addEventListener('click', () => show('intro'));
  $('prevBtn').addEventListener('click', goPrev);
  $('submitBtn').addEventListener('click', () => {
    if (answers.some((a) => a === null)) return;
    renderResult();
    show('result');
    loadAds();
  });
  $('restartBtn').addEventListener('click', () => { resetAnswers(); show('quiz'); });
  $('homeBtn').addEventListener('click', () => { resetAnswers(); show('intro'); });

  // 键盘快捷键：1/2/3 或 A/B/C 选项，← 返回上一题
  document.addEventListener('keydown', (e) => {
    if (!screens.quiz.classList.contains('active')) return;
    const key = e.key.toLowerCase();
    if (['1','2','3'].includes(key)) {
      onPickOption(Number(key) - 1);
    } else if (['a','b','c'].includes(key)) {
      onPickOption(key.charCodeAt(0) - 97);
    } else if (e.key === 'ArrowLeft') {
      goPrev();
    }
  });

  // 初始渲染第一题
  renderCurrentQuestion('forward');
})();
