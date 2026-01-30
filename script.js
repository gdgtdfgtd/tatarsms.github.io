// --- КОНФИГУРАЦИЯ И БД ---
const ADMIN_ID = "tatar_506";
const ADMIN_PASS = "spinogrz666";

let state = {
    user: null,
    peer: null,
    activeChat: null,
    friends: [],
    history: {},
    isRegMode: false,
    db: JSON.parse(localStorage.getItem('tatarsms_db')) || { users: {}, twinks: [] }
};

// --- ИНИЦИАЛИЗАЦИЯ ---
window.onload = () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
        const session = localStorage.getItem('tatarsms_session');
        if (session) {
            state.user = JSON.parse(session);
            app.init();
        } else {
            document.getElementById('auth-screen').classList.remove('hidden');
        }
    }, 1500);
};

// --- СИСТЕМА АУТЕНТИФИКАЦИИ ---
const auth = {
    toggleMode() {
        state.isRegMode = !state.isRegMode;
        document.getElementById('auth-desc').innerText = state.isRegMode ? "Создать новый аккаунт" : "Войти в свою учетную запись";
        document.getElementById('btn-submit').innerText = state.isRegMode ? "Зарегистрироваться" : "Войти";
        document.getElementById('reg-extra').classList.toggle('hidden', !state.isRegMode);
    },

    submit() {
        const id = document.getElementById('auth-login').value.trim();
        const pass = document.getElementById('auth-pass').value.trim();
        const avatar = document.getElementById('reg-preview').src;

        if (!id || !pass) return alert("Заполните все поля");

        if (state.isRegMode) {
            if (state.db.users[id]) return alert("Этот ID уже занят");
            state.db.users[id] = { pass: btoa(pass), avatar, verified: (id === ADMIN_ID) };
            this.saveDB();
            alert("Регистрация успешна! Теперь войдите.");
            this.toggleMode();
        } else {
            const user = state.db.users[id];
            if (user && atob(user.pass) === pass) {
                state.user = { id, ...user };
                localStorage.setItem('tatarsms_session', JSON.stringify(state.user));
                app.init();
            } else if (id === ADMIN_ID && pass === ADMIN_PASS) {
                // Если админ еще не в базе
                state.user = { id, avatar: '', verified: true, isAdmin: true };
                localStorage.setItem('tatarsms_session', JSON.stringify(state.user));
                app.init();
            } else {
                alert("Неверный логин или пароль");
            }
        }
    },

    logout() {
        localStorage.removeItem('tatarsms_session');
        location.reload();
    },

    saveDB() {
        localStorage.setItem('tatarsms_db', JSON.stringify(state.db));
    }
};

// --- ГЛАВНОЕ ПРИЛОЖЕНИЕ ---
const app = {
    init() {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        // Подгружаем историю и друзей
        state.friends = JSON.parse(localStorage.getItem(`friends_${state.user.id}`)) || [];
        state.history = JSON.parse(localStorage.getItem(`history_${state.user.id}`)) || {};

        this.initPeer();
        ui.renderFriends();
        if(state.user.id === ADMIN_ID) document.getElementById('admin-section').classList.remove('hidden');
    },

    initPeer() {
        state.peer = new Peer(state.user.id);

        state.peer.on('open', (id) => {
            console.log('Peer connected as:', id);
            document.getElementById('chat-status').innerText = "Онлайн (P2P)";
        });

        state.peer.on('connection', (conn) => {
            conn.on('data', (data) => {
                messenger.handleIncoming(data, conn.peer);
            });
        });

        state.peer.on('call', (call) => {
            if (confirm(`Входящий звонок от ${call.peer}. Ответить?`)) {
                navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(stream => {
                    call.answer(stream);
                    // Логика видео-окна (упрощено)
                });
            }
        });
    }
};

// --- МЕССЕНДЖЕР ---
const messenger = {
    addContact() {
        const id = document.getElementById('new-peer-id').value.trim();
        if (!id || id === state.user.id) return;
        
        if (!state.friends.find(f => f.id === id)) {
            state.friends.push({ id, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}` });
            this.saveFriends();
            ui.renderFriends();
        }
        ui.closeModals();
    },

    send() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text || !state.activeChat) return;

        const data = { type: 'text', content: text, from: state.user.id };
        this.dispatch(data);
        input.value = '';
    },

    dispatch(data) {
        const conn = state.peer.connect(state.activeChat);
        conn.on('open', () => {
            conn.send(data);
            this.saveMsg(state.activeChat, data, 'sent');
            ui.renderMessages();
        });
    },

    handleIncoming(data, from) {
        if (!state.friends.find(f => f.id === from)) {
            state.friends.push({ id: from, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${from}` });
            this.saveFriends();
            ui.renderFriends();
        }
        this.saveMsg(from, data, 'received');
        if (state.activeChat === from) ui.renderMessages();
    },

    saveMsg(chatId, data, type) {
        if (!state.history[chatId]) state.history[chatId] = [];
        state.history[chatId].push({ ...data, type, time: new Date().toLocaleTimeString() });
        localStorage.setItem(`history_${state.user.id}`, JSON.stringify(state.history));
    },

    saveFriends() {
        localStorage.setItem(`friends_${state.user.id}`, JSON.stringify(state.friends));
    }
};

// --- ИНТЕРФЕЙС (UI) ---
const ui = {
    renderFriends() {
        const list = document.getElementById('peer-list');
        list.innerHTML = '';
        state.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `peer-item ${state.activeChat === f.id ? 'active' : ''}`;
            div.onclick = () => this.selectChat(f.id);
            div.innerHTML = `
                <img src="${f.avatar}">
                <div class="peer-info">
                    <strong>${f.id}</strong>
                </div>
            `;
            list.appendChild(div);
        });
    },

    selectChat(id) {
        state.activeChat = id;
        const friend = state.friends.find(f => f.id === id);
        document.getElementById('no-chat-selected').classList.add('hidden');
        document.getElementById('chat-active').classList.remove('hidden');
        document.getElementById('chat-name').innerText = id;
        document.getElementById('chat-avatar').src = friend.avatar;
        this.renderMessages();
        this.renderFriends();

        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.remove('open');
        }
    },

    renderMessages() {
        const box = document.getElementById('message-list');
        box.innerHTML = '';
        const msgs = state.history[state.activeChat] || [];
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = `msg ${m.type}`;
            div.innerHTML = `
                <div class="msg-bubble">${m.content}</div>
                <small style="font-size:10px; opacity:0.5; margin-top:4px;">${m.time}</small>
            `;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    },

    toggleSidebar() {
        document.getElementById('sidebar').classList.toggle('open');
    },

    openModal(id) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(`modal-${id}`).classList.remove('hidden');
    },

    closeModals() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
};

// --- АДМИН ПАНЕЛЬ ---
const admin = {
    createTwink() {
        const l = document.getElementById('twink-login').value.trim();
        const p = document.getElementById('twink-pass').value.trim();
        if (!l || !p) return;
        
        state.db.users[l] = { pass: btoa(p), avatar: '', verified: false };
        auth.saveDB();
        alert(`Твинк ${l} успешно добавлен в базу данных!`);
        ui.closeModals();
    },
    clearStorage() {
        if(confirm("ВНИМАНИЕ! Это удалит всех пользователей и историю. Продолжить?")) {
            localStorage.clear();
            location.reload();
        }
    }
};

// --- ОБРАБОТКА ФАЙЛОВ ---
document.getElementById('reg-file').onchange = function(e) {
    const reader = new FileReader();
    reader.onload = function(ev) { document.getElementById('reg-preview').src = ev.target.result; };
    reader.readAsDataURL(e.target.files[0]);
};
