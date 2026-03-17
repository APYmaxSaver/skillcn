(() => {
    let skillsData = null;
    let currentCategory = 'all';
    let currentSort = 'popularity';
    let searchQuery = '';

    async function init() {
        try {
            const resp = await fetch('data/skills.json');
            skillsData = await resp.json();
        } catch {
            // Fallback: try inline
            console.error('Failed to load skills.json');
            return;
        }
        buildCategoryList();
        renderSkills();
        bindEvents();
    }

    function buildCategoryList() {
        const list = document.getElementById('categoryList');
        const totalCount = skillsData.skills.length;
        document.getElementById('totalCount').textContent = totalCount;

        skillsData.categories
            .sort((a, b) => b.popularity - a.popularity)
            .forEach(cat => {
                const count = skillsData.skills.filter(s => s.category === cat.id).length;
                const li = document.createElement('li');
                li.className = 'category-item';
                li.dataset.category = cat.id;
                li.innerHTML = `
                    <span class="cat-icon">${cat.icon}</span>
                    <span class="cat-name">${cat.name}</span>
                    <span class="cat-count">${count}</span>
                `;
                list.appendChild(li);
            });
    }

    function getFilteredSkills() {
        let skills = [...skillsData.skills];

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

        return skills;
    }

    function sortSkills(skills) {
        if (currentSort === 'popularity') {
            return skills.sort((a, b) => b.popularity - a.popularity);
        } else if (currentSort === 'name') {
            return skills.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
        }
        // category sort returns skills grouped
        return skills;
    }

    function getPopularityClass(p) {
        if (p >= 85) return 'popularity-high';
        if (p >= 70) return 'popularity-mid';
        return 'popularity-low';
    }

    function getPopularityLabel(p) {
        if (p >= 90) return '🔥 热门';
        if (p >= 80) return '⭐ 推荐';
        if (p >= 70) return '📌 实用';
        return '📎 一般';
    }

    function getCategoryName(catId) {
        const cat = skillsData.categories.find(c => c.id === catId);
        return cat ? `${cat.icon} ${cat.name}` : catId;
    }

    function renderSkillCard(skill) {
        const popClass = getPopularityClass(skill.popularity);
        const popLabel = getPopularityLabel(skill.popularity);

        return `
            <div class="skill-card" data-skill-id="${skill.id}">
                <div class="skill-card-header">
                    <div>
                        <div class="skill-name">${skill.name}</div>
                        <div class="skill-name-en">${skill.nameEn}</div>
                    </div>
                    <span class="popularity-badge ${popClass}">${popLabel}</span>
                </div>
                <div class="skill-desc">${skill.description}</div>
                <div class="skill-tags">
                    ${skill.tags.map(t => `<span class="skill-tag">${t}</span>`).join('')}
                </div>
                <div class="skill-source">
                    <span class="skill-category-badge">${getCategoryName(skill.category)}</span>
                    <span>${skill.source}</span>
                </div>
            </div>
        `;
    }

    function renderSkills() {
        const grid = document.getElementById('skillsGrid');
        const skills = getFilteredSkills();
        const sorted = sortSkills(skills);

        // Update count
        const countEl = document.getElementById('skillCount');
        countEl.textContent = `${sorted.length} 个技能`;

        // Update title
        const titleEl = document.getElementById('contentTitle');
        if (currentCategory === 'all') {
            titleEl.textContent = searchQuery ? `搜索: "${searchQuery}"` : '全部技能';
        } else {
            titleEl.textContent = getCategoryName(currentCategory);
        }

        if (sorted.length === 0) {
            grid.innerHTML = '<div class="empty-state"><p>没有找到匹配的技能</p></div>';
            return;
        }

        if (currentSort === 'category') {
            // Group by category
            const groups = {};
            sorted.forEach(s => {
                if (!groups[s.category]) groups[s.category] = [];
                groups[s.category].push(s);
            });

            // Sort groups by category popularity
            const sortedGroups = Object.entries(groups).sort((a, b) => {
                const catA = skillsData.categories.find(c => c.id === a[0]);
                const catB = skillsData.categories.find(c => c.id === b[0]);
                return (catB?.popularity || 0) - (catA?.popularity || 0);
            });

            let html = '';
            sortedGroups.forEach(([catId, catSkills]) => {
                catSkills.sort((a, b) => b.popularity - a.popularity);
                html += `<div class="category-group-header"><h3>${getCategoryName(catId)} (${catSkills.length})</h3></div>`;
                html += catSkills.map(renderSkillCard).join('');
            });
            grid.innerHTML = html;
        } else {
            grid.innerHTML = sorted.map(renderSkillCard).join('');
        }
    }

    function showModal(skillId) {
        const skill = skillsData.skills.find(s => s.id === skillId);
        if (!skill) return;

        const content = document.getElementById('modalContent');
        content.innerHTML = `
            <h2>${skill.name}</h2>
            <div class="modal-name-en">${skill.nameEn}</div>
            <div class="modal-desc">${skill.description}</div>
            <div class="modal-section">
                <h4>英文描述</h4>
                <p style="color: var(--text-secondary); font-size: 0.9rem;">${skill.descriptionEn}</p>
            </div>
            <div class="modal-section">
                <h4>标签</h4>
                <div class="modal-tags">
                    ${skill.tags.map(t => `<span class="modal-tag">${t}</span>`).join('')}
                </div>
            </div>
            <div class="modal-section">
                <h4>分类</h4>
                <p>${getCategoryName(skill.category)}</p>
            </div>
            <div class="modal-section">
                <h4>热度指数</h4>
                <p><span class="popularity-badge ${getPopularityClass(skill.popularity)}">${getPopularityLabel(skill.popularity)} ${skill.popularity}/100</span></p>
            </div>
            <div class="modal-section">
                <h4>安装方式</h4>
                <div class="modal-install">cd your-project
mkdir -p .claude/skills
# 从源仓库复制技能文件夹
git clone ${skill.sourceUrl} /tmp/skill-source
cp -r /tmp/skill-source/${skill.nameEn} .claude/skills/</div>
            </div>
            <div class="modal-section" style="margin-top: 20px;">
                <a class="modal-link" href="${skill.sourceUrl}" target="_blank">查看源仓库 →</a>
            </div>
        `;

        document.getElementById('modalOverlay').classList.add('active');
    }

    function hideModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }

    function bindEvents() {
        // Category clicks
        document.getElementById('categoryList').addEventListener('click', (e) => {
            const item = e.target.closest('.category-item');
            if (!item) return;

            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            currentCategory = item.dataset.category;
            renderSkills();
        });

        // Sort buttons
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentSort = btn.dataset.sort;
                renderSkills();
            });
        });

        // Search
        let searchTimer;
        document.getElementById('searchInput').addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchQuery = e.target.value.trim();
                renderSkills();
            }, 200);
        });

        // Skill card clicks
        document.getElementById('skillsGrid').addEventListener('click', (e) => {
            const card = e.target.closest('.skill-card');
            if (!card) return;
            showModal(card.dataset.skillId);
        });

        // Modal close
        document.getElementById('modalClose').addEventListener('click', hideModal);
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) hideModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') hideModal();
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
