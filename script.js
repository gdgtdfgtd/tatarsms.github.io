class DragonMessenger {
    constructor() {
        this.users = JSON.parse(localStorage.getItem('dm_users')) || {};
        this.messages = JSON.parse(localStorage.getItem('dm_messages')) || {};
        this.friends = JSON.parse(localStorage.getItem('dm_friends')) || {};
        this.groups = JSON.parse(localStorage.getItem('dm_groups')) || {};
        this.currentUser = localStorage.getItem('dm_current_user') || '';
        this.currentChat = null;
        this.currentServer = 'friends';
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
        this.setupDragonAnimation();
    }

    setupDragonAnimation() {
        // Анимация дракона при hover
        const dragon = document.getElementById('animated-dragon');
        if (dragon) {
            dragon.addEventListener('mouseenter', () => {
                dragon.style.animation = 'dragonBreath 1s infinite';
            });
            dragon.addEventListener('mouseleave', () => {
                dragon.style.animation = 'dragonBreath 3s infinite';
            });
        }
    }

    bindEvents() {
        // Табы авторизации
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchAuthTab(tabName);
            });
        });

        // Формы
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.register();
        });

        // Навигация серверов
        document.querySelectorAll('.server-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const server = e.currentTarget.dataset.server;
                this.switchServer(server);
            });
        });

        // Отправка сообщений
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Эмодзи
        document.getElementById('emoji-btn').addEventListener('click', () => {
            this.toggleEmojiPanel();
        });

        // Загрузка изображений
        document.getElementById('image-btn').addEventListener('click', () => {
            document.getElementById('image-input').click();
        });

        document.getElementById('image-input').addEventListener('change', (e) => {
            this.handleImageUpload(e);
        });

        // Настройки
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showSettings();
        });

        // Добавление друга
        document.getElementById('add-friend-btn').addEventListener('click', () => {
            this.showAddFriendModal();
        });
    }

    switchAuthTab(tabName) {
        document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-form`).classList.add('active');
    }

    register() {
        const username = document.getElementById('reg-username').value.trim();
        const nickname = document.getElementById('reg-nickname').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm = document.getElementById('reg-confirm').value;

        if (password !== confirm) {
            alert('Пароли не совпадают!');
            return;
        }

        if (this.users[username]) {
            alert('Это имя пользователя уже занято!');
            return;
        }

        // Создание пользователя с ID
        const userId = this.generateId();
        this.users[username] = {
            id: userId,
            password: btoa(password), // Простое кодирование (в реальном приложении нужно хэшировать)
            nickname: nickname,
            status: 'online',
            avatar: this.generateAvatar(),
            friends: [],
            groups: [],
            joined: new Date().toISOString()
        };

        this.saveUsers();
        alert('Аккаунт создан! Теперь войдите.');
        this.switchAuthTab('login');
    }

    login() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        const user = this.users[username];
        if (!user || atob(user.password) !== password) {
            alert('Неверное имя пользователя или пароль!');
            return;
        }

        this.currentUser = username;
        localStorage.setItem('dm_current_user', username);
        this.showMainScreen();
    }

    checkAuth() {
        if (this.currentUser) {
            this.showMainScreen();
        }
    }

    showMainScreen() {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        
        // Обновление информации пользователя
        const user = this.users[this.currentUser];
        document.getElementById('current-user-nickname').textContent = user.nickname;
        
        this.loadFriends();
        this.loadGroups();
    }

    switchServer(server) {
        this.currentServer = server;
        
        // Обновление UI
        document.querySelectorAll('.server-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-server="${server}"]`).classList.add('active');
        
        document.getElementById('current-server').textContent = 
            server === 'friends' ? 'Друзья' : 
            server === 'groups' ? 'Группы' : 'Поиск';

        // Показать соответствующую панель
        document.querySelectorAll('.channels-list').forEach(list => {
            list.classList.add('hidden');
        });
        document.getElementById(`${server}-list`).classList.remove('hidden');
    }

    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    generateAvatar() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    loadFriends() {
        const user = this.users[this.currentUser];
        const friendsList = document.getElementById('friends-list');
        friendsList.innerHTML = '';

        user.friends.forEach(friendUsername => {
            const friend = this.users[friendUsername];
            if (friend) {
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-item';
                friendElement.innerHTML = `
                    <div class="friend-avatar" style="background: ${friend.avatar}"></div>
                    <div class="friend-info">
                        <span class="friend-name">${friend.nickname}</span>
                        <span class="friend-status">${friend.status}</span>
                    </div>
                `;
                friendElement.addEventListener('click', () => {
                    this.openChat(friendUsername, 'private');
                });
                friendsList.appendChild(friendElement);
            }
        });
    }

    loadGroups() {
        // Загрузка групп пользователя
    }

    sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text || !this.currentChat) return;

        const message = {
            id: this.generateId(),
            type: this.currentChat.type,
            from: this.currentUser,
            to: this.currentChat.target,
            content: text,
            timestamp: new Date().toISOString(),
            read: false
        };

        // Сохранение сообщения
        if (!this.messages[this.currentChat.target]) {
            this.messages[this.currentChat.target] = [];
        }
        this.messages[this.currentChat.target].push(message);
        this.saveMessages();

        // Отображение сообщения
        this.displayMessage(message);
        input.value = '';
    }

    displayMessage(message) {
        const container = document.getElementById('messages-container');
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const user = this.users[message.from];
        messageElement.innerHTML = `
            <div class="message-avatar" style="background: ${user.avatar}"></div>
            <div class="message-content">
                <span class="message-author">${user.nickname}</span>
                <span class="message-text">${this.parseEmojis(message.content)}</span>
                <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
        `;
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    parseEmojis(text) {
        const emojiMap = {
            ':)': '😊',
            ':(': '😢',
            ':D': '😃',
            ';)': '😉',
            ':P': '😛',
            '<3': '❤️'
        };
        
        return text.replace(/:\)|:\(|:D|;\)|:P|<3/g, match => emojiMap[match] || match);
    }

    toggleEmojiPanel() {
        const panel = document.getElementById('emoji-panel');
        panel.classList.toggle('hidden');
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.sendImageMessage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    sendImageMessage(imageData) {
        if (!this.currentChat) return;

        const message = {
            id: this.generateId(),
            type: 'image',
            from: this.currentUser,
            to: this.currentChat.target,
            content: imageData,
            timestamp: new Date().toISOString(),
            read: false
        };

        if (!this.messages[this.currentChat.target]) {
            this.messages[this.currentChat.target] = [];
        }
        this.messages[this.currentChat.target].push(message);
        this.saveMessages();
        this.displayImageMessage(message);
    }

    displayImageMessage(message) {
        const container = document.getElementById('messages-container');
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        
        const user = this.users[message.from];
        messageElement.innerHTML = `
            <div class="message-avatar" style="background: ${user.avatar}"></div>
            <div class="message-content">
                <span class="message-author">${user.nickname}</span>
                <img src="${message.content}" class="message-image" style="max-width: 300px; border-radius: 8px;">
                <span class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</span>
            </div>
        `;
        
        container.appendChild(messageElement);
        container.scrollTop = container.scrollHeight;
    }

    showSettings() {
        const modal = document.getElementById('settings-modal');
        const user = this.users[this.currentUser];
        
        document.getElementById('change-nickname').value = user.nickname;
        document.getElementById('change-status').value = user.status;
        
        modal.classList.remove('hidden');
    }

    showAddFriendModal() {
        document.getElementById('add-friend-modal').classList.remove('hidden');
    }

    // Сохранение данных
    saveUsers() {
        localStorage.setItem('dm_users', JSON.stringify(this.users));
    }

    saveMessages() {
        localStorage.setItem('dm_messages', JSON.stringify(this.messages));
    }

    saveFriends() {
        localStorage.setItem('dm_friends', JSON.stringify(this.friends));
    }

    saveGroups() {
        localStorage.setItem('dm_groups', JSON.stringify(this.groups));
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.messenger = new DragonMessenger();
});

// Глобальные функции для модальных окон
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

window.sendFriendRequest = function() {
    const username = document.getElementById('friend-username').value;
    // Логика отправки заявки в друзья
    alert(`Заявка отправлена пользователю ${username}`);
    window.closeModal('add-friend-modal');
};
