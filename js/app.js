(() => {
    'use strict';

    // --- State ---
    let skillsData = null;
    let categoryMap = null;
    let currentCategory = 'all';
    let currentSort = 'popularity';
    let searchQuery = '';

    // Lazy load
    const INITIAL_RENDER = 18;
    const LOAD_MORE = 12;
    let renderedCount = 0;
    let allSorted = [];
    let observer = null;

    // --- DOM cache ---
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const dom = {};
    function cacheDom() {
        dom.grid = $('#skillsGrid');
        dom.skeleton = $('#skeleton');
        dom.categoryList = $('#categoryList');
        dom.totalCount = $('#totalCount');
        dom.skillCount = $('#skillCount');
        dom.contentTitle = $('#contentTitle');
        dom.searchInput = $('#searchInput');
        dom.searchClear = $('#searchClear');
        dom.searchKbd = $('#searchKbd');
        dom.modalOverlay = $('#modalOverlay');
        dom.modalContent = $('#modalContent');
        dom.modalClose = $('#modalClose');
        dom.themeToggle = $('#themeToggle');
        dom.backTop = $('#backTop');
        dom.navBar = $('#navBar');
        dom.stats = $('#stats');
        dom.sidebarToggle = $('#sidebarToggle');
        dom.sidebar = $('#sidebar');
    }

    // --- XSS Protection ---
    const escEl = document.createElement('div');
    function esc(str) {
        if (!str) return '';
        escEl.textContent = str;
        return escEl.innerHTML;
    }

    // --- Init ---
    async function init() {
        cacheDom();
        initTheme();
        bindEvents();

        try {
            const resp = await fetch('data/skills.json');
            if (!resp.ok) throw new Error(resp.status);
            skillsData = await resp.json();
        } catch (err) {
            console.error('Failed to load skills.json:', err);
            dom.grid.innerHTML = '<div class="empty-state"><div class="empty-icon">😵</div><p>加载失败，请刷新重试</p></div>';
            return;
        }

        categoryMap = new Map(skillsData.categories.map(c => [c.id, c]));

        restoreFromHash();
        buildCategoryList();
        renderSkills();
        updateStats();

        if (dom.skeleton) dom.skeleton.remove();
    }

    // --- Theme ---
    function initTheme() {
        const saved = localStorage.getItem('skillcn-theme');
        if (saved === 'dark' || (!saved && matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    }

    function toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('skillcn-theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('skillcn-theme', 'dark');
        }
    }

    // --- URL Hash Routing ---
    function updateHash() {
        const params = new URLSearchParams();
        if (currentCategory !== 'all') params.set('c', currentCategory);
        if (currentSort !== 'popularity') params.set('s', currentSort);
        if (searchQuery) params.set('q', searchQuery);
        const hash = params.toString();
        history.replaceState(null, '', hash ? `#${hash}` : location.pathname);
    }

    const VALID_SORTS = new Set(['popularity', 'category', 'name']);

    function restoreFromHash() {
        if (!location.hash) return;
        try {
            const params = new URLSearchParams(location.hash.slice(1));
            if (params.has('c')) {
                const cat = params.get('c');
                // Validate category exists (check after data loaded, fallback to 'all')
                if (skillsData && !skillsData.categories.some(c => c.id === cat)) {
                    currentCategory = 'all';
                } else {
                    currentCategory = cat;
                }
            }
            if (params.has('s')) {
                const sort = params.get('s');
                currentSort = VALID_SORTS.has(sort) ? sort : 'popularity';
            }
            if (params.has('q')) {
                searchQuery = params.get('q');
                dom.searchInput.value = searchQuery;
                syncSearchUI();
            }
            $$('.sort-btn').forEach(btn => {
                const isActive = btn.dataset.sort === currentSort;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-checked', isActive);
            });
        } catch { /* ignore */ }
    }

    // --- Category List ---
    function buildCategoryList() {
        const total = skillsData.skills.length;
        dom.totalCount.textContent = total;

        const frag = document.createDocumentFragment();
        skillsData.categories
            .sort((a, b) => b.popularity - a.popularity)
            .forEach(cat => {
                const count = skillsData.skills.filter(s => s.category === cat.id).length;
                if (count === 0) return;
                const li = document.createElement('li');
                li.className = 'category-item' + (currentCategory === cat.id ? ' active' : '');
                li.dataset.category = cat.id;
                li.setAttribute('role', 'option');
                li.setAttribute('aria-selected', currentCategory === cat.id);
                li.setAttribute('tabindex', '0');
                li.innerHTML = `<span class="cat-icon">${esc(cat.icon)}</span><span class="cat-name">${esc(cat.name)}</span><span class="cat-count">${count}</span>`;
                frag.appendChild(li);
            });
        dom.categoryList.appendChild(frag);

        if (currentCategory !== 'all') {
            const allItem = dom.categoryList.querySelector('[data-category="all"]');
            allItem.classList.remove('active');
            allItem.setAttribute('aria-selected', 'false');
        }
    }

    function updateStats() {
        const total = skillsData.skills.length;
        const catCount = skillsData.categories.length;
        dom.stats.textContent = `共 ${total} 个技能，${catCount} 个分类`;
    }

    // --- Search UI sync ---
    function syncSearchUI() {
        const hasQuery = dom.searchInput.value.trim().length > 0;
        dom.searchClear.classList.toggle('hidden', !hasQuery);
        dom.searchKbd.classList.toggle('hidden', hasQuery);
    }

    function clearSearch() {
        searchQuery = '';
        dom.searchInput.value = '';
        syncSearchUI();
        renderSkills();
        dom.searchInput.focus();
    }

    // --- Filtering & Sorting ---
    function getFilteredSkills() {
        let skills = skillsData.skills;

        if (currentCategory !== 'all') {
            skills = skills.filter(s => s.category === currentCategory);
        }

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            skills = skills.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.nameEn.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q) ||
                s.tags.some(t => t.toLowerCase().includes(q))
            );
        }

        return [...skills];
    }

    function sortSkills(skills) {
        if (currentSort === 'popularity') {
            skills.sort((a, b) => b.popularity - a.popularity);
        } else if (currentSort === 'name') {
            skills.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        }
        return skills;
    }

    // --- Helpers ---
    function popClass(p) {
        if (p >= 85) return 'popularity-high';
        if (p >= 70) return 'popularity-mid';
        return 'popularity-low';
    }

    function popLabel(p) {
        if (p >= 90) return '🔥 热门';
        if (p >= 80) return '⭐ 推荐';
        if (p >= 70) return '📌 实用';
        return '📎 一般';
    }

    function catName(catId) {
        const cat = categoryMap.get(catId);
        return cat ? `${cat.icon} ${cat.name}` : catId;
    }

    // --- Search Highlight (XSS-safe) ---
    function highlight(text, query) {
        if (!query) return esc(text);
        // Work on raw text, find match positions, then build escaped output
        // Note: query is already lowercased by caller
        const lower = text.toLowerCase();
        const qLower = query;
        const parts = [];
        let lastIdx = 0;
        let idx = lower.indexOf(qLower);
        while (idx !== -1) {
            if (idx > lastIdx) parts.push(esc(text.slice(lastIdx, idx)));
            parts.push('<mark>' + esc(text.slice(idx, idx + qLower.length)) + '</mark>');
            lastIdx = idx + qLower.length;
            idx = lower.indexOf(qLower, lastIdx);
        }
        if (lastIdx < text.length) parts.push(esc(text.slice(lastIdx)));
        return parts.join('');
    }

    // --- Install command builder ---
    function buildInstallCmd(skill) {
        // sourceUrl examples:
        //   https://github.com/anthropics/skills/tree/main/skills/docx
        //   https://github.com/daymade/claude-code-skills
        const url = skill.sourceUrl || '';
        const treeMatch = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/tree\/([^/]+)\/(.+)$/);

        if (treeMatch) {
            const repo = treeMatch[1];
            const branch = treeMatch[2];
            const path = treeMatch[3];
            return `# 克隆并提取技能文件
git clone --depth 1 -b ${branch} \\
  https://github.com/${repo}.git /tmp/_skill_tmp
mkdir -p .claude/skills/${esc(skill.nameEn)}
cp -r /tmp/_skill_tmp/${path}/* .claude/skills/${esc(skill.nameEn)}/
rm -rf /tmp/_skill_tmp`;
        }

        // Fallback: full repo clone
        return `# 克隆源仓库并手动复制技能文件
git clone --depth 1 ${esc(url)} /tmp/_skill_tmp
mkdir -p .claude/skills/${esc(skill.nameEn)}
# 将对应技能文件复制到上述目录
rm -rf /tmp/_skill_tmp`;
    }

    // --- Render ---
    function renderSkillCard(skill) {
        const pc = popClass(skill.popularity);
        const pl = popLabel(skill.popularity);
        const q = searchQuery.toLowerCase();

        return `<div class="skill-card" data-skill-id="${esc(skill.id)}" role="listitem" tabindex="0">
    <div class="skill-card-header">
        <div>
            <div class="skill-name">${highlight(skill.name, q)}</div>
            <div class="skill-name-en">${highlight(skill.nameEn, q)}</div>
        </div>
        <span class="popularity-badge ${pc}">${pl}</span>
    </div>
    <div class="skill-desc">${highlight(skill.description, q)}</div>
    <div class="skill-tags">${skill.tags.map(t => `<span class="skill-tag">${highlight(t, q)}</span>`).join('')}</div>
    <div class="skill-source">
        <span class="skill-category-badge">${esc(catName(skill.category))}</span>
        <span>${esc(skill.source)}</span>
    </div>
</div>`;
    }

    // --- Intersection Observer for lazy loading ---
    function setupObserver() {
        if (observer) observer.disconnect();

        const sentinel = document.createElement('div');
        sentinel.className = 'load-sentinel';
        sentinel.style.height = '1px';
        dom.grid.appendChild(sentinel);

        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && renderedCount < allSorted.length) {
                loadMore();
            }
        }, { rootMargin: '200px' });

        observer.observe(sentinel);
    }

    function loadMore() {
        const end = Math.min(renderedCount + LOAD_MORE, allSorted.length);
        const frag = document.createRange().createContextualFragment(
            allSorted.slice(renderedCount, end).map(renderSkillCard).join('')
        );

        // Insert before sentinel
        const sentinel = dom.grid.querySelector('.load-sentinel');
        if (sentinel) {
            dom.grid.insertBefore(frag, sentinel);
        } else {
            dom.grid.appendChild(frag);
        }
        renderedCount = end;

        // Remove sentinel if done
        if (renderedCount >= allSorted.length && observer) {
            observer.disconnect();
            const s = dom.grid.querySelector('.load-sentinel');
            if (s) s.remove();
        }
    }

    function renderSkills() {
        if (observer) observer.disconnect();

        const skills = getFilteredSkills();
        const sorted = sortSkills(skills);

        dom.skillCount.textContent = `${sorted.length} 个技能`;

        if (currentCategory === 'all') {
            dom.contentTitle.textContent = searchQuery ? `搜索: "${searchQuery}"` : '全部技能';
        } else {
            dom.contentTitle.textContent = catName(currentCategory);
        }

        if (sorted.length === 0) {
            const hasSearch = searchQuery.length > 0;
            dom.grid.innerHTML = `<div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>没有找到匹配的技能</p>
                ${hasSearch ? '<p class="empty-hint">试试其他关键词，或清除搜索条件</p><button class="empty-clear-btn" id="emptyClearBtn">清除搜索</button>' : ''}
            </div>`;
            if (hasSearch) {
                const btn = $('#emptyClearBtn');
                if (btn) btn.addEventListener('click', clearSearch);
            }
            updateHash();
            return;
        }

        if (currentSort === 'category') {
            // Category grouped view (no lazy load, usually fewer items per group header)
            const groups = new Map();
            sorted.forEach(s => {
                if (!groups.has(s.category)) groups.set(s.category, []);
                groups.get(s.category).push(s);
            });

            const sortedEntries = [...groups.entries()].sort((a, b) => {
                const ca = categoryMap.get(a[0]);
                const cb = categoryMap.get(b[0]);
                return (cb?.popularity || 0) - (ca?.popularity || 0);
            });

            const parts = [];
            for (const [catId, catSkills] of sortedEntries) {
                catSkills.sort((a, b) => b.popularity - a.popularity);
                parts.push(`<div class="category-group-header"><h3>${esc(catName(catId))} (${catSkills.length})</h3></div>`);
                parts.push(catSkills.map(renderSkillCard).join(''));
            }
            dom.grid.innerHTML = parts.join('');
        } else {
            // Lazy load: render initial batch, then use IntersectionObserver
            allSorted = sorted;
            renderedCount = 0;
            const initial = sorted.slice(0, INITIAL_RENDER);
            renderedCount = initial.length;
            dom.grid.innerHTML = initial.map(renderSkillCard).join('');

            if (sorted.length > INITIAL_RENDER) {
                setupObserver();
            }
        }

        updateHash();
    }

    // --- Modal ---
    function showModal(skillId) {
        const skill = skillsData.skills.find(s => s.id === skillId);
        if (!skill) return;

        const installCmd = buildInstallCmd(skill);

        dom.modalContent.innerHTML = `
            <h2>${esc(skill.name)}</h2>
            <div class="modal-name-en">${esc(skill.nameEn)}</div>
            <div class="modal-desc">${esc(skill.description)}</div>
            <div class="modal-section">
                <h4>英文描述</h4>
                <p style="color:var(--text-secondary);font-size:0.9rem">${esc(skill.descriptionEn)}</p>
            </div>
            <div class="modal-section">
                <h4>标签</h4>
                <div class="modal-tags">${skill.tags.map(t => `<span class="modal-tag">${esc(t)}</span>`).join('')}</div>
            </div>
            <div class="modal-section">
                <h4>分类</h4>
                <p>${esc(catName(skill.category))}</p>
            </div>
            <div class="modal-section">
                <h4>热度指数</h4>
                <p><span class="popularity-badge ${popClass(skill.popularity)}">${popLabel(skill.popularity)} ${skill.popularity}/100</span></p>
                <div class="modal-popularity-bar"><div class="modal-popularity-fill" style="width:${skill.popularity}%"></div></div>
            </div>
            <div class="modal-section">
                <h4>安装方式</h4>
                <div class="modal-install-wrapper">
                    <button class="copy-btn" id="copyInstallBtn" type="button">复制</button>
                    <div class="modal-install" id="installCode">${installCmd}</div>
                </div>
            </div>
            <div class="modal-section" style="margin-top:20px">
                <a class="modal-link" href="${esc(skill.sourceUrl)}" target="_blank" rel="noopener">查看源仓库 →</a>
            </div>`;

        // Copy button handler
        const copyBtn = $('#copyInstallBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const code = $('#installCode');
                if (!code) return;
                const text = code.textContent;
                navigator.clipboard.writeText(text).then(() => {
                    copyBtn.textContent = '已复制 ✓';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.textContent = '复制';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }).catch(() => {
                    // Fallback: select text
                    const range = document.createRange();
                    range.selectNodeContents(code);
                    const sel = getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);
                });
            });
        }

        dom.modalOverlay.classList.add('active');
        dom.modalOverlay.setAttribute('aria-hidden', 'false');

        // Scrollbar compensation: measure scrollbar width before hiding overflow
        const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
        document.documentElement.style.setProperty('--scrollbar-width', scrollbarW + 'px');
        document.body.classList.add('modal-open');

        dom.modalClose.focus();
    }

    function hideModal() {
        dom.modalOverlay.classList.remove('active');
        dom.modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');
        document.documentElement.style.removeProperty('--scrollbar-width');
    }

    // --- Modal focus trap ---
    function trapFocus(e) {
        if (!dom.modalOverlay.classList.contains('active')) return;
        if (e.key !== 'Tab') return;

        const modal = dom.modalOverlay.querySelector('.modal');
        const focusable = modal.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }

    // --- Events ---
    function bindEvents() {
        // Theme
        dom.themeToggle.addEventListener('click', toggleTheme);

        // Category clicks (delegation)
        dom.categoryList.addEventListener('click', handleCategoryClick);
        dom.categoryList.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCategoryClick(e);
            }
        });

        // Sort buttons
        $$('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('.sort-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-checked', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-checked', 'true');
                currentSort = btn.dataset.sort;
                renderSkills();
            });
        });

        // Search (debounced)
        let searchTimer;
        dom.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            syncSearchUI();
            searchTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                renderSkills();
            }, 180);
        });

        // Search clear button
        dom.searchClear.addEventListener('click', clearSearch);

        // Keyboard shortcuts + modal focus trap
        document.addEventListener('keydown', (e) => {
            // Focus trap when modal is open
            trapFocus(e);

            if (e.key === '/' && document.activeElement !== dom.searchInput && !dom.modalOverlay.classList.contains('active')) {
                e.preventDefault();
                dom.searchInput.focus();
            }
            if (e.key === 'Escape') {
                if (dom.modalOverlay.classList.contains('active')) {
                    hideModal();
                } else if (document.activeElement === dom.searchInput) {
                    dom.searchInput.blur();
                }
            }
        });

        // Skill card clicks (delegation)
        dom.grid.addEventListener('click', (e) => {
            const card = e.target.closest('.skill-card');
            if (card) showModal(card.dataset.skillId);
        });
        dom.grid.addEventListener('keydown', (e) => {
            if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('skill-card')) {
                e.preventDefault();
                showModal(e.target.dataset.skillId);
            }
        });

        // Modal close
        dom.modalClose.addEventListener('click', hideModal);
        dom.modalOverlay.addEventListener('click', (e) => {
            if (e.target === dom.modalOverlay) hideModal();
        });

        // Back to top
        dom.backTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Scroll: nav shadow + back-to-top visibility
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const y = window.scrollY;
                    dom.navBar.classList.toggle('scrolled', y > 10);
                    dom.backTop.classList.toggle('visible', y > 400);
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Mobile sidebar toggle
        dom.sidebarToggle.addEventListener('click', () => {
            const expanded = dom.sidebarToggle.getAttribute('aria-expanded') === 'true';
            dom.sidebarToggle.setAttribute('aria-expanded', !expanded);
            dom.sidebar.classList.toggle('collapsed', expanded);
        });

        // Hash change (browser back/forward)
        window.addEventListener('hashchange', () => {
            restoreFromHash();
            $$('.category-item').forEach(el => {
                const isActive = el.dataset.category === currentCategory;
                el.classList.toggle('active', isActive);
                el.setAttribute('aria-selected', isActive);
            });
            renderSkills();
        });
    }

    function handleCategoryClick(e) {
        const item = e.target.closest('.category-item');
        if (!item) return;

        $$('.category-item').forEach(el => {
            el.classList.remove('active');
            el.setAttribute('aria-selected', 'false');
        });
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        currentCategory = item.dataset.category;
        renderSkills();
    }

    // --- Start ---
    document.addEventListener('DOMContentLoaded', init);
})();
