// Основные переменные
let chart = null;
let currentData = {};
let API_BASE_URL = "https://gleeful-starship-f36033.netlify.app"

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Сайт загружен');
    
    // Инициализируем навигацию
    initNavigation();
    
    // Загружаем начальные данные
    loadStats();
    
    // Обновляем каждые 30 секунд
    setInterval(loadStats, 30000);
});

// Инициализация навигации
function initNavigation() {
    // Скрываем все неактивные секции
    document.querySelectorAll('.content-section:not(.active)').forEach(section => {
        section.style.display = 'none';
    });
    
    // Обработчик кликов в меню
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href.startsWith('/')) {
                window.location.href = href;
                return;
            }
            const sectionId = href.substring(1);
            showSection(sectionId);
        });
    });
    
    // Обработчик для кнопки обновления
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        btn.addEventListener('click', function() {
            const sectionId = this.closest('.content-section').id;
            loadSectionData(sectionId);
        });
    });
}

// Переключение мобильного меню
function toggleMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('mobile-open');
}

// Переключение секций
function showSection(sectionId) {
    console.log('Показать секцию:', sectionId);
    
    // Скрываем все секции
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.style.display = 'block';
        activeSection.classList.add('active');
        
        // Прокручиваем к началу
        setTimeout(() => {
            activeSection.scrollTop = 0;
        }, 10);
    }
    
    // Обновляем активную ссылку в меню
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
        }
    });
    
    // Закрываем мобильное меню
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
    }
    
    // Загружаем данные для секции
    loadSectionData(sectionId);
}

// Загрузка данных для секции
function loadSectionData(sectionId) {
    console.log('Загрузка данных для секции:', sectionId);
    
    switch(sectionId) {
        case 'dashboard':
            loadStats();
            break;
        case 'top-players':
            loadTopPlayers();
            break;
        case 'matroskin-top':
            loadTopMatroskin();
            break;
        case 'shop-stats':
            loadShopStats();
            break;
        case 'prestige':
            loadPrestigeLevels();
            break;
        case 'search':
            // Очищаем результаты поиска
            document.getElementById('search-result').innerHTML = `
                <div class="search-placeholder">
                    <i class="fas fa-user-search"></i>
                    <p>Введите ID или ник игрока для поиска</p>
                </div>
            `;
            break;
        case 'find-id':
            // Ничего не загружаем специально
            break;
    }
}

// Загрузка общей статистики
async function loadStats() {
    try {
        console.log('Загрузка статистики...');
        const [statsResponse, playersResponse] = await Promise.all([
            fetch(window.API_BASE_URL + '/api/stats'),
            fetch(window.API_BASE_URL + '/api/top/players')
        ]);
        
        if (!statsResponse.ok || !playersResponse.ok) {
            throw new Error('Ошибка сети');
        }
        
        const stats = await statsResponse.json();
        const players = await playersResponse.json();
        
        // Обновляем счетчики
        document.getElementById('total-players').textContent = stats.total_players;
        document.getElementById('total-cats').textContent = stats.total_cats.toLocaleString();
        document.getElementById('total-matroskin').textContent = stats.total_matroskin;
        document.getElementById('total-attacks').textContent = stats.total_attacks;
        document.getElementById('player-count').textContent = `${stats.total_players} игроков`;
        
        // Обновляем время последнего обновления
        const now = new Date();
        document.getElementById('last-update-text').textContent = 
            `Обновлено: ${now.toLocaleTimeString()}`;
        
        // Создаем распределение по престижу
        const prestigeData = {};
        players.forEach(player => {
            const level = player.prestige_level || player.prestige || 0;
            prestigeData[level] = (prestigeData[level] || 0) + 1;
        });
        
        // Создаем/обновляем график
        updatePrestigeChart(prestigeData);
        
        console.log('Статистика загружена успешно');
        
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Обновление графика престижа
function updatePrestigeChart(data) {
    const ctx = document.getElementById('prestigeChart');
    if (!ctx) return;
    
    const ctx2d = ctx.getContext('2d');
    
    const labels = Object.keys(data).map(level => {
        if (level === '0') return 'Без престижа';
        const emojis = {1:'🎗',2:'🥉',3:'🥈',4:'🥇',5:'🏅',6:'🎖',7:'🏵',8:'🏆',9:'💎',10:'👑'};
        return `${emojis[level] || '🎗'} Уровень ${level}`;
    });
    
    const values = Object.values(data);
    const colors = [
        '#e2e8f0', '#667eea', '#764ba2', '#f093fb', 
        '#f5576c', '#4facfe', '#00f2fe', '#43e97b',
        '#38f9d7', '#fa709a', '#fee140'
    ];
    
    if (chart) {
        chart.destroy();
    }
    
    chart = new Chart(ctx2d, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${label}: ${value} игроков (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Загрузка топ игроков
async function loadTopPlayers() {
    try {
        console.log('Загрузка топ игроков...');
        const response = await fetch(window.API_BASE_URL + '/api/top/players');
        
        if (!response.ok) {
            throw new Error('Ошибка сети');
        }
        
        const players = await response.json();
        const container = document.getElementById('top-players-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (players.length === 0) {
            container.innerHTML = '<div class="loading">Нет данных о игроках</div>';
            return;
        }
        
        players.forEach((player, index) => {
            const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
            const item = document.createElement('div');
            item.className = 'player-item';
            item.innerHTML = `
                <div class="rank ${rankClass}">${index + 1}</div>
                <div class="player-info">
                    <div class="player-name">
                        ${player.nickname || 'Без ника'}
                        <span class="prestige-badge">${player.prestige_emoji || ''}</span>
                    </div>
                    <div class="player-stats">
                        <span><i class="fas fa-cat"></i> ${(player.cats || 0).toLocaleString()} кошек</span>
                        <span><i class="fas fa-crown"></i> ${player.matroskin || 0} матроскинов</span>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
        
        console.log('Топ игроков загружен:', players.length, 'игроков');
        
    } catch (error) {
        console.error('Ошибка загрузки топ игроков:', error);
        const container = document.getElementById('top-players-list');
        if (container) {
            container.innerHTML = '<div class="loading error">Ошибка загрузки данных</div>';
        }
        showNotification('Ошибка загрузки топ игроков', 'error');
    }
}

// Загрузка топ Матроскинов
async function loadTopMatroskin() {
    try {
        console.log('Загрузка топ Матроскинов...');
        const response = await fetch(window.API_BASE_URL + '/api/top/matroskin');
        
        if (!response.ok) {
            throw new Error('Ошибка сети');
        }
        
        const players = await response.json();
        const container = document.getElementById('matroskin-list');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (players.length === 0) {
            container.innerHTML = '<div class="loading">Нет данных о Матроскинах</div>';
            return;
        }
        
        players.forEach((player, index) => {
            const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
            const item = document.createElement('div');
            item.className = 'player-item';
            item.innerHTML = `
                <div class="rank ${rankClass}">${index + 1}</div>
                <div class="player-info">
                    <div class="player-name">${player.nickname || 'Без ника'}</div>
                    <div class="player-stats">
                        <span><i class="fas fa-crown"></i> ${player.matroskin || 0} матроскинов</span>
                        <span><i class="fas fa-cat"></i> ${(player.cats || 0).toLocaleString()} кошек</span>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
        
        console.log('Топ Матроскинов загружен:', players.length, 'игроков');
        
    } catch (error) {
        console.error('Ошибка загрузки топ Матроскинов:', error);
        const container = document.getElementById('matroskin-list');
        if (container) {
            container.innerHTML = '<div class="loading error">Ошибка загрузки данных</div>';
        }
        showNotification('Ошибка загрузки топ Матроскинов', 'error');
    }
}

// Загрузка статистики магазина
async function loadShopStats() {
    try {
        console.log('Загрузка статистики магазина...');
        const [statsResponse, itemsResponse] = await Promise.all([
            fetch(window.API_BASE_URL + '/api/stats'),
            fetch(window.API_BASE_URL + '/api/shop/items')
        ]);
        
        if (!statsResponse.ok || !itemsResponse.ok) {
            throw new Error('Ошибка сети');
        }
        
        const stats = await statsResponse.json();
        const items = await itemsResponse.json();
        const container = document.getElementById('shop-items-grid');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        let hasItems = false;
        
        for (const [itemKey, itemData] of Object.entries(items)) {
            hasItems = true;
            const count = stats.shop_items?.[itemKey] || 0;
            const card = document.createElement('div');
            card.className = 'shop-item-card';
            
            let upgradesHtml = '';
            if (itemData.upgrades) {
                upgradesHtml = '<div class="shop-item-stats">';
                for (const [level, upgrade] of Object.entries(itemData.upgrades)) {
                    if (level <= 5) {
                        upgradesHtml += `
                            <div class="stat-row">
                                <span class="stat-label">Уровень ${level}</span>
                                <span class="stat-value">${upgrade.price} кошек</span>
                            </div>
                        `;
                    }
                }
                if (Object.keys(itemData.upgrades).length > 5) {
                    upgradesHtml += `<div class="stat-row">
                        <span class="stat-label">...</span>
                        <span class="stat-value">${Object.keys(itemData.upgrades).length - 5} уровней</span>
                    </div>`;
                }
                upgradesHtml += '</div>';
            }
            
            card.innerHTML = `
                <div class="shop-item-header">
                    <div class="shop-item-icon">${itemData.name.split(' ')[0] || '📦'}</div>
                    <div class="shop-item-info">
                        <h3>${itemData.name}</h3>
                        <div class="price">${itemData.base_price || itemData.price || 0} кошек</div>
                    </div>
                </div>
                <p class="shop-item-description">${itemData.description || 'Без описания'}</p>
                <div class="stat-row">
                    <span class="stat-label">Всего куплено:</span>
                    <span class="stat-value">${count} шт</span>
                </div>
                ${upgradesHtml}
            `;
            container.appendChild(card);
        }
        
        if (!hasItems) {
            container.innerHTML = '<div class="loading">Нет данных о магазине</div>';
        }
        
        console.log('Статистика магазина загружена');
        
    } catch (error) {
        console.error('Ошибка загрузки магазина:', error);
        const container = document.getElementById('shop-items-grid');
        if (container) {
            container.innerHTML = '<div class="loading error">Ошибка загрузки данных</div>';
        }
        showNotification('Ошибка загрузки магазина', 'error');
    }
}

// Загрузка уровней престижа
async function loadPrestigeLevels() {
    try {
        console.log('Загрузка уровней престижа...');
        const response = await fetch(window.API_BASE_URL + '/api/prestige/levels');
        
        if (!response.ok) {
            throw new Error('Ошибка сети');
        }
        
        const levels = await response.json();
        const container = document.getElementById('prestige-levels');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (Object.keys(levels).length === 0) {
            container.innerHTML = '<div class="loading">Нет данных о престиже</div>';
            return;
        }
        
        for (const [level, data] of Object.entries(levels)) {
            const card = document.createElement('div');
            card.className = 'prestige-level-card';
            card.innerHTML = `
                <div class="prestige-header">
                    <div class="prestige-emoji">${data.emoji || '🎗'}</div>
                    <div class="prestige-level-info">
                        <h3>Уровень престижа ${level}</h3>
                        <div class="level">${data.emoji || '🎗'} ${getPrestigeName(level)}</div>
                    </div>
                </div>
                <div class="prestige-bonuses">
                    <div class="bonus-item">
                        <div class="bonus-value">+${data.bonus_success || 0}</div>
                        <div class="bonus-label">При успехе</div>
                    </div>
                    <div class="bonus-item">
                        <div class="bonus-value">${data.bonus_fail || 0}</div>
                        <div class="bonus-label">При неудаче</div>
                    </div>
                    <div class="bonus-item">
                        <div class="bonus-value">${(data.base_price || 0) + (500 * (parseInt(level) - 1))}</div>
                        <div class="bonus-label">Стоимость</div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        }
        
        console.log('Уровни престижа загружены:', Object.keys(levels).length, 'уровней');
        
    } catch (error) {
        console.error('Ошибка загрузки престижа:', error);
        const container = document.getElementById('prestige-levels');
        if (container) {
            container.innerHTML = '<div class="loading error">Ошибка загрузки данных</div>';
        }
        showNotification('Ошибка загрузки престижа', 'error');
    }
}

// Поиск игрока
async function searchPlayer() {
    const searchInput = document.getElementById('player-search');
    const query = searchInput.value.trim();
    
    if (!query) {
        showNotification('Введите ID или ник игрока', 'error');
        return;
    }
    
    try {
        console.log('Поиск игрока:', query);
        
        let response;
        if (/^\d+$/.test(query)) {
            response = await fetch(`${window.API_BASE_URL}/api/player/${query}`);
        } else {
            response = await fetch(`${window.API_BASE_URL}/api/search/player?q=${encodeURIComponent(query)}`);
        }
        
        if (response.ok) {
            const playerData = await response.json();
            displayPlayerSearchResult(playerData);
            console.log('Игрок найден:', playerData.nickname);
        } else {
            throw new Error('Игрок не найден');
        }
        
    } catch (error) {
        console.error('Ошибка поиска игрока:', error);
        showNotification(error.message || 'Игрок не найден', 'error');
        
        const container = document.getElementById('search-result');
        if (container) {
            container.innerHTML = `
                <div class="search-placeholder">
                    <i class="fas fa-user-slash"></i>
                    <p>Игрок "${query}" не найден</p>
                    <p style="font-size: 14px; margin-top: 10px;">Проверьте правильность ввода или попробуйте другой ник</p>
                </div>
            `;
        }
    }
}

// Отображение результатов поиска игрока
function displayPlayerSearchResult(playerData) {
    const container = document.getElementById('search-result');
    if (!container) return;
    
    // Формируем инвентарь
    let inventoryHtml = '';
    if (playerData.inventory) {
        const inventoryItems = Object.entries(playerData.inventory)
            .filter(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    return (value.count || 0) > 0;
                }
                return (value || 0) > 0;
            })
            .map(([key, value]) => {
                const itemNames = {
                    'concentration_camp': '🏭 Концлагерь',
                    'machine_gun': '🔫 Автомат',
                    'bark_pants': '👖 Штаны',
                    'ass_glue': '🧴 Клей',
                    'trap': '🪤 Ловушка',
                    'hydrogen_bomb': '💣 Бомба'
                };
                
                let count = 0;
                let details = '';
                
                if (typeof value === 'object') {
                    count = value.count || 0;
                    if (value.uses_left !== undefined) {
                        details = ` (${value.uses_left} использований)`;
                    }
                } else {
                    count = value || 0;
                }
                
                return `<div class="inventory-item">
                    <div class="item-icon">${(itemNames[key] || key).split(' ')[0]}</div>
                    <div>
                        <div class="item-count">${count} шт${details}</div>
                        <div class="item-name">${itemNames[key] || key}</div>
                    </div>
                </div>`;
            });
        
        if (inventoryItems.length > 0) {
            inventoryHtml = `
                <div class="profile-inventory">
                    <h3><i class="fas fa-backpack"></i> Инвентарь</h3>
                    <div class="inventory-grid">
                        ${inventoryItems.join('')}
                    </div>
                </div>
            `;
        }
    }
    
    // Определяем эмодзи престижа
    const prestigeLevel = playerData.prestige_level || playerData.prestige || 0;
    const prestigeEmojis = {
        0: '', 1:'🎗',2:'🥉',3:'🥈',4:'🥇',5:'🏅',
        6:'🎖',7:'🏵',8:'🏆',9:'💎',10:'👑'
    };
    
    container.innerHTML = `
        <div class="player-profile">
            <div class="profile-header">
                <div class="profile-avatar">
                    ${prestigeEmojis[prestigeLevel] || '👤'}
                </div>
                <div class="profile-info">
                    <h2>
                        ${playerData.nickname || playerData.name || 'Без ника'}
                        ${playerData.rank ? `<span class="rank">#${playerData.rank} в топе</span>` : ''}
                    </h2>
                    <p>${prestigeLevel > 0 ? `Уровень престижа: ${prestigeLevel} ${prestigeEmojis[prestigeLevel]}` : 'Без престижа'}</p>
                </div>
            </div>
            
            <div class="profile-stats">
                <div class="profile-stat">
                    <div class="value">${playerData.cats || 0}</div>
                    <div class="label">Кошек</div>
                </div>
                <div class="profile-stat">
                    <div class="value">${playerData.matroskin || 0}</div>
                    <div class="label">Матроскинов</div>
                </div>
                <div class="profile-stat">
                    <div class="value">${playerData.attacks || 0}</div>
                    <div class="label">Атак</div>
                </div>
                <div class="profile-stat">
                    <div class="value">${playerData.successful_attacks || 0}</div>
                    <div class="label">Успешных атак</div>
                </div>
            </div>
            
            ${inventoryHtml}
            
            ${playerData.user_id || playerData.id ? `
                <div class="id-info" style="margin-top: 20px; padding: 15px; background: #f7fafc; border-radius: 10px;">
                    <p><strong>ID игрока:</strong> <code>${playerData.user_id || playerData.id}</code></p>
                    <button class="btn-small" onclick="savePlayerId('${playerData.user_id || playerData.id}')">
                        <i class="fas fa-save"></i> Сохранить ID для входа в игру
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

// Функция для поиска ID по нику
async function findMyId() {
    const nickname = document.getElementById('nickname-for-id').value.trim();
    if (!nickname) {
        showNotification('Введите никнейм для поиска', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/search/player?q=${encodeURIComponent(nickname)}`);
        if (!response.ok) throw new Error('Ошибка сети');
        
        const players = await response.json();
        
        if (players.length > 0) {
            const player = players[0];
            document.getElementById('id-result').innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <h4>Найден игрок:</h4>
                    <p><strong>Ник:</strong> ${player.nickname || 'Без ника'}</p>
                    <p><strong>Ваш ID:</strong> <code>${player.id || player.user_id}</code></p>
                    <p><strong>Кошкаст:</strong> ${player.cats || 0} кошек</p>
                    <button class="btn-small" onclick="copyToClipboard('${player.id || player.user_id}')">
                        <i class="fas fa-copy"></i> Скопировать ID
                    </button>
                    <button class="btn-small" onclick="document.getElementById('login-id').value = '${player.id || player.user_id}'">
                        <i class="fas fa-gamepad"></i> Использовать для входа
                    </button>
                </div>
            `;
        } else {
            throw new Error('Игрок не найден');
        }
    } catch (error) {
        console.error('Ошибка поиска ID:', error);
        document.getElementById('id-result').innerHTML = `
            <div style="text-align: center; color: #f56565; padding: 20px;">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${error.message}</p>
                <p>Попробуйте другой никнейм</p>
            </div>
        `;
    }
}

// Функция для входа с найденным ID
function loginWithFoundId() {
    const userId = document.getElementById('login-id').value.trim();
    if (!userId) {
        showNotification('Введите ID для входа в игру', 'error');
        return;
    }
    localStorage.setItem('kora_user_id', userId);
    window.location.href = '/game';
}

// Вспомогательные функции
function getPrestigeName(level) {
    const names = {
        1: 'Новичок', 2: 'Бронза', 3: 'Серебро', 4: 'Золото',
        5: 'Платина', 6: 'Алмаз', 7: 'Мастер', 8: 'Грандмастер',
        9: 'Легенда', 10: 'Бог'
    };
    return names[level] || `Уровень ${level}`;
}

function savePlayerId(userId) {
    localStorage.setItem('kora_user_id', userId);
    showNotification('ID сохранен! Теперь можете войти в игру', 'success');
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => showNotification('ID скопирован в буфер обмена', 'success'))
        .catch(err => showNotification('Ошибка копирования', 'error'));
}

function showNotification(message, type = 'success') {
    // Удаляем старое уведомление если есть
    const oldNotification = document.querySelector('.notification');
    if (oldNotification) {
        oldNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Экспорт функций для глобального использования
window.toggleMobileMenu = toggleMobileMenu;
window.showSection = showSection;
window.searchPlayer = searchPlayer;
window.loadStats = loadStats;
window.loadTopPlayers = loadTopPlayers;
window.loadTopMatroskin = loadTopMatroskin;
window.loadShopStats = loadShopStats;
window.loadPrestigeLevels = loadPrestigeLevels;
window.loginToGame = function() {
    const userId = prompt("Введите ваш ID игрока для входа в игру:");
    if (userId) {
        localStorage.setItem('kora_user_id', userId);
        window.location.href = '/game';
    }
};
window.loginWithFoundId = loginWithFoundId;
window.findMyId = findMyId;
window.savePlayerId = savePlayerId;
window.copyToClipboard = copyToClipboard;
