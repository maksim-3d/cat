// tg-webapp.js - Telegram Web App интеграция
const tg = window.Telegram?.WebApp;

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