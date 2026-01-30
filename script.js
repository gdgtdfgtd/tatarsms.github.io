const ADMIN_ID = "tatar_506";
const ADMIN_PW = "spinogrz666";

let state = {
    db: JSON.parse(localStorage.getItem('tat_db') || '{"users":{}}'),
    user: JSON.parse(localStorage.getItem('tat_session') || 'null'),
    peer: null,
    activeChat: null,
    friends: JSON.parse(localStorage.getItem('tat_friends') || '[]'),
    history: JSON.parse(localStorage.getItem('tat_history') || '{}'),
    stickers: JSON.parse(localStorage.getItem('tat_stickers') || []),
    isReg: false,
    recorder: null,
    chunks: []
};

// --- AUTH ---
const account = {
    toggle() {
        state.isReg = !state.isReg;
        document.querySelector('.toggle-text').innerHTML = state.isReg ? 'Уже есть аккаунт? <span onclick="account.toggle()">Войти</span>' : 'Нет аккаунта? <span onclick="account.toggle()">Создать</span>';
        document.getElementById('reg-fields').classList.toggle('hidden', !state.isReg);
    },
    submit() {
        const id = document.getElementById('auth-id').value.trim();
        const pw = document.getElementById('auth-pw').value.trim();
        const av = document.getElementById('auth-av').value.trim();

        if(!id || !pw) return alert("Заполните поля");

        if(state.isReg) {
            if(state.db.users[id]) return alert("ID занят");
            state.db.users[id] = { pw: btoa(pw), av: av || `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`, verif: id === ADMIN_ID };
            localStorage.setItem('tat_db', JSON.stringify(state.db));
            alert("Успешно! Войдите.");
            this.toggle();
        } else {
            const u = state.db.users[id];
            if((u && atob(u.pw) === pw) || (id === ADMIN_ID && pw === ADMIN_PW)) {
                state.user = { id, av: u?.av || '', verif: u?.verif || (id === ADMIN_ID) };
                localStorage.setItem('tat_session', JSON.stringify(state.user));
                location.reload();
            } else alert("Неверный вход");
        }
    },
    logout() { localStorage.removeItem('tat_session'); location.reload(); }
};

// --- MESSENGER ---
const messenger = {
    init() {
        state.peer = new Peer(state.user.id);
        state.peer.on('open', () => {
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            ui.refresh();
        });
        state.peer.on('connection', conn => {
            conn.on('data', data => this.handleData(data, conn.peer));
        });
        state.peer.on('call', call => calls.incoming(call));
    },
    handleData(data, from) {
        if(!state.friends.includes(from)) {
            state.friends.push(from);
            localStorage.setItem('tat_friends', JSON.stringify(state.friends));
            ui.refresh();
        }
        this.saveMsg(from, data, 'received');
    },
    send() {
        const input = document.getElementById('msg-input');
        if(!input.value.trim() || !state.activeChat) return;
        this.dispatch({ type: 'text', content: input.value });
        input.value = '';
    },
    async file(input) {
        const file = input.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = () => this.dispatch({ type: 'file', content: reader.result, mime: file.type });
        reader.readAsDataURL(file);
    },
    dispatch(data) {
        const conn = state.peer.connect(state.activeChat);
        conn.on('open', () => {
            conn.send(data);
            this.saveMsg(state.activeChat, data, 'sent');
        });
    },
    saveMsg(peer, data, type) {
        if(!state.history[peer]) state.history[peer] = [];
        state.history[peer].push({...data, type, time: new Date().toLocaleTimeString()});
        localStorage.setItem('tat_history', JSON.stringify(state.history));
        if(state.activeChat === peer) ui.renderMessages();
    },
    addContact() {
        const id = document.getElementById('new-peer-id').value.trim();
        if(id && id !== state.user.id && !state.friends.includes(id)) {
            state.friends.push(id);
            localStorage.setItem('tat_friends', JSON.stringify(state.friends));
            ui.refresh();
            ui.selectChat(id);
        }
        ui.closeModals();
    },
    addSticker() {
        const url = document.getElementById('st-url').value;
        if(url) {
            state.stickers.push(url);
            localStorage.setItem('tat_stickers', JSON.stringify(state.stickers));
            ui.renderStickers();
        }
    },
    press(e) { if(e.key === 'Enter') this.send(); }
};

// --- VOICE ---
const voice = {
    async start() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({audio:true});
            state.recorder = new MediaRecorder(stream);
            state.chunks = [];
            state.recorder.ondataavailable = e => state.chunks.push(e.data);
            state.recorder.onstop = () => {
                const blob = new Blob(state.chunks, {type:'audio/ogg'});
                const reader = new FileReader();
                reader.onload = () => messenger.dispatch({type:'file', content:reader.result, mime:'audio/ogg'});
                reader.readAsDataURL(blob);
            };
            state.recorder.start();
            document.getElementById('mic-btn').style.color = 'var(--danger)';
        } catch(e) { alert("Микрофон!"); }
    },
    stop() {
        if(state.recorder) { state.recorder.stop(); document.getElementById('mic-btn').style.color = ''; }
    }
};

// --- CALLS ---
const calls = {
    async start(video) {
        ui.modal('call');
        document.getElementById('btn-accept').classList.add('hidden');
        const stream = await navigator.mediaDevices.getUserMedia({video, audio:true});
        document.getElementById('local-video').srcObject = stream;
        const call = state.peer.call(state.activeChat, stream);
        call.on('stream', rs => document.getElementById('remote-video').srcObject = rs);
    },
    incoming(call) {
        ui.modal('call');
        document.getElementById('call-title').innerText = "Вызов от " + call.peer;
        document.getElementById('btn-accept').onclick = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({video:true, audio:true});
            document.getElementById('local-video').srcObject = stream;
            call.answer(stream);
            call.on('stream', rs => document.getElementById('remote-video').srcObject = rs);
            document.getElementById('btn-accept').classList.add('hidden');
        };
    },
    end() { location.reload(); }
};

// --- UI ---
const ui = {
    refresh() {
        const list = document.getElementById('contact-list'); list.innerHTML = '';
        state.friends.forEach(id => {
            const div = document.createElement('div');
            div.className = `contact-item ${state.activeChat === id ? 'active' : ''}`;
            div.onclick = () => this.selectChat(id);
            div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${id}"><span>${id}</span>`;
            list.appendChild(div);
        });
        document.getElementById('my-av').src = state.user.av;
    },
    selectChat(id) {
        state.activeChat = id;
        document.getElementById('chat-welcome').classList.add('hidden');
        document.getElementById('chat-active').classList.remove('hidden');
        document.getElementById('target-name').innerText = id;
        document.getElementById('target-av').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;
        this.renderMessages(); this.refresh();
        if(window.innerWidth < 768) document.getElementById('sidebar').classList.remove('open');
    },
    renderMessages() {
        const box = document.getElementById('message-box'); box.innerHTML = '';
        const msgs = state.history[state.activeChat] || [];
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = `msg ${m.type}`;
            let content = m.content;
            if(m.type === 'file') {
                if(m.mime.startsWith('image')) content = `<img src="${m.content}" style="max-width:200px;border-radius:8px;">`;
                else if(m.mime.startsWith('audio')) content = `<audio src="${m.content}" controls style="width:200px"></audio>`;
                else content = `<a href="${m.content}" download style="color:white">Файл</a>`;
            }
            div.innerHTML = `<div class="msg-bubble">${content}</div><small style="font-size:9px;opacity:0.5;margin-top:2px;">${m.time}</small>`;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    },
    toggleStickers() { document.getElementById('sticker-panel').classList.toggle('hidden'); this.renderStickers(); },
    renderStickers() {
        const grid = document.getElementById('sticker-grid'); grid.innerHTML = '';
        state.stickers.forEach(url => {
            const img = document.createElement('img'); img.src = url;
            img.onclick = () => { messenger.dispatch({type:'file', content:url, mime:'image/png'}); this.toggleStickers(); };
            grid.appendChild(img);
        });
    },
    modal(id) {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById('modal-'+id).classList.remove('hidden');
        if(id === 'settings') {
            document.getElementById('my-id-val').innerText = state.user.id;
            document.getElementById('verif-val').innerText = state.user.verif ? 'Верифицирован ✅' : 'Обычный';
            if(state.user.id === ADMIN_ID) document.getElementById('admin-zone').classList.remove('hidden');
        }
    },
    closeModals() { document.getElementById('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); },
    toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }
};

const admin = {
    createTwink() {
        const id = document.getElementById('twink-id').value.trim();
        if(!id) return;
        state.db.users[id] = { pw: btoa("1234"), av: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`, verif: false };
        localStorage.setItem('tat_db', JSON.stringify(state.db));
        alert("Твинк создан! Пароль: 1234");
    }
};

// Start
if(state.user) messenger.init();
else { document.getElementById('loader').classList.add('hidden'); document.getElementById('auth-screen').classList.remove('hidden'); }
