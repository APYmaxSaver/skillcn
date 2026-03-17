(() => {
    'use strict';

    // --- State ---
    let skillsData = null;
    let categoryMap = null;  // Map<id, category> for O(1) lookup
    let currentCategory = 'all';
    let currentSort = 'popularity';
    let searchQuery = '';

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
        dom.modalOverlay = $('#modalOverlay');
        dom.modalContent = $('#modalContent');
        dom.modalClose = $('#modalClose');
        dom.themeToggle = $('#themeToggle');
        dom.backTop = $('#backTop');
        dom.navBar = $('#navBar');
        dom.stats = $('#stats');
    }

    // --- XSS Protection ---
    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
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
            dom.grid.innerHTML = '<div class="empty-state"><p>加载失败，请刷新重试</p></div>';
            return;
        }

        // Build category lookup map
        categoryMap = new Map(skillsData.categories.map(c => [c.id, c]));

        // Restore state from URL hash
        restoreFromHash();

        buildCategoryList();
        renderSkills();
        updateStats();

        // Remove skeleton
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

    function restoreFromHash() {
        if (!location.hash) return;
        try {
            const params = new URLSearchParams(location.hash.slice(1));
            if (params.has('c')) currentCategory = params.get('c');
            if (params.has('s')) currentSort = params.get('s');
            if (params.has('q')) {
                searchQuery = params.get('q');
                dom.searchInput.value = searchQuery;
            }
            // Sync sort buttons
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

        // Update "all" active state
        if (currentCategory !== 'all') {
            dom.categoryList.querySelector('[data-category="all"]').classList.remove('active');
            dom.categoryList.querySelector('[data-category="all"]').setAttribute('aria-selected', 'false');
        }
    }

    function updateStats() {
        const total = skillsData.skills.length;
        const catCount = skillsData.categories.length;
        dom.stats.textContent = `共 ${total} 个技能，${catCount} 个分类`;
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
        // category sort: handled in render
        return skills;
    }

    // --- Popularity Helpers ---
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

    // --- Search Highlight ---
    function highlight(text, query) {
        if (!query) return esc(text);
        const escaped = esc(text);
        const qEsc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return escaped.replace(new RegExp(`(${qEsc})`, 'gi'), '<mark>$1</mark>');
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

    function renderSkills() {
        const skills = getFilteredSkills();
        const sorted = sortSkills(skills);

        dom.skillCount.textContent = `${sorted.length} 个技能`;

        // Title
        if (currentCategory === 'all') {
            dom.contentTitle.textContent = searchQuery ? `搜索: "${searchQuery}"` : '全部技能';
        } else {
            dom.contentTitle.textContent = catName(currentCategory);
        }

        if (sorted.length === 0) {
            dom.grid.innerHTML = '<div class="empty-state"><p>没有找到匹配的技能</p></div>';
            updateHash();
            return;
        }

        let html;
        if (currentSort === 'category') {
            const groups = new Map();
            sorted.forEach(s => {
                if (!groups.has(s.category)) groups.set(s.category, []);
                groups.get(s.category).push(s);
            });

            // Sort groups by category popularity
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
            html = parts.join('');
        } else {
            html = sorted.map(renderSkillCard).join('');
        }

        dom.grid.innerHTML = html;
        updateHash();
    }

    // --- Modal ---
    function showModal(skillId) {
        const skill = skillsData.skills.find(s => s.id === skillId);
        if (!skill) return;

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
                <div class="modal-install">mkdir -p .claude/skills/${esc(skill.nameEn)}
# 方式一：直接从源仓库拉取
cd .claude/skills
git clone --depth 1 --filter=blob:none --sparse ${esc(skill.sourceUrl)} _tmp
cd _tmp && git sparse-checkout set ${esc(skill.nameEn)}
mv ${esc(skill.nameEn)}/* ../${esc(skill.nameEn)}/
cd .. && rm -rf _tmp

# 方式二：手动下载 SKILL.md 到对应目录</div>
            </div>
            <div class="modal-section" style="margin-top:20px">
                <a class="modal-link" href="${esc(skill.sourceUrl)}" target="_blank" rel="noopener">查看源仓库 →</a>
            </div>`;

        dom.modalOverlay.classList.add('active');
        dom.modalOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        dom.modalClose.focus();
    }

    function hideModal() {
        dom.modalOverlay.classList.remove('active');
        dom.modalOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
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
            searchTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                renderSkills();
            }, 180);
        });

        // "/" shortcut to focus search
        document.addEventListener('keydown', (e) => {
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

        // Hash change (browser back/forward)
        window.addEventListener('hashchange', () => {
            restoreFromHash();
            // Re-sync category UI
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
