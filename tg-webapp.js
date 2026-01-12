// tg-webapp.js - Telegram Web App интеграция
const tg = window.Telegram?.WebApp;

// tg-miniapp.js - Оптимизированный для Telegram Mini App
class TelegramMiniApp {
    constructor() {
        this.tg = window.Telegram?.WebApp;
        this.user = null;
        this.initData = null;
        this.API_BASE = window.location.origin.includes('netlify') 
            ? 'https://gleeful-starship-f36033.netlify.app'
            : 'http://78.40.188.120:8927';
    }

    async init() {
        if (!this.tg) {
            console.warn('Telegram WebApp не обнаружен, работает в обычном режиме');
            return this.initStandalone();
        }

        try {
            // Инициализация Telegram WebApp
            this.tg.expand();
            this.tg.enableClosingConfirmation();
            
            // Получаем данные
            this.initData = this.tg.initData;
            this.user = this.tg.initDataUnsafe?.user;
            
            console.log('Telegram User:', this.user);
            
            // Устанавливаем тему
            this.setTheme();
            
            // Подписываемся на события
            this.bindEvents();
            
            // Проверяем/создаем пользователя
            await this.checkOrCreateUser();
            
            return true;
        } catch (error) {
            console.error('Ошибка инициализации Telegram:', error);
            return this.initStandalone();
        }
    }

    async checkOrCreateUser() {
        if (!this.user) return;
        
        const userId = `tg_${this.user.id}`;
        const nickname = this.user.username || this.user.first_name;
        
        try {
            // Проверяем, есть ли пользователь
            const response = await fetch(`${this.API_BASE}/api/player/${userId}`);
            
            if (response.ok) {
                // Пользователь существует
                const userData = await response.json();
                this.saveUserData(userId, userData);
            } else {
                // Создаем нового пользователя
                await this.createTelegramUser(userId, nickname);
            }
        } catch (error) {
            console.log('Создаем нового пользователя...');
            await this.createTelegramUser(userId, nickname);
        }
    }

    async createTelegramUser(userId, nickname) {
        const response = await fetch(`${this.API_BASE}/api/game/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                telegram_id: this.user.id,
                nickname: nickname,
                first_name: this.user.first_name,
                last_name: this.user.last_name,
                is_bot: this.user.is_bot || false
            })
        });

        if (response.ok) {
            const data = await response.json();
            this.saveUserData(userId, data);
            console.log('Новый пользователь создан:', data);
        }
    }

    saveUserData(userId, userData) {
        localStorage.setItem('kora_user_id', userId);
        localStorage.setItem('kora_user_data', JSON.stringify(userData));
        
        // Отправляем событие
        window.dispatchEvent(new CustomEvent('telegram-user-ready', {
            detail: { userId, userData }
        }));
    }

    setTheme() {
        if (!this.tg) return;
        
        const theme = this.tg.colorScheme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Применяем цвета Telegram
        if (this.tg.themeParams) {
            const style = document.documentElement.style;
            style.setProperty('--tg-bg-color', this.tg.themeParams.bg_color || '#18222d');
            style.setProperty('--tg-text-color', this.tg.themeParams.text_color || '#ffffff');
            style.setProperty('--tg-button-color', this.tg.themeParams.button_color || '#2ea6ff');
            style.setProperty('--tg-button-text-color', this.tg.themeParams.button_text_color || '#ffffff');
        }
    }

    bindEvents() {
        if (!this.tg) return;
        
        // Изменение темы
        this.tg.onEvent('themeChanged', () => this.setTheme());
        
        // Кнопка назад
        this.tg.BackButton.onClick(() => {
            window.history.back();
        });
        
        // Показываем кнопку назад когда нужно
        this.tg.BackButton.show();
    }

    initStandalone() {
        console.log('Стандартная инициализация');
        // Проверяем сохраненный ID
        const savedId = localStorage.getItem('kora_user_id');
        if (savedId) {
            window.dispatchEvent(new CustomEvent('telegram-user-ready', {
                detail: { 
                    userId: savedId,
                    userData: JSON.parse(localStorage.getItem('kora_user_data') || '{}')
                }
            }));
        }
        return true;
    }

    // Вспомогательные методы
    showAlert(message) {
        if (this.tg?.showAlert) {
            this.tg.showAlert(message);
        } else {
            alert(message);
        }
    }

    closeApp() {
        if (this.tg?.close) {
            this.tg.close();
        }
    }

    getUserId() {
        return localStorage.getItem('kora_user_id');
    }
}

// Создаем глобальный экземпляр
window.TelegramMiniApp = new TelegramMiniApp();

// Автоматическая инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.TelegramMiniApp.init();
});

// Функции для Telegram
function initTelegramApp() {
    if (!tg) {
        console.log('Работаем в обычном режиме');
        return;
    }
    
    console.log('Telegram Web App запущен');
    
    // Раскрываем на весь экран
    tg.expand();
    
    // Получаем данные пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('Telegram пользователь:', user);
        
        // Автоматически находим ID по нику
        const nickname = user.username || user.first_name;
        if (nickname) {
            findUserByTelegramNickname(nickname, user.id);
        }
    }
    
    // Показываем Telegram кнопку
    document.getElementById('tg-login')?.style.display = 'block';
    
    return true;
}

// Поиск пользователя по Telegram нику
async function findUserByTelegramNickname(nickname, telegramId) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/search/player?q=${encodeURIComponent(nickname)}`);
        if (response.ok) {
            const players = await response.json();
            if (players.length > 0) {
                const player = players[0];
                // Сохраняем ID для входа
                localStorage.setItem('kora_user_id', player.id || player.user_id);
                showNotification(`Найден ваш аккаунт: ${player.nickname}`, 'success');
            }
        }
    } catch (error) {
        console.log('Пользователь не найден, можно создать новый');
    }
}

// Логин через Telegram
function loginWithTelegram() {
    if (!tg) {
        showNotification('Откройте в Telegram для входа', 'error');
        return;
    }
    
    const user = tg.initDataUnsafe?.user;
    if (!user) {
        showNotification('Ошибка получения данных Telegram', 'error');
        return;
    }
    
    // Создаем уникальный ID для Telegram пользователя
    const telegramId = `tg_${user.id}`;
    
    // Проверяем, есть ли такой пользователь
    fetch(`${window.API_BASE_URL}/api/player/${telegramId}`)
        .then(response => {
            if (response.ok) {
                // Пользователь существует
                return response.json();
            } else {
                // Создаем нового пользователя
                return createTelegramUser(user, telegramId);
            }
        })
        .then(playerData => {
            // Сохраняем ID
            localStorage.setItem('kora_user_id', telegramId);
            showNotification(`Добро пожаловать, ${user.first_name}!`, 'success');
            
            // Обновляем интерфейс
            if (typeof loadStats === 'function') {
                loadStats();
            }
        })
        .catch(error => {
            console.error('Ошибка входа:', error);
            showNotification('Ошибка входа через Telegram', 'error');
        });
}

// Создание нового пользователя Telegram
async function createTelegramUser(user, telegramId) {
    try {
        const response = await fetch(`${window.API_BASE_URL}/api/game/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: telegramId,
                telegram_id: user.id,
                nickname: user.username || user.first_name,
                first_name: user.first_name,
                last_name: user.last_name,
                is_bot: user.is_bot || false
            })
        });
        
        if (!response.ok) throw new Error('Ошибка регистрации');
        return await response.json();
    } catch (error) {
        console.error('Ошибка создания пользователя:', error);
        throw error;
    }
}

// Экспорт функций
window.initTelegramApp = initTelegramApp;
window.loginWithTelegram = loginWithTelegram;

// Автоматическая инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initTelegramApp();
});