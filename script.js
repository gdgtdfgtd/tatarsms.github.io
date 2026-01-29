// --- CONFIGURATION & STATE ---
const ADMIN_ID = "tatar_506";
const ADMIN_PASS = "spinogrz666";

let state = {
    me: { id: '', nickname: '', avatar: '', verified: false, isAdmin: false },
    friends: JSON.parse(localStorage.getItem('tatarsms_friends') || '[]'),
    history: JSON.parse(localStorage.getItem('tatarsms_history') || '{}'),
    stickers: JSON.parse(localStorage.getItem('tatarsms_stickers') || '[]'),
    activePeer: null,
    peer: null,
    currentCall: null,
    localStream: null
};

// --- CORE INITIALIZATION ---
const auth = {
    login: () => {
        const idInput = document.getElementById('login-id').value.trim();
        const passInput = document.getElementById('admin-pass').value.trim();
        
        if (!idInput) return alert("Please enter a nickname");

        state.me.id = idInput;
        state.me.nickname = idInput;
        state.me.avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${idInput}`;
        
        if (idInput === ADMIN_ID && passInput === ADMIN_PASS) {
            state.me.isAdmin = true;
            state.me.verified = true;
        }

        document.getElementById('auth-overlay').classList.add('hidden');
        initPeer();
        ui.renderFriends();
        ui.loadProfile();
    }
};

function initPeer() {
    state.peer = new Peer(state.me.id);

    state.peer.on('open', (id) => {
        console.log('Connected to Peer Server with ID:', id);
        document.getElementById('my-nickname').innerText = state.me.nickname;
    });

    // Handle Incoming Messages
    state.peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            handleIncomingData(data, conn.peer);
        });
    });

    // Handle Incoming Calls
    state.peer.on('call', (call) => {
        calls.handleIncoming(call);
    });
}

// --- MESSAGE LOGIC ---
function handleIncomingData(data, senderId) {
    if (data.type === 'chat') {
        saveMessage(senderId, data.text, 'received');
        if (state.activePeer === senderId) ui.renderMessages(senderId);
        ui.renderFriends();
    } else if (data.type === 'request') {
        if (!state.friends.find(f => f.id === senderId)) {
            if (confirm(`User ${senderId} wants to chat. Accept?`)) {
                addFriend(senderId);
            }
        }
    } else if (data.type === 'verify_signal' && state.me.isAdmin) {
        // Handle admin verification requests
    } else if (data.type === 'verified_update') {
        updateVerificationLocally(senderId, data.status);
    }
}

function sendMessage(text) {
    if (!state.activePeer || !text) return;
    
    const conn = state.peer.connect(state.activePeer);
    conn.on('open', () => {
        conn.send({ type: 'chat', text: text });
        saveMessage(state.activePeer, text, 'sent');
        ui.renderMessages(state.activePeer);
        document.getElementById('message-input').value = '';
    });
}

// --- CALL LOGIC ---
const calls = {
    initiate: async (video) => {
        try {
            state.localStream = await navigator.mediaDevices.getUserMedia({ video: video, audio: true });
            document.getElementById('local-video').srcObject = state.localStream;
            
            ui.toggleModal('call-modal');
            document.getElementById('btn-accept').classList.add('hidden');
            document.getElementById('btn-hangup').classList.remove('hidden');

            const call = state.peer.call(state.activePeer, state.localStream);
            state.currentCall = call;
            
            call.on('stream', (remoteStream) => {
                document.getElementById('remote-video').srcObject = remoteStream;
            });
        } catch (err) {
            alert("Could not access camera/mic");
        }
    },
    handleIncoming: (call) => {
        state.currentCall = call;
        ui.toggleModal('call-modal');
        document.getElementById('call-name').innerText = `Incoming from ${call.peer}`;
        document.getElementById('btn-hangup').classList.add('hidden');
        document.getElementById('btn-accept').classList.remove('hidden');

        document.getElementById('btn-accept').onclick = async () => {
            state.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            document.getElementById('local-video').srcObject = state.localStream;
            call.answer(state.localStream);
            call.on('stream', (remoteStream) => {
                document.getElementById('remote-video').srcObject = remoteStream;
            });
            document.getElementById('btn-accept').classList.add('hidden');
            document.getElementById('btn-hangup').classList.remove('hidden');
        };

        document.getElementById('btn-decline').onclick = () => {
            call.close();
            ui.closeModals();
        };
    }
};

// --- UI CONTROLLER ---
const ui = {
    renderFriends: () => {
        const list = document.getElementById('friends-list');
        list.innerHTML = '';
        state.friends.forEach(f => {
            const div = document.createElement('div');
            div.className = `friend-item ${state.activePeer === f.id ? 'active' : ''}`;
            div.onclick = () => ui.selectChat(f.id);
            div.innerHTML = `
                <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=${f.id}" style="width:32px;border-radius:50%">
                <span>${f.id}</span>
                ${f.verified ? '<i class="fas fa-check-circle badge"></i>' : ''}
            `;
            list.appendChild(div);
        });
    },
    selectChat: (id) => {
        state.activePeer = id;
        document.getElementById('chat-welcome').classList.add('hidden');
        document.getElementById('chat-main').classList.remove('hidden');
        document.getElementById('active-chat-name').innerText = id;
        ui.renderMessages(id);
        ui.renderFriends();
    },
    renderMessages: (peerId) => {
        const container = document.getElementById('message-container');
        container.innerHTML = '';
        const msgs = state.history[peerId] || [];
        msgs.forEach(m => {
            const div = document.createElement('div');
            div.className = `message ${m.type}`;
            div.innerHTML = `
                <span class="msg-meta">${m.type === 'sent' ? 'You' : peerId}</span>
                <div class="msg-content">${m.text}</div>
            `;
            container.appendChild(div);
        });
        container.scrollTop = container.scrollHeight;
    },
    toggleModal: (id) => {
        document.getElementById('modal-overlay').classList.remove('hidden');
        document.getElementById(id).classList.remove('hidden');
    },
    closeModals: () => {
        document.querySelectorAll('.modal, .modal-overlay').forEach(el => el.classList.add('hidden'));
        if (state.currentCall) {
            state.currentCall.close();
            if(state.localStream) state.localStream.getTracks().forEach(t => t.stop());
        }
        // Save profile
        state.me.avatar = document.getElementById('set-avatar').value || state.me.avatar;
        document.getElementById('my-avatar').src = state.me.avatar;
    },
    showVerificationInfo: () => {
        alert("To receive a blue checkmark, you must send a video with your face and voice to: daniil.kokorin6858569@gmail.com. Once the admin approves your video, the badge will be activated.");
    },
    loadProfile: () => {
        document.getElementById('set-nickname').value = state.me.nickname;
        document.getElementById('set-avatar').value = state.me.avatar;
        if (state.me.isAdmin) document.getElementById('admin-panel').classList.remove('hidden');
    },
    toggleStickerPicker: () => {
        document.getElementById('sticker-picker').classList.toggle('hidden');
        ui.showStickers('default');
    },
    showStickers: (type) => {
        const grid = document.getElementById('sticker-grid');
        grid.innerHTML = '';
        const list = type === 'default' ? [
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif',
            'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif'
        ] : state.stickers;

        list.forEach(url => {
            const img = document.createElement('img');
            img.src = url;
            img.onclick = () => {
                sendMessage(`<img src="${url}" style="width:100px">`);
                ui.toggleStickerPicker();
            };
            grid.appendChild(img);
        });
    }
};

// --- DATA PERSISTENCE ---
function saveMessage(peerId, text, type) {
    if (!state.history[peerId]) state.history[peerId] = [];
    state.history[peerId].push({ text, type, time: Date.now() });
    localStorage.setItem('tatarsms_history', JSON.stringify(state.history));
}

function addFriend(id) {
    if (!state.friends.find(f => f.id === id)) {
        state.friends.push({ id, verified: false });
        localStorage.setItem('tatarsms_friends', JSON.stringify(state.friends));
        ui.renderFriends();
    }
}

// --- SEARCH / FRIEND REQUEST ---
document.getElementById('peer-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const target = e.target.value.trim();
        if (target && target !== state.me.id) {
            const conn = state.peer.connect(target);
            conn.on('open', () => {
                conn.send({ type: 'request' });
                addFriend(target);
                ui.selectChat(target);
                e.target.value = '';
            });
            conn.on('error', () => alert("User not found or offline"));
        }
    }
});

document.getElementById('message-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage(e.target.value);
});

// --- ADMIN SYSTEM ---
const admin = {
    verifyUser: () => {
        const targetId = document.getElementById('admin-target-peer').value.trim();
        const conn = state.peer.connect(targetId);
        conn.on('open', () => {
            conn.send({ type: 'verified_update', status: true });
            updateVerificationLocally(targetId, true);
            alert("Verification sent!");
        });
    }
};

function updateVerificationLocally(id, status) {
    const friend = state.friends.find(f => f.id === id);
    if (friend) {
        friend.verified = status;
        localStorage.setItem('tatarsms_friends', JSON.stringify(state.friends));
        ui.renderFriends();
    }
}

const stickers = {
    add: () => {
        const url = document.getElementById('sticker-url').value;
        if(url) {
            state.stickers.push(url);
            localStorage.setItem('tatarsms_stickers', JSON.stringify(state.stickers));
            ui.showStickers('custom');
        }
    }
};
