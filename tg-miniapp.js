// tg-miniapp.js - Оптимизированный для Telegram Mini App
console.log('📱 Telegram Mini App скрипт загружен');

// Проверяем, в Telegram ли мы
const isTelegram = window.Telegram?.WebApp !== undefined;

if (isTelegram) {
    console.log('🔵 Работаем в Telegram WebApp');
    const tg = window.Telegram.WebApp;
    
    // Инициализация Telegram
    tg.expand();
    tg.ready();
    
    // Получаем пользователя
    const user = tg.initDataUnsafe?.user;
    if (user) {
        console.log('👤 Telegram пользователь:', user);
        
        // Создаем уникальный ID
        const userId = `tg_${user.id}`;
        const nickname = user.username || user.first_name;
        
        // Сохраняем в localStorage
        localStorage.setItem('kora_user_id', userId);
        localStorage.setItem('kora_username', nickname);
        
        // Показываем приветствие
        setTimeout(() => {
            if (typeof showNotification === 'function') {
                showNotification(`Привет, ${nickname}!`, 'success');
            }
        }, 1000);
    }
} else {
    console.log('🌐 Работаем в обычном браузере');
}

// Экспорт функции для входа через Telegram
window.loginWithTelegram = function() {
    if (!isTelegram) {
        showNotification('Эта функция доступна только в Telegram', 'error');
        return;
    }
    
    const tg = window.Telegram.WebApp;
    const user = tg.initDataUnsafe?.user;
    
    if (user) {
        const userId = `tg_${user.id}`;
        const nickname = user.username || user.first_name;
        
        localStorage.setItem('kora_user_id', userId);
        localStorage.setItem('kora_username', nickname);
        
        showNotification(`Вход выполнен как ${nickname}`, 'success');
        
        // Обновляем страницу
        setTimeout(() => {
            location.reload();
        }, 1000);
    }
};