const ADMIN_ID = "tatar_506";
const ADMIN_PASS = "spinogrz666";

let state = {
    me: { id: '', avatar: '', verified: false, isAdmin: false },
    friends: JSON.parse(localStorage.getItem('tat_friends') || '[]'),
    groups: JSON.parse(localStorage.getItem('tat_groups') || '[]'),
    history: JSON.parse(localStorage.getItem('tat_history') || '{}'),
    stickers: JSON.parse(localStorage.getItem('tat_stickers') || []),
    activeChat: null,
    peer: null,
    currentCall: null,
    localStream: null
};

// --- AUTH LOGIC ---
const auth = {
    isAdminMode: false,
    toggleAdmin() {
        this.isAdminMode = !this.isAdminMode;
        document.getElementById('admin-pass-block').classList.toggle('hidden');
    },
    async finish() {
        const id = document.getElementById('reg-id').value.trim();
        const pass = document.getElementById('reg-admin-pass').value.trim();
        const avatar = document.getElementById('reg-avatar-preview').src;

        if (!id) return alert("Введите ID");
        if (this.isAdminMode) {
            if (id !== ADMIN_ID || pass !== ADMIN_PASS) return alert("Ошибка админа");
            state.me.isAdmin = true;
            state.me.verified = true;
        }

        state.me.id = id;
        state.me.avatar = avatar;
        
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        this.initPeer();
    },
    initPeer() {
        state.peer = new Peer(state.me.id);
        state.peer.on('open', () => {
            document.getElementById('my-name-display').innerText = state.me.id;
            document.getElementById('my-avatar-img').src = state.me.avatar;
            ui.renderFriends();
            ui.renderGroups();
        });
        state.peer.on('connection', (conn) => {
            conn.on('data', (data) => {
                if (data.type === 'msg') {
                    chat.receive(conn.peer, data.text);
                } else if (data.type === 'verif') {
                    state.me.verified = true;
                    ui.saveSettings();
                }
            });
        });
        state.peer.on('call', (call) => calls.answerUI(call));
    }
};

// --- CHAT LOGIC ---
const chat = {
    send() {
        const input = document.getElementById('msg-input');
        const text = input.value.trim();
        if (!text || !state.activeChat) return;

        const conn = state.peer.connect(state.activeChat);
        conn.on('open', () => {
            conn.send({ type: 'msg', text: text });
            this.saveHistory(state.activeChat, text, 'sent');
            ui.renderMessages();
            input.value = '';
        });
    },
    receive(senderId, text) {
        this.saveHistory(senderId, text, 'received');
        if (!state.friends.includes(senderId)) {
            state.friends.push(senderId);
            localStorage.setItem('tat_friends', JSON.stringify(state.friends));
            ui.renderFriends();
        }
        if (state.activeChat === senderId) ui.renderMessages();
    },
    saveHistory(id, text, type) {
        if (!state.history[id]) state.history[id] = [];
        state.history[id].push({ text, type, time: Date.now() });
        localStorage.setItem('tat_history', JSON.stringify(state.history));
    },
    createGroup() {
        const name = document.getElementById('group-name-input').value;
        const av = document.getElementById('group-avatar-preview').src;
        if (!name) return;
        const gId = 'grp_' + Date.now();
        state.groups.push({ id: gId, name, avatar: av });
        localStorage.setItem('tat_groups', JSON.stringify(state.groups));
        ui.renderGroups();
        ui.closeModals();
    }
};

// --- UI CONTROLLER ---
const ui = {
    switchTab(tab) {
        state.activeChat = null;
        document.getElementById('chat-active').classList.add('hidden');
        document.getElementById('chat-empty').classList.remove('hidden');
    },
    renderFriends() {
        const list = document.getElementById('contact-list');
        list.innerHTML = '';
        state.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = 'contact-item';
            div.onclick = () => this.selectChat(f, f);
            div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f}"> <span>${f}</span>`;
            list.appendChild(div);
        });
    },
    renderGroups() {
        const rail = document.getElementById('group-icons');
        rail.innerHTML = '';
        state.groups.forEach(g => {
            const div = document.createElement('div');
            div.className = 'nav-icon';
            div.onclick = () => this.selectChat(g.id, g.name);
            div.innerHTML = `<img src="${g.avatar}" style="width:100%;height:100%;border-radius:50%">`;
            rail.appendChild(div);
        });
    },
    selectChat(id, name) {
        state.activeChat = id;
        document.getElementById('chat-empty').classList.add('hidden');
        document.getElementById('chat-active').classList.remove('hidden');
        document.getElementById('active-name').innerText = name;
        this.renderMessages();
    },
    renderMessages() {
        const view = document.getElementById('messages-view');
        view.innerHTML = '';
        const msgs = state.history[state.activeChat] || [];
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = `msg-bubble ${m.type}`;
            div.innerHTML = m.text;
            view.appendChild(div);
        });
        view.scrollTop = view.scrollHeight;
    },
    toggleEmoji() {
        const p = document.getElementById('emoji-picker');
        p.classList.toggle('hidden');
        const grid = document.getElementById('emoji-grid');
        grid.innerHTML = '';
        ['😀','😂','😍','🔥','🙌','✨','🚀','🎉','❤️','👍'].forEach(e => {
            const span = document.createElement('span');
            span.innerText = e;
            span.onclick = () => {
                document.getElementById('msg-input').value += e;
                p.classList.add('hidden');
            };
            grid.appendChild(span);
        });
    },
    toggleStickers() {
        document.getElementById('sticker-picker').classList.toggle('hidden');
        this.renderStickers('default');
    },
    renderStickers(type) {
        const grid = document.getElementById('sticker-grid');
        grid.innerHTML = '';
        const list = type === 'default' ? ['https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif'] : state.stickers;
        list.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.onclick = () => {
                chat.send(`<img src="${url}" style="width:100px">`);
                document.getElementById('sticker-picker').classList.add('hidden');
            };
            grid.appendChild(img);
        });
    },
    openModal(id) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(id).classList.remove('hidden');
        if (id === 'settings-modal') {
            document.getElementById('set-avatar-preview').src = state.me.avatar;
            document.getElementById('verif-status').innerText = state.me.verified ? "Верифицирован ✅" : "Нет";
            if (state.me.isAdmin) document.getElementById('admin-panel').classList.remove('hidden');
        }
    },
    closeModals() {
        document.getElementById('modal-overlay').classList.add('hidden');
        document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    },
    saveSettings() {
        state.me.avatar = document.getElementById('set-avatar-preview').src;
        document.getElementById('my-avatar-img').src = state.me.avatar;
        this.closeModals();
    }
};

// --- CALLS ---
const calls = {
    async init(video) {
        const stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        state.localStream = stream;
        document.getElementById('local-video').srcObject = stream;
        ui.openModal('call-modal');
        const call = state.peer.call(state.activeChat, stream);
        this.handleCall(call);
    },
    answerUI(call) {
        ui.openModal('call-modal');
        document.getElementById('call-user-title').innerText = "Вызов от " + call.peer;
        document.getElementById('btn-accept').onclick = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            state.localStream = stream;
            document.getElementById('local-video').srcObject = stream;
            call.answer(stream);
            this.handleCall(call);
            document.getElementById('btn-accept').classList.add('hidden');
        };
    },
    handleCall(call) {
        state.currentCall = call;
        call.on('stream', s => document.getElementById('remote-video').srcObject = s);
    }
};

// --- HELPERS ---
function handleFile(input, previewId) {
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = rs => document.getElementById(previewId).src = rs.target.result;
        reader.readAsDataURL(file);
    };
}
handleFile(document.getElementById('reg-avatar-input'), 'reg-avatar-preview');
handleFile(document.getElementById('set-avatar-input'), 'set-avatar-preview');
handleFile(document.getElementById('group-avatar-input'), 'group-avatar-preview');

const stickers = {
    add() {
        const url = document.getElementById('sticker-url-input').value;
        if(url) {
            state.stickers.push(url);
            localStorage.setItem('tat_stickers', JSON.stringify(state.stickers));
            ui.renderStickers('custom');
        }
    }
};

const admin = {
    verify() {
        const tid = document.getElementById('admin-target-id').value;
        const conn = state.peer.connect(tid);
        conn.on('open', () => conn.send({ type: 'verif' }));
        alert("Верификация отправлена!");
    }
};

document.getElementById('peer-search').onkeypress = e => {
    if (e.key === 'Enter') {
        const id = e.target.value.trim();
        if (id && !state.friends.includes(id)) {
            state.friends.push(id);
            localStorage.setItem('tat_friends', JSON.stringify(state.friends));
            ui.renderFriends();
            ui.selectChat(id, id);
        }
    }
};
