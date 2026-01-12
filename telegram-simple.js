// telegram-simple.js
function initTelegram() {
    if (!window.Telegram?.WebApp) {
        console.log('Не Telegram, работаем как сайт');
        return;
    }
    
    const tg = window.Telegram.WebApp;
    
    // Простая инициализация
    tg.expand();
    tg.ready();
    
    // Получаем пользователя
    const user = tg.initDataUnsafe?.user;
    
    if (user) {
        // Просто сохраняем ID
        const userId = `tg_${user.id}`;
        localStorage.setItem('kora_user_id', userId);
        localStorage.setItem('kora_username', user.username || user.first_name);
        
        console.log('Telegram user:', user);
        
        // Автоматически входим в игру
        setTimeout(() => {
            if (window.location.pathname.includes('game')) {
                startGameWithTelegram(userId);
            }
        }, 1000);
    }
}

function startGameWithTelegram(userId) {
    // Просто редирект или сообщение
    alert(`Добро пожаловать! Ваш ID: ${userId}`);
}

// Запуск при загрузке
document.addEventListener('DOMContentLoaded', initTelegram);