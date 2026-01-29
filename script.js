// 🗄️ База данных в localStorage
const DB_KEYS = {
    USERS: 'tatar_sms_users',
    MESSAGES: 'tatar_sms_messages',
    CURRENT_USER: 'tatar_sms_current_user'
};

// 🚫 Запрещенные слова для авто-модерации
const BAD_WORDS = ['спам', 'реклама', 'оскорбление', 'мат', 'хулиган'];

class TatarSMS {
    constructor() {
        this.init();
        this.bindEvents();
        this.loadMessages();
    }

    init() {
        // Инициализация базы данных
        if (!localStorage.getItem(DB_KEYS.USERS)) {
            const defaultUsers = {
                'admin': { password: 'admin', isAdmin: true },
                'user': { password: '123', isAdmin: false }
            };
            localStorage.setItem(DB_KEYS.USERS, JSON.stringify(defaultUsers));
        }
        if (!localStorage.getItem(DB_KEYS.MESSAGES)) {
            localStorage.setItem(DB_KEYS.MESSAGES, JSON.stringify([]));
        }

        // Проверка авторизации
        const currentUser = localStorage.getItem(DB_KEYS.CURRENT_USER);
        if (currentUser) {
            this.showChatScreen(currentUser);
        }
    }

    bindEvents() {
        // Навигация между формами
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthForms();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleAuthForms();
        });

        // Формы авторизации
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Чат
        document.getElementById('send-btn').addEventListener('click', () => this.sendMessage());
        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Выход
        document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    }

    toggleAuthForms() {
        const loginForm = document.getElementById('login-form');
        const registerForm = document.getElementById('register-form');
        
        loginForm.classList.toggle('hidden');
        registerForm.classList.toggle('hidden');
    }

    register() {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (password !== confirm) {
            alert('Пароли не совпадают!');
            return;
        }

        const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS));
        
        if (users[username]) {
            alert('Это имя уже используется!');
            return;
        }

        // Регистрация нового пользователя
        users[username] = { password, isAdmin: username === 'admin' };
        localStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));

        alert('Регистрация успешна!');
        this.toggleAuthForms();
        
        // Очистка полей
        document.getElementById('reg-username').value = '';
        document.getElementById('reg-password').value = '';
        document.getElementById('reg-confirm').value = '';
    }

    login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const users = JSON.parse(localStorage.getItem(DB_KEYS.USERS));
        
        if (!users[username] || users[username].password !== password) {
            alert('Неверный логин или пароль!');
            return;
        }

        this.showChatScreen(username);
    }

    showChatScreen(username) {
        localStorage.setItem(DB_KEYS.CURRENT_USER, username);
        
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('chat-screen').classList.add('active');
        
        document.getElementById('current-user').textContent = username;
        
        // Показать панель модерации для админа
        if (username === 'admin') {
            document.getElementById('mod-panel').style.display = 'block';
            this.loadModPanel();
        }
        
        this.loadMessages();
    }

    sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        const username = localStorage.getItem(DB_KEYS.CURRENT_USER);

        if (!text) return;

        // Проверка на запрещенные слова
        const containsBadWord = BAD_WORDS.some(word => 
            text.toLowerCase().includes(word.toLowerCase())
        );

        const message = {
            id: Date.now(),
            username: username,
            text: text,
            timestamp: new Date().toLocaleString('ru-RU'),
            isDeleted: false,
            needsModeration: containsBadWord
        };

        const messages = JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES));
        messages.push(message);
        localStorage.setItem(DB_KEYS.MESSAGES, JSON.stringify(messages));

        input.value = '';
        this.loadMessages();
        
        if (username === 'admin') {
            this.loadModPanel();
        }
    }

    loadMessages() {
        const messagesContainer = document.getElementById('messages-container');
        const currentUser = localStorage.getItem(DB_KEYS.CURRENT_USER);
        const messages = JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES));
        
        messagesContainer.innerHTML = '';

        // Приветственное сообщение если нет сообщений
        if (messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="message other">
                    <div class="message-header">Система • ${new Date().toLocaleString('ru-RU')}</div>
                    <div class="message-text">Добро пожаловать в Tatar SMS! Начните общение.</div>
                </div>
            `;
            return;
        }

        messages.filter(msg => !msg.isDeleted).forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.username === currentUser ? 'own' : 'other'}`;
            
            messageDiv.innerHTML = `
                <div class="message-header">
                    ${msg.username} • ${msg.timestamp}
                    ${msg.needsModeration ? ' <i class="fas fa-exclamation-triangle" style="color: orange;" title="Требует модерации"></i>' : ''}
                </div>
                <div class="message-text">${this.escapeHtml(msg.text)}</div>
            `;

            messagesContainer.appendChild(messageDiv);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    loadModPanel() {
        const modContainer = document.getElementById('mod-messages');
        const messages = JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES));
        
        modContainer.innerHTML = '';

        const problematicMessages = messages.filter(msg => 
            (msg.needsModeration || msg.isDeleted) && !msg.isDeleted
        );

        if (problematicMessages.length === 0) {
            modContainer.innerHTML = '<p>Нет сообщений для модерации</p>';
            return;
        }

        problematicMessages.forEach(msg => {
            const modMsg = document.createElement('div');
            modMsg.className = 'mod-message';
            
            modMsg.innerHTML = `
                <div>
                    <strong>${msg.username}</strong>: ${this.escapeHtml(msg.text)}
                    <br><small>${msg.timestamp}</small>
                    ${msg.needsModeration ? '<span style="color: orange;">• Требует модерации</span>' : ''}
                </div>
                <button class="delete-btn" onclick="tatarSMS.deleteMessage(${msg.id})">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            `;

            modContainer.appendChild(modMsg);
        });
    }

    deleteMessage(messageId) {
        const messages = JSON.parse(localStorage.getItem(DB_KEYS.MESSAGES));
        const messageIndex = messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex !== -1) {
            messages[messageIndex].isDeleted = true;
            localStorage.setItem(DB_KEYS.MESSAGES, JSON.stringify(messages));
            
            this.loadMessages();
            this.loadModPanel();
            alert('Сообщение удалено!');
        }
    }

    logout() {
        localStorage.removeItem(DB_KEYS.CURRENT_USER);
        location.reload();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 🚀 Запуск приложения
const tatarSMS = new TatarSMS();

// Глобальные функции для HTML
window.tatarSMS = tatarSMS;
