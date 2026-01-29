// --- CONFIG & STATE ---
const ADMIN_ID = "tatar_506";
const ADMIN_PASS = "spinogrz666";

let state = {
    me: { id: '', role: 'user', avatar: '', verified: false },
    activeTab: 'dm', // 'dm' или 'groups'
    chats: JSON.parse(localStorage.getItem('tatarsms_chats') || '[]'),
    groups: JSON.parse(localStorage.getItem('tatarsms_groups') || '[]'),
    history: JSON.parse(localStorage.getItem('tatarsms_history') || '{}'),
    stickers: JSON.parse(localStorage.getItem('tatarsms_stickers') || []),
    peer: null,
    currentCall: null,
    localStream: null,
    activeChatId: null
};

// --- AUTHENTICATION ---
const auth = {
    setRole(role) {
        state.me.role = role;
        document.getElementById('tab-user').classList.toggle('active', role === 'user');
        document.getElementById('tab-admin').classList.toggle('active', role === 'admin');
        document.getElementById('admin-pass-group').classList.toggle('hidden', role === 'user');
    },

    handleLogin() {
        const id = document.getElementById('login-id').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        if (!id) return alert("Введите никнейм!");

        if (state.me.role === 'admin') {
            if (id !== ADMIN_ID || pass !== ADMIN_PASS) return alert("Неверные данные админа!");
            state.me.verified = true;
        }

        state.me.id = id;
        state.me.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;
        
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        
        this.initPeer();
        ui.initApp();
    },

    initPeer() {
        state.peer = new Peer(state.me.id);

        state.peer.on('open', (id) => {
            console.log('Connected as:', id);
            document.getElementById('my-name').innerText = id;
            document.getElementById('my-avatar').src = state.me.avatar;
        });

        state.peer.on('connection', (conn) => {
            conn.on('data', (data) => handleIncomingData(data, conn.peer));
        });

        state.peer.on('call', (call) => {
            calls.answerUI(call);
        });
    }
};

// --- MESSAGING LOGIC ---
function handleIncomingData(data, senderId) {
    if (data.type === 'msg') {
        saveMessage(senderId, data.text, 'received');
        if (state.activeChatId === senderId) ui.renderMessages();
        ui.renderChatList();
    } else if (data.type === 'verif_signal') {
        state.me.verified = true;
        ui.initApp();
    }
}

function saveMessage(chatId, text, type) {
    if (!state.history[chatId]) state.history[chatId] = [];
    state.history[chatId].push({ text, type, time: Date.now() });
    localStorage.setItem('tatarsms_history', JSON.stringify(state.history));
    
    if (!state.chats.includes(chatId)) {
        state.chats.push(chatId);
        localStorage.setItem('tatarsms_chats', JSON.stringify(state.chats));
    }
}

const chat = {
    send() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text || !state.activeChatId) return;

        const conn = state.peer.connect(state.activeChatId);
        conn.on('open', () => {
            conn.send({ type: 'msg', text: text });
            saveMessage(state.activeChatId, text, 'sent');
            ui.renderMessages();
            input.value = '';
        });
    },

    createGroup() {
        const name = document.getElementById('group-name-input').value.trim();
        if (!name) return;
        const groupId = 'group_' + Math.random().toString(36).substr(2, 9);
        state.groups.push({ id: groupId, name: name });
        localStorage.setItem('tatarsms_groups', JSON.stringify(state.groups));
        ui.closeModals();
        ui.switchTab('groups');
    }
};

// --- UI CONTROLLER ---
const ui = {
    initApp() {
        if (state.me.verified) {
            document.getElementById('verif-label').innerHTML = 'Верифицирован <i class="fas fa-check-circle" style="color:#00a8fc"></i>';
            if (state.me.role === 'admin') document.getElementById('admin-panel').classList.remove('hidden');
        }
        this.renderChatList();
        this.renderStickers('default');
    },

    switchTab(tab) {
        state.activeTab = tab;
        document.querySelectorAll('.nav-icon').forEach(i => i.classList.remove('active'));
        event.currentTarget.classList.add('active');
        this.renderChatList();
    },

    renderChatList() {
        const container = document.getElementById('chat-list');
        container.innerHTML = '';
        const items = state.activeTab === 'dm' ? state.chats : state.groups;

        items.forEach(item => {
            const id = typeof item === 'string' ? item : item.id;
            const name = typeof item === 'string' ? item : item.name;
            const div = document.createElement('div');
            div.className = `sidebar-header ${state.activeChatId === id ? 'active' : ''}`;
            div.onclick = () => this.openChat(id, name);
            div.innerHTML = `
                <div class="my-info">
                    <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${id}" style="width:35px; border-radius:50%">
                    <span>${name}</span>
                </div>
            `;
            container.appendChild(div);
        });
    },

    openChat(id, name) {
        state.activeChatId = id;
        document.getElementById('empty-state').classList.add('hidden');
        document.getElementById('active-chat').classList.remove('hidden');
        document.getElementById('target-name').innerText = name;
        this.renderMessages();
    },

    renderMessages() {
        const container = document.getElementById('messages-view');
        container.innerHTML = '';
        const msgs = state.history[state.activeChatId] || [];
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = `msg-bubble ${m.type}`;
            div.innerHTML = m.text;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    },

    openModal(id) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(id).classList.remove('hidden');
    },

    closeModals() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    },

    toggleStickers() {
        document.getElementById('sticker-box').classList.toggle('hidden');
    },

    renderStickers(type) {
        const grid = document.getElementById('sticker-grid');
        grid.innerHTML = '';
        const list = ['https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif', 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif', 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif'];
        list.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.onclick = () => {
                const html = `<img src="${url}" style="width:80px">`;
                chat.send(html); // Немного упростим для примера
                this.toggleStickers();
            };
            grid.appendChild(img);
        });
    },

    verifyInfo() {
        alert("Для получения синей галочки отправьте видео с лицом и фразой 'tatarsms verify' на daniil.kokorin6858569@gmail.com");
    }
};

// --- CALLS ---
const calls = {
    async init(video) {
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
            document.getElementById('local-video').srcObject = state.localStream;
            ui.openModal('call-modal');
            
            const call = state.peer.call(state.activeChatId, state.localStream);
            this.handleCall(call);
        } catch (e) { alert("Ошибка доступа к камере/микрофону"); }
    },

    answerUI(call) {
        ui.openModal('call-modal');
        document.getElementById('call-user-name').innerText = "Входящий от " + call.peer;
        document.getElementById('btn-accept').onclick = async () => {
            state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('local-video').srcObject = state.localStream;
            call.answer(state.localStream);
            this.handleCall(call);
        };
    },

    handleCall(call) {
        state.currentCall = call;
        call.on('stream', (remoteStream) => {
            document.getElementById('remote-video').srcObject = remoteStream;
        });
        document.getElementById('btn-decline').onclick = () => {
            call.close();
            ui.closeModals();
        };
    }
};

// --- ADMIN ---
const admin = {
    giveBadge() {
        const target = document.getElementById('verify-target-id').value.trim();
        if (!target) return;
        const conn = state.peer.connect(target);
        conn.on('open', () => {
            conn.send({ type: 'verif_signal' });
            alert("Галочка выдана!");
        });
    }
};

// --- GLOBAL SEARCH ---
document.getElementById('global-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const id = e.target.value.trim();
        if (id && id !== state.me.id) {
            ui.openChat(id, id);
            e.target.value = '';
        }
    }
});

// Отправка по Enter
document.getElementById('msg-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') chat.send();
});
