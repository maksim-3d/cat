// Основные переменные
let chart = null;
let currentData = {};
let API_BASE_URL = "https://gleeful-starship-f36033.netlify.app";

// SSE (Server-Sent Events) переменные
let eventSource = null;
let isSSEConnected = false;
let sseReconnectTimeout = null;
let lastUpdateTime = null;
let pingInterval = null;
let eventsReceived = 0;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Сайт загружен');
    
    // Инициализируем навигацию
    initNavigation();
    
    // Загружаем начальные данные
    loadStats();
    
    // Подключаем SSE для реального времени
    connectSSE();
    
    // Обновляем каждые 30 секунд (резервный вариант)
    setInterval(loadStats, 30000);
    
    // Показываем статус подключения
    updateConnectionStatus();
});

// ========== SSE (Server-Sent Events) ==========
function testSSE() {
    fetch(`${window.API_BASE_URL}/api/test/sse`)
        .then(response => response.json())
        .then(data => {
            console.log('Тест SSE:', data);
            showNotification(`SSE работает! Клиентов: ${data.clients_connected || 0}`, 'success');
            updateSSEStatus('Работает ✓');
        })
        .catch(error => {
            console.error('Тест SSE не прошел:', error);
            showNotification('Ошибка подключения к SSE', 'error');
            updateSSEStatus('Ошибка ✗');
        });
}

function sendTestUpdate() {
    fetch(`${window.API_BASE_URL}/api/test/send_update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Тестовое обновление:', data);
        showNotification(data.message, 'success');
    })
    .catch(error => {
        console.error('Ошибка отправки теста:', error);
        showNotification('Ошибка отправки теста', 'error');
    });
}

function reconnectSSE() {
    showNotification('Переподключение SSE...', 'info');
    connectSSE();
}

function updateSSEStatus(status) {
    const statusElement = document.getElementById('sse-status-text');
    const timeElement = document.getElementById('last-update-time');
    const eventsElement = document.getElementById('events-count');
    
    if (statusElement) statusElement.textContent = status;
    if (timeElement) timeElement.textContent = lastUpdateTime ? lastUpdateTime.toLocaleTimeString() : '-';
    if (eventsElement) eventsElement.textContent = eventsReceived;
}

// Обновляем статус при каждом SSE сообщении
function handleSSEEvent(data) {
    lastUpdateTime = new Date();
    eventsReceived++;
    
    updateSSEStatus(isSSEConnected ? 'Работает ✓' : 'Ошибка ✗');
    
    // Ваша существующая логика обработки...
    switch(data.type) {
        case 'stats_update':
            updateStatsFromSSE(data.data || data.stats);
            showLiveUpdateIndicator();
            break;
        // ... остальные case
    }
}

// Подключение к SSE
function connectSSE() {
    if (eventSource) {
        eventSource.close();
        console.log('📡 Закрыто старое SSE соединение');
    }
    
    // Используем Netlify proxy
    const sseUrl = `${"78.40.188.120:8915"}/api/stats`;
    
    console.log('📡 Подключение к SSE:', sseUrl);
    
    try {
        eventSource = new EventSource(sseUrl, {
            withCredentials: false // Важно для CORS
        });
        
        eventSource.onopen = function() {
            console.log('✅ SSE подключен успешно');
            isSSEConnected = true;
            updateConnectionStatus();
            
            // Сбрасываем таймер переподключения
            if (sseReconnectTimeout) {
                clearTimeout(sseReconnectTimeout);
                sseReconnectTimeout = null;
            }
            
            // Показываем уведомление только при первом подключении
            if (!lastUpdateTime) {
                showNotification('Подключено к обновлениям в реальном времени', 'success');
            }
        };
        
        // Обработка сообщения о подключении
        eventSource.addEventListener('connected', function(event) {
            console.log('🔗 SSE: Соединение подтверждено сервером');
        });
        
        // Обработка начальной статистики
        eventSource.addEventListener('initial_stats', function(event) {
            try {
                const data = JSON.parse(event.data);
                if (data.stats) {
                    console.log('📊 SSE: Начальная статистика получена');
                    updateStatsFromSSE(data.stats);
                }
            } catch (e) {
                console.error('❌ Ошибка обработки initial_stats:', e);
            }
        });
        
        // Обработка обновления статистики
        eventSource.addEventListener('stats_update', function(event) {
            console.log('📈 Получено обновление статистики');
            try {
                const data = JSON.parse(event.data);
                if (data.data) {
                    updateStatsFromSSE(data.data);
                } else {
                    updateStatsFromSSE(data);
                }
                showLiveUpdateIndicator();
            } catch (e) {
                console.error('❌ Ошибка обработки stats_update:', e);
            }
        });
        
        // Обработка обновления баланса
        eventSource.addEventListener('balance_updated', function(event) {
            console.log('💰 Обновление баланса');
            try {
                const data = JSON.parse(event.data);
                showLiveNotification(`Баланс обновлен для ${data.total_updated || 0} игроков`, 'success');
                // Обновляем страницу
                loadStats();
            } catch (e) {
                console.error('❌ Ошибка обработки balance_updated:', e);
            }
        });
        
        // Универсальный обработчик сообщений
        eventSource.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                console.log('📨 SSE:', data.type || 'message');
                
                // Обработка разных типов сообщений
                switch(data.type) {
                    case 'connected':
                        console.log('🔗 Подключено к серверу обновлений');
                        break;
                    case 'keepalive':
                        // Просто обновляем время последнего сообщения
                        lastUpdateTime = new Date();
                        break;
                    case 'test_event':
                        console.log('🧪 Тестовое событие:', data.data?.message);
                        break;
                }
            } catch (e) {
                // Игнорируем ошибки парсинга
            }
        };
        
        eventSource.onerror = function(error) {
            console.log('❌ Ошибка SSE соединения, состояние:', eventSource.readyState);
            isSSEConnected = false;
            updateConnectionStatus();
            
            // Закрываем текущее соединение
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
            
            // Переподключение через 3-10 секунд
            if (sseReconnectTimeout) {
                clearTimeout(sseReconnectTimeout);
            }
            
            const reconnectDelay = 3000 + Math.random() * 7000; // 3-10 секунд
            console.log(`🔄 Попытка переподключения через ${Math.round(reconnectDelay/1000)}сек...`);
            
            sseReconnectTimeout = setTimeout(() => {
                console.log('🔄 Переподключение SSE...');
                connectSSE();
            }, reconnectDelay);
        };
        
    } catch (error) {
        console.error('💥 Критическая ошибка создания SSE:', error);
        isSSEConnected = false;
        updateConnectionStatus();
    }
}

// Начать ping для поддержания соединения
function startSSEPing() {
    if (pingInterval) clearInterval(pingInterval);
    
    pingInterval = setInterval(() => {
        fetch(`${window.API_BASE_URL}/api/ping`)
            .then(response => {
                if (!response.ok) {
                    console.log('💔 Ping не прошел, переподключаемся...');
                    connectSSE();
                }
            })
            .catch(() => {
                console.log('💔 Ошибка ping, переподключаемся...');
                connectSSE();
            });
    }, 30000); // Каждые 30 секунд
}
// Остановить ping
function stopSSEPing() {
    if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
    }
}

// Обработка SSE событий
function handleSSEEvent(data) {
    lastUpdateTime = new Date();
    
    switch(data.type) {
        case 'connected':
            console.log('📡 SSE: Подключение установлено');
            break;
            
        case 'ping':
            console.log('❤️ SSE: Ping получен');
            break;
            
        case 'initial_stats':
            console.log('📊 SSE: Начальная статистика получена');
            updateStatsFromSSE(data.stats);
            break;
            
        case 'stats_update':
            console.log('📈 SSE: Обновление статистики');
            updateStatsFromSSE(data.data || data.stats);
            showLiveUpdateIndicator();
            break;
            
        case 'player_attack':
            handlePlayerAttackEvent(data.data);
            break;
            
        case 'player_purchase':
            handlePlayerPurchaseEvent(data.data);
            break;
            
        case 'player_slots':
            handlePlayerSlotsEvent(data.data);
            break;
            
        case 'player_prestige':
            handlePlayerPrestigeEvent(data.data);
            break;
            
        case 'player_nickname_change':
            handlePlayerNicknameChangeEvent(data.data);
            break;
            
        case 'player_collect':
            handlePlayerCollectEvent(data.data);
            break;
            
        case 'player_registered':
            handlePlayerRegisteredEvent(data.data);
            break;
            
        case 'system_broadcast':
            handleSystemBroadcastEvent(data.data);
            break;
            
        case 'test_event':
            console.log('🧪 SSE: Тестовое событие:', data.data);
            break;
            
        default:
            console.log('📨 SSE: Неизвестное событие:', data);
    }
}

// Обновление статистики из SSE
function updateStatsFromSSE(stats) {
    console.log('🔄 Обновление из SSE:', stats);
    
    // Обновляем счетчики на странице
    if (stats.total_players !== undefined) {
        document.getElementById('total-players').textContent = stats.total_players;
        document.getElementById('player-count').textContent = `${stats.total_players} игроков`;
    }
    
    if (stats.total_cats !== undefined) {
        document.getElementById('total-cats').textContent = stats.total_cats.toLocaleString();
    }
    
    if (stats.total_matroskin !== undefined) {
        document.getElementById('total-matroskin').textContent = stats.total_matroskin;
    }
    
    if (stats.total_attacks !== undefined) {
        document.getElementById('total-attacks').textContent = stats.total_attacks;
    }
    
    // Обновляем время последнего обновления
    const now = new Date();
    document.getElementById('last-update-text').textContent = 
        `Обновлено: ${now.toLocaleTimeString()}`;
    
    // Если активна панель статистики, обновляем график
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && activeSection.id === 'dashboard') {
        // Загружаем обновленные данные для графика
        loadStatsForChart();
    }
}

// Обработка события атаки игрока
function handlePlayerAttackEvent(data) {
    console.log('⚔️ Атака игрока:', data.nickname, data.success ? 'успешна' : 'провалена');
    
    // Обновляем топ игроков если активен
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection) {
        if (activeSection.id === 'top-players' || activeSection.id === 'matroskin-top') {
            if (activeSection.id === 'top-players') {
                loadTopPlayers();
            } else {
                loadTopMatroskin();
            }
        }
    }
    
    // Показываем всплывающее уведомление
    if (Math.random() < 0.3) { // 30% шанс показать уведомление
        const message = data.success 
            ? `${data.nickname} успешно атаковал и получил +${data.reward || '?'} кошек${data.got_matroskin ? ' и Матроскина!' : '!'}`
            : `${data.nickname} провалил атаку${data.protection_used ? ' (защитился штанами)' : ''}`;
        
        showLiveNotification(message, data.success ? 'success' : 'error');
    }
}

// Обработка события покупки
function handlePlayerPurchaseEvent(data) {
    console.log('🛒 Покупка игрока:', data.nickname, data.item_name);
    
    // Обновляем статистику магазина если активна
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && activeSection.id === 'shop-stats') {
        loadShopStats();
    }
}

// Обработка события казино
function handlePlayerSlotsEvent(data) {
    console.log('🎰 Казино игрока:', data.nickname, data.win_amount > 0 ? 'выиграл' : 'проиграл');
    
    // Показываем уведомление о крупном выигрыше
    if (data.win_amount > 100) {
        showLiveNotification(`${data.nickname} сорвал куш в казино: +${data.win_amount} кошек! 🎉`, 'success');
    }
}

// Обработка события престижа
function handlePlayerPrestigeEvent(data) {
    console.log('⭐ Престиж игрока:', data.nickname, data.old_level, '→', data.new_level);
    
    // Обновляем уровни престижа если активны
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection && activeSection.id === 'prestige') {
        loadPrestigeLevels();
    }
    
    // Показываем уведомление
    showLiveNotification(`${data.nickname} достиг престижа уровня ${data.new_level}! 🎉`, 'success');
}

// Обработка события смены ника
function handlePlayerNicknameChangeEvent(data) {
    console.log('📝 Смена ника:', data.old_nickname, '→', data.new_nickname);
}

// Обработка события сбора производства
function handlePlayerCollectEvent(data) {
    console.log('🏭 Сбор производства:', data.nickname, data.collected);
}

// Обработка события регистрации
function handlePlayerRegisteredEvent(data) {
    console.log('👤 Новая регистрация:', data.nickname);
    
    // Обновляем статистику
    updateStatsFromSSE({
        total_players: data.total_players
    });
    
    // Показываем приветствие
    showLiveNotification(`Новый игрок: ${data.nickname}! Добро пожаловать! 👋`, 'success');
}

// Обработка системного сообщения
function handleSystemBroadcastEvent(data) {
    console.log('📢 Системное сообщение:', data.message);
    
    // Показываем системное уведомление
    showLiveNotification(`📢 ${data.message}`, 'info');
}

// Показать индикатор живого обновления
function showLiveUpdateIndicator() {
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.classList.add('pulse');
        setTimeout(() => {
            statusElement.classList.remove('pulse');
        }, 1000);
    }
}

// Показать живое уведомление
function showLiveNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `live-notification ${type}`;
    notification.innerHTML = `
        <div class="live-notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <div class="live-notification-progress"></div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
    
    // Анимация прогресса
    setTimeout(() => {
        const progress = notification.querySelector('.live-notification-progress');
        if (progress) {
            progress.style.width = '0%';
        }
    }, 10);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-triangle';
        case 'info': return 'info-circle';
        default: return 'bell';
    }
}

// Обновить статус подключения
function updateConnectionStatus() {
    let statusElement = document.getElementById('connection-status');
    
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'connection-status';
        statusElement.className = 'connection-status';
        document.body.appendChild(statusElement);
    }
    
    if (isSSEConnected) {
        statusElement.innerHTML = '<i class="fas fa-wifi"></i> Онлайн';
        statusElement.className = 'connection-status online';
    } else {
        statusElement.innerHTML = '<i class="fas fa-wifi-slash"></i> Оффлайн';
        statusElement.className = 'connection-status offline';
    }
}

// Отправить тестовое событие
function sendTestEvent() {
    fetch(`${window.API_BASE_URL}/api/test/simple_save`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        console.log('Тестовое событие отправлено:', data);
        showNotification('Тестовое событие отправлено', 'success');
    })
    .catch(error => {
        console.error('Ошибка отправки тестового события:', error);
        showNotification('Ошибка отправки теста', 'error');
    });
}

// ========== ИНИЦИАЛИЗАЦИЯ НАВИГАЦИИ ==========

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
    
    // Обработчик для кнопки обновления - ИСПРАВЛЕННЫЙ ВАРИАНТ
    document.querySelectorAll('.btn-refresh').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const sectionId = this.closest('.content-section')?.id;
            console.log('Клик по кнопке обновления в секции:', sectionId);
            
            if (!sectionId) return;
            
            // Добавляем анимацию
            this.classList.add('loading');
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.add('fa-spin');
            }
            
            // Вызываем соответствующую функцию
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
                default:
                    console.log('Неизвестная секция:', sectionId);
            }
            
            // Убираем анимацию через 2 секунды
            setTimeout(() => {
                this.classList.remove('loading');
                if (icon) {
                    icon.classList.remove('fa-spin');
                }
            }, 2000);
        });
    });
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

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
            fetch("http://78.40.188.120:8915" + '/api/stats'),
            fetch("http://78.40.188.120:8927" + '/api/top/players')
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

// Загрузка статистики только для графика
async function loadStatsForChart() {
    try {
        const playersResponse = await fetch(window.API_BASE_URL + '/api/top/players');
        
        if (!playersResponse.ok) {
            throw new Error('Ошибка сети');
        }
        
        const players = await playersResponse.json();
        
        // Создаем распределение по престижу
        const prestigeData = {};
        players.forEach(player => {
            const level = player.prestige_level || player.prestige || 0;
            prestigeData[level] = (prestigeData[level] || 0) + 1;
        });
        
        // Обновляем график
        updatePrestigeChart(prestigeData);
        
    } catch (error) {
        console.error('Ошибка загрузки данных для графика:', error);
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
        const response = await fetch(`${window.API_BASE_URL}/api/search/player?q=${encodeURIComponent(nickname)}`);
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
        <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'info' ? 'info-circle' : 'check-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// ========== ЭКСПОРТ ФУНКЦИЙ ==========

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
window.connectSSE = connectSSE;
window.sendTestEvent = sendTestEvent;
window.testSSE = testSSE;
window.sendTestUpdate = sendTestUpdate;
window.reconnectSSE = reconnectSSE;