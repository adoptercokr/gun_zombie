const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreVal = document.getElementById('score-val');
const waveVal = document.getElementById('wave-val');
const healthVal = document.getElementById('health-val');
const finalScore = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

let gameLoopId;
let isPlaying = false;
let score = 0;
let wave = 1;
let health = 5;
let frames = 0;
let isLaserActive = false;
let laserTimer = 0;
let muzzleFlashActive = 0;

// ─── Audio Engine (Lightweight & Throttled to prevent lag) ────────────────────
const SFX = {
    ctx: null, master: null, ready: false, lastHit: 0, lastKill: 0, lastItem: 0, BGMInterval: null,
    
    init() {
        if (this.ready) return;
        this.ready = true;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.35;
            this.master.connect(this.ctx.destination);
        } catch(e) {}
    },
    
    tone(freq1, freq2, dur, vol, type='sawtooth') {
        if (!this.ctx) return;
        if (this.ctx.state !== 'running') {
            try { this.ctx.resume(); } catch(e) {}
        }
        try {
            const n = this.ctx.currentTime;
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = type;
            o.frequency.setValueAtTime(freq1, n);
            o.frequency.exponentialRampToValueAtTime(Math.max(0.01, freq2), n + dur);
            g.gain.setValueAtTime(vol, n);
            g.gain.exponentialRampToValueAtTime(0.001, n + dur);
            o.connect(g); g.connect(this.master);
            o.start(n); o.stop(n + dur);
        } catch(e) {}
    },
    
    shot() { this.init(); this.tone(900, 80, 0.10, 0.06, 'sawtooth'); },
    hit() {
        this.init();
        const now = Date.now();
        if (now - this.lastHit < 80) return; 
        this.lastHit = now;
        this.tone(130, 30, 0.05, 0.04, 'triangle');
    },
    kill() { 
        this.init(); 
        const now = Date.now();
        if (now - this.lastKill < 100) return; 
        this.lastKill = now;
        this.tone(80, 1, 0.30, 0.12, 'sawtooth'); 
    },
    item() {
        this.init();
        const now = Date.now();
        if (now - this.lastItem < 120) return;
        this.lastItem = now;
        this.tone(523.25, 1046.50, 0.12, 0.08, 'sine');
    },
    
    startBGM() {
        this.init();
        if (this.BGMInterval) clearInterval(this.BGMInterval);
        
        let beat = 0;
        const playBeat = () => {
            if (!isPlaying) {
                clearInterval(this.BGMInterval);
                this.BGMInterval = null;
                return;
            }
            if (beat % 4 === 0) {
                this.tone(55, 0.01, 0.35, 0.10, 'sine');
            } else if (beat % 4 === 2) {
                this.tone(150, 10, 0.08, 0.03, 'triangle'); 
            }
            const notes = [110, 130, 146, 165];
            const note = notes[beat % notes.length];
            if (beat % 2 === 0) {
                this.tone(note, note * 0.98, 0.15, 0.02, 'triangle');
            }
            beat++;
        };
        this.BGMInterval = setInterval(playBeat, 260); 
    }
};

// ─── Visual Assets (Original Transparent Sprites) ────────────────────────────
const playerImg = new Image();
const zombieImg = new Image();
const bgImg = new Image();

let imagesLoaded = 0;
function onAssetLoaded() {
    imagesLoaded++;
}

playerImg.onload = onAssetLoaded;
zombieImg.onload = onAssetLoaded;
bgImg.onload = onAssetLoaded;

playerImg.src = 'assets/player1.png';
zombieImg.src = 'assets/zombie1.png';
bgImg.src = 'assets/bg.png';

let bgCanvas = document.createElement('canvas');
let bgCtx = bgCanvas.getContext('2d');
let bgPrepared = false;

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    bgPrepared = false;
}
window.addEventListener('resize', resize);
resize();

function prepareBg() {
    if (!bgImg.width) return;
    let w = canvas.width;
    let h = canvas.width * (bgImg.height / bgImg.width);
    bgCanvas.width = w;
    bgCanvas.height = h * 2; 
    
    bgCtx.drawImage(bgImg, 0, 0, w, h);
    bgCtx.save();
    bgCtx.translate(0, h * 2);
    bgCtx.scale(1, -1);
    bgCtx.drawImage(bgImg, 0, 0, w, h);
    bgCtx.restore();
    
    bgPrepared = true;
}

// 모바일 여부 감지 (터치 디바이스)
function isMobile() {
    return window.innerWidth <= 768 || ('ontouchstart' in window);
}

const player = {
    x: canvas.width / 2,
    y: canvas.height - 135,
    width: 170,
    height: 170,
    targetX: canvas.width / 2,
    bulletLevel: 1, // Bullet Count Level: Capped strictly at 5!
    bulletPower: 1, // Bullet Power: Increases damage and changes color (Cyan -> Pink -> Gold -> Green)
    
    draw() {
        if (imagesLoaded >= 3) {
            let bob = Math.sin(frames * 0.3) * 5;
            let tilt = Math.sin(frames * 0.15) * 0.05;
            ctx.save();
            ctx.translate(this.x, this.y + bob);
            ctx.rotate(tilt);
            
            ctx.drawImage(playerImg, -this.width/2, -this.height/2, this.width, this.height);
            
            // Lightweight Muzzle Flash (NO shadow blurs to avoid lag!)
            if (muzzleFlashActive > 0) {
                ctx.save();
                ctx.translate(18, -this.height/2 + 25);
                ctx.fillStyle = '#ff9f43';
                ctx.beginPath();
                ctx.arc(0, 0, 15, 0, Math.PI*2);
                ctx.fill();
                ctx.restore();
                muzzleFlashActive--;
            }
            
            ctx.restore();
        } else {
            ctx.fillStyle = '#1e90ff';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }
    },
    update() {
        // 모바일과 PC 화면 비율을 9:16으로 통일했으므로 동일한 하단 오프셋(135px)을 적용하여 하단 짤림 방지
        let bottomOffset = 135;
        this.y = canvas.height - bottomOffset;
        this.x += (this.targetX - this.x) * 0.2;
        if(this.x < this.width/2) this.x = this.width/2;
        if(this.x > canvas.width - this.width/2) this.x = canvas.width - this.width/2;
    }
};

let bullets = [];
let zombies = [];
let particles = [];
let items = [];

function spawnZombie() {
    let count = Math.floor(Math.random() * 3) + 2; 
    for(let i=0; i<count; i++) {
        let isGiant = Math.random() < 0.12;
        let size = isGiant ? 260 : 150;
        let hp = isGiant ? (10 + wave * 4) : (3 + Math.floor(wave / 2));
        let speed = isGiant ? (0.2 + wave * 0.02) : (0.4 + Math.random() * 0.3 + wave * 0.04);
        
        // 최상단에서 출발하되, 좀비의 반 정도가 보이는 위치(y = 0 부근)에서 생성되도록 수정
        let spawnY = -size * 0.2 + Math.random() * (size * 0.2);
        
        zombies.push({
            x: Math.random() * (canvas.width - size) + size/2,
            y: spawnY,
            width: size,
            height: size,
            speed: speed,
            hp: hp,
            maxHp: hp,
            isGiant: isGiant,
            animOffset: Math.floor(Math.random() * 100)
        });
    }
}

function killZombie(index, z) {
    zombies.splice(index, 1);
    score += z.isGiant ? 300 * wave : 100 * wave;
    SFX.kill();
    
    // Balanced Drop Rate (4.5% general, 15% giants to keep the screen clean and zero-lag!)
    if(Math.random() < 0.045 || (z.isGiant && Math.random() < 0.15)) { 
        let laserChance = Math.max(0.015, 0.18 - wave * 0.03);
        let roll = Math.random();
        
        let type = 'coin';
        let color = '#f1c40f';
        
        if (roll < laserChance) {
            type = 'laser';
            color = '#ff4757';
        } else if (roll < laserChance + 0.30) { 
            type = 'bullet';
            color = '#00ffff'; 
        } else if (roll < laserChance + 0.60) {
            type = 'power';
            color = '#ff00ff'; 
        }
        
        items.push({
            x: z.x, y: z.y,
            radius: z.isGiant ? 22 : 16,
            speed: 2.5,
            color: color,
            type: type
        });
    }
    
    // EXTRA CRISIS LIFESAVER DROP (Added safely on top, with tight triggers!)
    let closeZombies = zombies.filter(itemZ => itemZ.y > player.y - 180).length;
    if (!window.lastPityDrop) window.lastPityDrop = 0;
    
    let isCrisis = closeZombies >= 3 && !isLaserActive && (frames - window.lastPityDrop > 300);
    if (isCrisis) {
        window.lastPityDrop = frames;
        items.push({
            x: z.x + (Math.random() - 0.5) * 30,
            y: z.y,
            radius: 16,
            speed: 2.5,
            color: '#ff4757',
            type: 'laser'
        });
    }
    
    updateHUD();
    createParticles(z.x, z.y, '#2ed573', 3);
}

function shoot() {
    muzzleFlashActive = 3; 
    SFX.shot();
    
    // Shoot up to 5 fanning bullets max (Saves huge CPU cycles and keeps mobile buttery smooth!)
    let count = Math.min(5, player.bulletLevel);
    
    // Focused forward spread angle (Bullets stay tightly bunched in front of player!)
    let spreadAngle = 0.35; 
    
    for(let i=0; i<count; i++) {
        let angle = (i - (count-1)/2) * (spreadAngle / count); 
        
        // Locked bullet dimensions to keep them extremely sleek, sharp, and clean
        let bWidth = 4.5;
        let bHeight = 18;
        
        let bColor = '#00ffff'; // Level 1: Cyan
        if (player.bulletPower === 2) bColor = '#ff00ff'; // Level 2: Pink
        else if (player.bulletPower === 3) bColor = '#ff9f43'; // Level 3: Gold Orange
        else if (player.bulletPower >= 4) bColor = '#2ed573'; // Level 4+: Acid Lime Green
        
        bullets.push({
            x: player.x + 18,
            y: player.y - player.height/2 + 25,
            vx: Math.sin(angle) * 20,
            vy: -Math.cos(angle) * 20,
            width: bWidth,
            height: bHeight,
            damage: player.bulletPower, 
            color: bColor
        });
    }
}

function createParticles(x, y, color, count=3) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*10,
            vy: (Math.random()-0.5)*10,
            life: 1.0,
            color: color
        });
    }
    
    if (particles.length > 50) {
        particles.splice(0, particles.length - 50);
    }
}

function updateGame() {
    if(!isPlaying) return;
    
    if (imagesLoaded >= 3 && !bgPrepared) prepareBg();

    if (bgPrepared) {
        let totalH = bgCanvas.height;
        let bgY = (frames * 3) % totalH; 
        
        ctx.drawImage(bgCanvas, 0, bgY - totalH, canvas.width, totalH);
        ctx.drawImage(bgCanvas, 0, bgY, canvas.width, totalH);
        if (bgY + totalH < canvas.height) {
            ctx.drawImage(bgCanvas, 0, bgY + totalH, canvas.width, totalH);
        }
    } else {
        ctx.fillStyle = '#0d0d12';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    player.update();
    player.draw();
    
    if (isLaserActive) {
        if (frames > laserTimer) {
            isLaserActive = false;
        } else {
            let beamWidth = 14; 
            
            // Faux Layered Glow (Absolutely zero lag compared to canvas shadowBlur!)
            ctx.fillStyle = 'rgba(255, 71, 87, 0.35)';
            ctx.fillRect(player.x + 18 - beamWidth * 2, 0, beamWidth * 4, player.y - player.height/2 + 35);
            ctx.fillStyle = '#fff';
            ctx.fillRect(player.x + 18 - beamWidth / 2, 0, beamWidth, player.y - player.height/2 + 35);
            
            for(let i=zombies.length-1; i>=0; i--) {
                let z = zombies[i];
                if(Math.abs(z.x - (player.x + 18)) < z.width/2 + beamWidth/2) {
                    z.hp -= 0.25; 
                    
                    if (frames % 4 === 0) {
                        createParticles(z.x, z.y + z.height/2, '#ffa502', 1);
                    }
                    
                    if(z.hp <= 0) killZombie(i, z);
                }
            }
        }
    } else {
        if(frames % 7 === 0) shoot();
    }
    
    let spawnRate = Math.max(15, 50 - wave * 4); 
    if(frames % spawnRate === 0) spawnZombie();
    
    // Draw and update focused fanning bullets (NO shadowBlur - renders at 120 FPS!)
    for(let i=bullets.length-1; i>=0; i--) {
        let b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x - b.width/2, b.y, b.width, b.height);
        
        if(b.y < -50 || b.x < -50 || b.x > canvas.width + 50) {
            bullets.splice(i, 1);
        }
    }
    
    // Draw Items (Clean, flat vector style with high contrast and zero blurs)
    for(let i=items.length-1; i>=0; i--) {
        let item = items[i];
        item.y += item.speed;
        
        ctx.save();
        
        if (item.type === 'laser') {
            let w = item.radius * 1.6;
            let h = item.radius * 1.7; 
            
            ctx.fillStyle = 'rgba(255, 71, 87, 0.25)';
            ctx.fillRect(item.x - w/2 - 4, item.y - h/2 - 4, w + 8, h + 8);
            
            ctx.strokeStyle = '#ff4757';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(item.x - w/2, item.y - h/2, w, h);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(item.x - w/4, item.y - h/2 - 3, w/2, 3);
            
            let chargeBlocks = 3;
            let pad = 2.5;
            let bh = (h - (chargeBlocks + 1) * pad) / chargeBlocks;
            ctx.fillStyle = (frames % 10 < 5) ? '#ff4757' : '#ffa502';
            for (let b = 0; b < chargeBlocks; b++) {
                ctx.fillRect(item.x - w/2 + pad, item.y - h/2 + pad + b * (bh + pad), w - pad * 2, bh);
            }
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚡', item.x, item.y);
            
        } else if (item.type === 'bullet') {
            let w = item.radius * 1.6;
            let h = item.radius * 1.7;
            
            ctx.fillStyle = 'rgba(0, 255, 255, 0.25)';
            ctx.fillRect(item.x - w/2 - 4, item.y - h/2 - 4, w + 8, h + 8);
            
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(item.x - w/2, item.y - h/2, w, h);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(item.x - w/4, item.y - h/2 - 3, w/2, 3);
            
            ctx.fillStyle = '#00ffff';
            ctx.fillRect(item.x - 6, item.y - 4, 3, 10);
            ctx.fillRect(item.x, item.y - 6, 3, 12);
            ctx.fillRect(item.x + 6, item.y - 4, 3, 10);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', item.x, item.y + 1);
            
        } else if (item.type === 'power') {
            let w = item.radius * 1.6;
            let h = item.radius * 1.7;
            
            ctx.fillStyle = 'rgba(255, 0, 255, 0.25)';
            ctx.fillRect(item.x - w/2 - 4, item.y - h/2 - 4, w + 8, h + 8);
            
            ctx.strokeStyle = '#ff00ff';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(item.x - w/2, item.y - h/2, w, h);
            
            ctx.fillStyle = '#fff';
            ctx.fillRect(item.x - w/4, item.y - h/2 - 3, w/2, 3);
            
            ctx.fillStyle = '#ff00ff';
            ctx.beginPath();
            ctx.moveTo(item.x, item.y - 7);
            ctx.lineTo(item.x - 6, item.y + 2);
            ctx.lineTo(item.x - 2, item.y + 2);
            ctx.lineTo(item.x - 2, item.y + 7);
            ctx.lineTo(item.x + 2, item.y + 7);
            ctx.lineTo(item.x + 2, item.y + 2);
            ctx.lineTo(item.x + 6, item.y + 2);
            ctx.closePath();
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('UP', item.x, item.y + 4);
            
        } else {
            // Draw clean gold coin without complex inner blurs
            ctx.fillStyle = '#d35400';
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius - 2.5, 0, Math.PI*2);
            ctx.fill();
            
            ctx.strokeStyle = '#f39c12';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(item.x, item.y, item.radius * 0.55, 0, Math.PI*2);
            ctx.stroke();
            
            ctx.fillStyle = '#d35400';
            ctx.font = 'bold 13px "Segoe UI",sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', item.x, item.y);
        }
        ctx.restore();
        
        let dx = item.x - player.x;
        let dy = item.y - player.y;
        if(Math.sqrt(dx*dx + dy*dy) < (item.radius + player.width/2 - 40)) {
            items.splice(i, 1);
            SFX.item();
            
            if(item.type === 'laser') {
                isLaserActive = true;
                laserTimer = frames + 180;
            } else if (item.type === 'bullet') {
                player.bulletLevel = Math.min(5, player.bulletLevel + 1); // Capped at 5!
            } else if (item.type === 'power') {
                player.bulletPower = Math.min(5, player.bulletPower + 1); 
            } else {
                score += 50;
            }
            
            updateHUD();
            createParticles(player.x, player.y, item.color, 4);
            continue;
        }
        
        if(item.y > canvas.height + 50) items.splice(i, 1);
    }
    
    // Draw zombies
    for(let i=zombies.length-1; i>=0; i--) {
        let z = zombies[i];
        z.y += z.speed;
        
        if (imagesLoaded >= 3) {
            let bob = Math.abs(Math.sin((frames + z.animOffset) * 0.2)) * (z.isGiant ? 8 : 15);
            let tilt = Math.sin((frames + z.animOffset) * 0.1) * 0.1;
            
            ctx.save();
            ctx.translate(z.x, z.y - bob);
            ctx.rotate(tilt);
            
            ctx.drawImage(zombieImg, -z.width/2, -z.height/2, z.width, z.height);
            ctx.restore();
        } else {
            ctx.fillStyle = z.isGiant ? '#218c53' : '#2ed573';
            ctx.fillRect(z.x - z.width/2, z.y - z.height/2, z.width, z.height);
        }
        
        if(z.hp < z.maxHp) {
            let bw = z.isGiant ? 120 : 60;
            let bh = z.isGiant ? 10 : 6;
            ctx.fillStyle = 'red';
            ctx.fillRect(z.x - bw/2, z.y - z.height/2 - 20, bw, bh);
            ctx.fillStyle = '#2ed573';
            ctx.fillRect(z.x - bw/2, z.y - z.height/2 - 20, bw * (z.hp/z.maxHp), bh);
        }
        
        let dx = z.x - player.x;
        let dy = z.y - player.y;
        if(Math.sqrt(dx*dx + dy*dy) < (z.width/2 + player.width/2 - 40)) {
            zombies.splice(i, 1);
            health -= z.isGiant ? 2 : 1;
            SFX.hit();
            updateHUD();
            createParticles(player.x, player.y, 'red', 4);
            if(health <= 0) gameOver();
            continue;
        }
        
        for(let j=bullets.length-1; j>=0; j--) {
            let b = bullets[j];
            if(Math.abs(z.x - b.x) < z.width/2 && Math.abs(z.y - b.y) < z.height/2) {
                z.hp -= b.damage; 
                bullets.splice(j, 1);
                SFX.hit();
                createParticles(b.x, b.y, b.color, 1); 
                if(z.hp <= 0) {
                    killZombie(i, z);
                    break;
                }
            }
        }
        
        if(z.y > canvas.height + 150) {
            zombies.splice(i, 1);
            health -= z.isGiant ? 2 : 1;
            updateHUD();
            if(health <= 0) gameOver();
        }
    }
    
    for(let i=particles.length-1; i>=0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if(p.life <= 0) {
            particles.splice(i, 1);
        } else {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
    }
    
    if(frames > 0 && frames % 500 === 0) {
        wave++;
        updateHUD();
    }
    
    frames++;
    if(isPlaying) gameLoopId = requestAnimationFrame(updateGame);
}

function updateHUD() {
    scoreVal.innerText = score.toLocaleString();
    waveVal.innerText = wave;
    let hStr = '';
    for(let i=0; i<Math.max(0, health); i++) hStr += '❤️';
    healthVal.innerText = hStr;
}

function startGame() {
    try {
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        
        score = 0;
        wave = 1;
        health = 5; 
        frames = 0;
        bullets = [];
        zombies = [];
        particles = [];
        items = [];
        isLaserActive = false;
        laserTimer = 0;
        player.bulletLevel = 1; 
        player.bulletPower = 1; 
        
        player.x = canvas.width / 2;
        player.targetX = player.x;
        updateHUD();
        
        isPlaying = true;
        SFX.startBGM(); 
        updateGame();
    } catch(e) {
        alert("Error: " + e.message);
    }
}

function gameOver() {
    isPlaying = false;
    cancelAnimationFrame(gameLoopId);
    gameOverScreen.classList.remove('hidden');
    document.getElementById('restart-btn').className = "btn-modern pulse";
    finalScore.innerText = score.toLocaleString();
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function getX(e) {
    let rect = canvas.getBoundingClientRect();
    if(e.touches && e.touches.length > 0) {
        return e.touches[0].clientX - rect.left;
    }
    return e.clientX - rect.left;
}

// On PC: Just hover to move the player character left and right! (No clicking or dragging required)
canvas.addEventListener('mousemove', (e) => { 
    player.targetX = getX(e); 
});

// On Mobile: Drag or tap with finger to slide the character smoothly
canvas.addEventListener('touchstart', (e) => { 
    player.targetX = getX(e); 
}, {passive: true});

canvas.addEventListener('touchmove', (e) => { 
    player.targetX = getX(e); 
}, {passive: true});
