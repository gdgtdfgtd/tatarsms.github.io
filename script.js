// --- CONFIG ---
const EMAILJS_KEY = "_QD5eXUp0g9r3WEC-"; 
const EMAIL_SERV = "service_tatarsms";
const EMAIL_TEMP = "template_zxlr5as";
const ADMIN_ID = "tatar_506";
const ADMIN_PW = "spinogrz666";

let state = {
    user: JSON.parse(localStorage.getItem('ts_sess')),
    db: JSON.parse(localStorage.getItem('ts_db') || '{"users":{}}'),
    friends: JSON.parse(localStorage.getItem(`ts_fr_${localStorage.getItem('ts_sess')?.id}`) || '[]'),
    history: JSON.parse(localStorage.getItem('ts_hist') || '{}'),
    stickers: JSON.parse(localStorage.getItem('ts_st') || []),
    blocked: JSON.parse(localStorage.getItem('ts_bl') || '[]'),
    peer: null, chat: null, code: null, tempReg: null, captcha: null,
    recorder: null, chunks: []
};

// --- AUTH SYSTEM ---
const auth = {
    switch(view) {
        ['login','reg','bot','code'].forEach(v => document.getElementById(`auth-${v}-view`).classList.add('hidden'));
        document.getElementById(`auth-${view}-view`).classList.remove('hidden');
    },

    startReg() {
        const id = document.getElementById('reg-id').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const pw = document.getElementById('reg-pass').value.trim();
        if(!id || !email || !pw) return alert("Заполните всё!");
        if(state.db.users[id]) return alert("ID занят");

        this.tempReg = {id, email, pw};
        this.genCaptcha();
        this.switch('bot');
    },

    genCaptcha() {
        const a = Math.floor(Math.random()*20);
        const b = Math.floor(Math.random()*10);
        this.captcha = a + b;
        document.getElementById('captcha-task').innerText = `Ботам вход запрещен. Решите: ${a} + ${b}?`;
    },

    verifyBot() {
        const val = document.getElementById('captcha-input').value;
        if(val != this.captcha) { alert("Неверно!"); return this.genCaptcha(); }
        this.sendEmail();
    },

    sendEmail() {
        this.code = Math.floor(100000 + Math.random() * 900000);
        emailjs.init(EMAILJS_KEY);
        emailjs.send(EMAIL_SERV, EMAIL_TEMP, {
            to_email: this.tempReg.email,
            code: this.code
        }).then(() => this.switch('code'), () => {
            alert("Ошибка почты! (Симуляция: " + this.code + ")");
            this.switch('code');
        });
    },

    complete() {
        if(document.getElementById('reg-code').value != this.code) return alert("Код неверный");
        state.db.users[this.tempReg.id] = {
            pw: btoa(this.tempReg.pw),
            av: `https://api.dicebear.com/7.x/avataaars/svg?seed=${this.tempReg.id}`
        };
        localStorage.setItem('ts_db', JSON.stringify(state.db));
        alert("Аккаунт создан!"); this.switch('login');
    },

    login() {
        const id = document.getElementById('login-id').value.trim();
        const pw = document.getElementById('login-pass').value.trim();
        
        if(id === ADMIN_ID && pw === ADMIN_PW) return this.startSess(id, true);
        
        const u = state.db.users[id];
        if(u && atob(u.pw) === pw) this.startSess(id, false);
        else alert("Ошибка входа!");
    },

    startSess(id, isAdmin) {
        const u = state.db.users[id];
        localStorage.setItem('ts_sess', JSON.stringify({id, av: u?.av || '', admin: isAdmin}));
        location.reload();
    },

    logout() { localStorage.removeItem('ts_sess'); location.reload(); }
};

// --- P2P ENGINE ---
const msg = {
    init() {
        state.peer = new Peer(state.user.id);
        state.peer.on('open', () => {
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-screen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            ui.renderList();
        });
        state.peer.on('connection', conn => {
            if(state.blocked.includes(conn.peer)) return;
            conn.on('data', data => this.receive(data, conn.peer));
        });
    },

    send(dataObj = null) {
        const input = document.getElementById('main-input');
        const content = dataObj || { type: 'text', val: input.value.trim() };
        if(!content.val || !state.chat) return;

        const conn = state.peer.connect(state.chat);
        conn.on('open', () => {
            conn.send(content);
            this.save(state.chat, content, 'sent');
            if(!dataObj) input.value = '';
        });
    },

    receive(data, from) {
        if(data.type === 'req') return ui.notifyReq(from);
        if(data.type === 'acc') { state.friends.push(from); this.saveFr(); return ui.renderList(); }
        this.save(from, data, 'received');
    },

    save(peer, data, dir) {
        if(!state.history[peer]) state.history[peer] = [];
        state.history[peer].push({...data, dir, time: new Date().toLocaleTimeString().slice(0,5)});
        localStorage.setItem('ts_hist', JSON.stringify(state.history));
        if(state.chat === peer) ui.renderChat();
    },

    file(el) {
        const file = el.files[0];
        const r = new FileReader();
        r.onload = e => this.send({type: file.type.startsWith('image') ? 'img' : 'file', val: e.target.result});
        r.readAsDataURL(file);
    },

    req() {
        const id = document.getElementById('friend-id-input').value.trim();
        const conn = state.peer.connect(id);
        conn.on('open', () => { conn.send({type: 'req'}); alert("Запрос отправлен!"); ui.closeModals(); });
    },

    blockUser() {
        state.blocked.push(state.chat);
        localStorage.setItem('ts_bl', JSON.stringify(state.blocked));
        ui.closeChat();
    }
};

// --- UI ENGINE ---
const ui = {
    renderList() {
        const list = document.getElementById('contact-list'); list.innerHTML = '';
        state.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `contact-item ${state.chat === f ? 'active' : ''}`;
            div.onclick = () => this.select(f);
            div.innerHTML = `<img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f}"><span>${f}</span>`;
            list.appendChild(div);
        });
        document.getElementById('my-av').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${state.user.id}`;
        document.getElementById('my-name').innerText = state.user.id;
    },

    select(id) {
        state.chat = id;
        document.getElementById('chat-welcome').classList.add('hidden');
        document.getElementById('chat-active').classList.remove('hidden');
        document.getElementById('chat-user-name').innerText = id;
        document.getElementById('chat-av').src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`;
        if(window.innerWidth < 768) document.getElementById('sidebar').classList.add('hidden');
        this.renderChat();
    },

    renderChat() {
        const box = document.getElementById('messages'); box.innerHTML = '';
        (state.history[state.chat] || []).forEach(m => {
            const div = document.createElement('div');
            div.className = `msg ${m.dir}`;
            let html = `<div class="msg-bubble">`;
            if(m.type === 'text') html += m.val;
            else if(m.type === 'img') html += `<div class="media-frame"><img src="${m.val}" onclick="ui.view(this.src)"></div>`;
            else if(m.type === 'voice') html += `<audio src="${m.val}" controls></audio>`;
            html += `<div class="msg-time">${m.time}</div></div>`;
            div.innerHTML = html;
            box.appendChild(div);
        });
        box.scrollTop = box.scrollHeight;
    },

    view(src) { document.getElementById('media-viewer').classList.remove('hidden'); document.getElementById('full-img').src = src; },
    modal(id) { document.getElementById('modal-overlay').classList.remove('hidden'); document.getElementById(`modal-${id}`).classList.remove('hidden'); },
    closeModals() { document.getElementById('modal-overlay').classList.add('hidden'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); },
    toggleSidebar() { document.getElementById('sidebar').classList.toggle('hidden'); },
    closeChat() { document.getElementById('chat-active').classList.add('hidden'); document.getElementById('chat-welcome').classList.remove('hidden'); this.toggleSidebar(); }
};

// --- VOICE ---
const voice = {
    start() {
        navigator.mediaDevices.getUserMedia({audio:true}).then(s => {
            state.recorder = new MediaRecorder(s);
            let chunks = [];
            state.recorder.ondataavailable = e => chunks.push(e.data);
            state.recorder.onstop = () => {
                const r = new FileReader();
                r.onload = e => msg.send({type:'voice', val: e.target.result});
                r.readAsDataURL(new Blob(chunks));
            };
            state.recorder.start();
            document.getElementById('mic-btn').classList.add('rec');
        });
    },
    stop() { if(state.recorder) { state.recorder.stop(); document.getElementById('mic-btn').classList.remove('rec'); } }
};

// --- STICKERS ---
const stickers = {
    add() {
        const url = document.getElementById('new-st-url').value;
        if(url) { state.stickers.push(url); localStorage.setItem('ts_st', JSON.stringify(state.stickers)); this.render(); }
    },
    render() {
        const grid = document.getElementById('sticker-grid'); grid.innerHTML = '';
        state.stickers.forEach(s => {
            const img = document.createElement('img'); img.src = s;
            img.onclick = () => { msg.send({type:'img', val:s}); ui.toggleStickers(); };
            grid.appendChild(img);
        });
    }
};

if(state.user) msg.init();
else { document.getElementById('loading-screen').classList.add('hidden'); document.getElementById('auth-screen').classList.remove('hidden'); }
