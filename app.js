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

  // 根据人格 key + 稀有度生成一张头像
  function makeAvatar(typeKey, rarityKey, size = 180) {
    const rar = RARITY[rarityKey] || RARITY.common;
    const emoji = (window.SBTI_AVATARS && window.SBTI_AVATARS[typeKey]) || '❓';
    const c = rar.color;
    // 塔罗牌长宽比定为 2:3
    const height = Math.round(size * 1.5);
    return `
      <div class="tarot-card card-rarity-${rarityKey}" style="width: ${size}px; height: ${height}px; --rarity: ${c}">
        <div class="tarot-card-inner">
          <img src="./assets/avatars/${typeKey}.webp" alt="${typeKey}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
          <div class="tarot-fallback" style="display: none;">
             <span class="emoji" style="font-size: ${Math.round(size * 0.45)}px">${emoji}</span>
          </div>
        </div>
      </div>`;
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

    // 缓存供分享使用
    lastTop = top;
    lastDims = dims;

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

    // 社交兼容性标签
    const TAG_TIER = {
      S: { label: '极品', color: '#7ed0a0' },
      A: { label: '靠谱', color: '#7ad0ff' },
      B: { label: '看缘', color: '#ffd34d' },
      C: { label: '慎选', color: '#ff6b6b' },
    };
    const TAG_CAT = {
      love:   { icon: '💘', name: '恋爱搭子' },
      friend: { icon: '🤝', name: '友情搭子' },
      work:   { icon: '💼', name: '搭班搭子' },
      vibe:   { icon: '✨', name: '氛围感' },
    };
    $('tagList').innerHTML = (top.type.tags || []).map((t) => {
      const tier = TAG_TIER[t.tier] || TAG_TIER.B;
      const cat = TAG_CAT[t.cat] || { icon: '🏷️', name: t.cat };
      return `
        <li class="tag-item" style="border-left-color:${tier.color}">
          <div class="tag-item-head">
            <span class="tag-cat">
              <span class="tag-cat-icon">${cat.icon}</span>${cat.name}
            </span>
            <span class="tag-tier" style="color:${tier.color};background:${tier.color}18">
              ${tier.label}
            </span>
          </div>
          <p class="tag-desc">${escapeHtml(t.desc)}</p>
        </li>`;
    }).join('');

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

  // ---------- Share ----------
  let lastTop = null;  // 缓存结果供分享使用
  let lastDims = null;

  function generateShareImage() {
    const top = lastTop;
    const dims = lastDims;
    if (!top) return;

    const W = 720, H = 1400;
    const canvas = $('shareCanvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const rar = RARITY[top.type.rarity] || RARITY.common;
    const rarColor = rar.color;

    // 背景
    ctx.fillStyle = '#0f1115';
    ctx.fillRect(0, 0, W, H);

    // 顶部装饰线
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.3, rarColor);
    grad.addColorStop(0.7, rarColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 3);

    // 品牌
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8a90a0';
    ctx.font = '600 16px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('SBTI+ 人格测试', W / 2, 48);

    // "你的主人格"
    ctx.fillStyle = '#8a90a0';
    ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
    ctx.fillText('你的主人格', W / 2, 80);

    // 头像区域 —— 加载 webp 图片绘制
    const avatarSize = 200;
    const avatarH = 300;
    const avatarX = (W - avatarSize) / 2;
    const avatarY = 100;

    // 头像外框光晕
    ctx.save();
    ctx.shadowColor = rarColor;
    ctx.shadowBlur = 24;
    ctx.fillStyle = '#171a21';
    roundRect(ctx, avatarX - 6, avatarY - 6, avatarSize + 12, avatarH + 12, 14);
    ctx.fill();
    ctx.restore();

    // 头像内框背景
    ctx.fillStyle = '#0f1115';
    roundRect(ctx, avatarX, avatarY, avatarSize, avatarH, 10);
    ctx.fill();

    // 加载头像图片并绘制
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.save();
      roundRect(ctx, avatarX, avatarY, avatarSize, avatarH, 10);
      ctx.clip();
      ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarH);
      ctx.restore();
      drawTextContent();
    };
    img.onerror = () => {
      // fallback: 画 emoji
      const emoji = (window.SBTI_AVATARS && window.SBTI_AVATARS[top.type.k]) || '?';
      ctx.font = '80px serif';
      ctx.textAlign = 'center';
      ctx.fillText(emoji, W / 2, avatarY + avatarH / 2 + 28);
      drawTextContent();
    };
    img.src = `./assets/avatars/${top.type.k}.webp`;

    function drawTextContent() {
      let y = avatarY + avatarH + 40;

      // 人格名称
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e7e9ee';
      ctx.font = 'bold 48px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(top.type.name, W / 2, y);
      y += 32;

      // Code
      ctx.fillStyle = '#7ad0ff';
      ctx.font = '600 18px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(top.type.sub, W / 2, y);
      y += 36;

      // 稀有度徽章
      const badgeText = `${rar.stars}  ${rar.short} · ${rar.label}`;
      ctx.font = 'bold 14px -apple-system, "PingFang SC", sans-serif';
      const badgeW = ctx.measureText(badgeText).width + 32;
      const badgeX = (W - badgeW) / 2;
      ctx.strokeStyle = rarColor;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      roundRect(ctx, badgeX, y - 16, badgeW, 28, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = rarColor;
      ctx.fillText(badgeText, W / 2, y + 4);
      y += 32;

      // 匹配度
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 20px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(`匹配度 ${top.match}%`, W / 2, y);
      y += 36;

      // Tagline
      ctx.fillStyle = '#e7e9ee';
      ctx.font = 'italic 18px -apple-system, "PingFang SC", sans-serif';
      const tagline = `"${top.type.tagline}"`;
      const taglineLines = wrapText(ctx, tagline, W - 120);
      taglineLines.forEach((line) => {
        ctx.fillText(line, W / 2, y);
        y += 26;
      });
      y += 16;

      // 分隔线
      ctx.strokeStyle = '#262b36';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
      y += 28;

      // 社交兼容性标签
      const TAG_TIER = {
        S: { label: '极品', color: '#7ed0a0' },
        A: { label: '靠谱', color: '#7ad0ff' },
        B: { label: '看缘', color: '#ffd34d' },
        C: { label: '慎选', color: '#ff6b6b' },
      };
      const TAG_CAT = {
        love: { icon: '\u{1F498}', name: '恋爱搭子' },
        friend: { icon: '\u{1F91D}', name: '友情搭子' },
        work: { icon: '\u{1F4BC}', name: '搭班搭子' },
        vibe: { icon: '\u2728', name: '氛围感' },
      };

      ctx.textAlign = 'left';
      ctx.fillStyle = '#8a90a0';
      ctx.font = '600 14px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText('社交兼容性', 60, y);
      y += 20;

      const tags = top.type.tags || [];
      const tagColW = (W - 120 - 16) / 2;

      tags.forEach((t, i) => {
        const tier = TAG_TIER[t.tier] || TAG_TIER.B;
        const cat = TAG_CAT[t.cat] || { icon: '', name: t.cat };
        const col = i % 2;
        const tx = 60 + col * (tagColW + 16);
        const ty = y + Math.floor(i / 2) * 56;

        // Tag card background
        ctx.fillStyle = '#1e222b';
        roundRect(ctx, tx, ty, tagColW, 46, 8);
        ctx.fill();

        // Left border color
        ctx.fillStyle = tier.color;
        roundRect(ctx, tx, ty, 3, 46, 2);
        ctx.fill();

        // Cat name
        ctx.fillStyle = '#e7e9ee';
        ctx.font = '600 13px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(`${cat.name}`, tx + 14, ty + 20);

        // Tier label
        ctx.fillStyle = tier.color;
        ctx.font = 'bold 12px -apple-system, "PingFang SC", sans-serif';
        const tierText = tier.label;
        const tierW = ctx.measureText(tierText).width + 14;
        ctx.fillText(tierText, tx + tagColW - tierW, ty + 20);

        // Desc (truncated)
        ctx.fillStyle = '#8a90a0';
        ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
        const desc = t.desc.length > 16 ? t.desc.slice(0, 15) + '…' : t.desc;
        ctx.fillText(desc, tx + 14, ty + 38);
      });

      y += Math.ceil(tags.length / 2) * 56 + 24;

      // 分隔线
      ctx.strokeStyle = '#262b36';
      ctx.beginPath();
      ctx.moveTo(60, y);
      ctx.lineTo(W - 60, y);
      ctx.stroke();
      y += 24;

      // 维度概览（精简版：只显示维度名 + 等级）
      ctx.fillStyle = '#8a90a0';
      ctx.font = '600 14px -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('十五维度概览', 60, y);
      y += 20;

      const dimCols = 3;
      const dimColW = (W - 120 - (dimCols - 1) * 12) / dimCols;

      DIMS.forEach((d, i) => {
        const v = dims[d.code];
        const lv = levelOf(v);
        const col = i % dimCols;
        const row = Math.floor(i / dimCols);
        const dx = 60 + col * (dimColW + 12);
        const dy = y + row * 38;

        // Background
        ctx.fillStyle = '#1e222b';
        roundRect(ctx, dx, dy, dimColW, 30, 6);
        ctx.fill();

        // Dim name
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e7e9ee';
        ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(d.name, dx + 10, dy + 20);

        // Level
        const lvColors = { H: '#ffd34d', M: '#7ad0ff', L: '#b0a5ff' };
        ctx.textAlign = 'right';
        ctx.fillStyle = lvColors[lv] || '#8a90a0';
        ctx.font = 'bold 13px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(lv, dx + dimColW - 10, dy + 20);
      });

      y += Math.ceil(DIMS.length / dimCols) * 38 + 24;

      // 底部区域：二维码 + 网址
      const ctaGrad = ctx.createLinearGradient(0, H - 150, W, H - 150);
      ctaGrad.addColorStop(0, 'transparent');
      ctaGrad.addColorStop(0.3, '#262b36');
      ctaGrad.addColorStop(0.7, '#262b36');
      ctaGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = ctaGrad;
      ctx.fillRect(0, H - 150, W, 1);

      // 二维码
      const qrSize = 90;
      const qrX = 60;
      const qrY = H - 130;
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      qrImg.onload = () => {
        // 二维码白底圆角
        ctx.fillStyle = '#fff';
        roundRect(ctx, qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 8);
        ctx.fill();
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
        finishShare();
      };
      qrImg.onerror = () => finishShare();
      qrImg.src = './assets/qrcode.webp';

      function finishShare() {
        // 右侧文字
        const textX = qrX + qrSize + 24;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e7e9ee';
        ctx.font = 'bold 18px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText('扫码测测你是哪种稀有人格', textX, qrY + 28);

        ctx.fillStyle = rarColor;
        ctx.font = '600 16px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText('sbti.finboo.cn', textX, qrY + 54);

        ctx.fillStyle = '#8a90a0';
        ctx.font = '12px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText('SBTI+ 人格测试 · 纯娱乐', textX, qrY + 78);

        // 底部装饰线
        ctx.fillStyle = grad;
        ctx.fillRect(0, H - 3, W, 3);

        // 显示浮层
        $('shareOverlay').style.display = 'flex';
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function saveShareImage() {
    const canvas = $('shareCanvas');
    canvas.toBlob((blob) => {
      if (!blob) return;
      // 尝试 Web Share API
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], 'sbti-result.png', { type: 'image/png' });
        const shareData = { files: [file] };
        if (navigator.canShare(shareData)) {
          navigator.share(shareData).catch(() => {});
          return;
        }
      }
      // fallback: 下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sbti-result.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
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
  $('shareBtn').addEventListener('click', generateShareImage);
  $('shareSaveBtn').addEventListener('click', saveShareImage);
  $('shareCloseBtn').addEventListener('click', () => { $('shareOverlay').style.display = 'none'; });
  $('shareOverlay').addEventListener('click', (e) => {
    if (e.target === $('shareOverlay')) $('shareOverlay').style.display = 'none';
  });

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
