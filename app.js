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

const playerImg = new Image(); playerImg.src = 'assets/player1.png';
const zombieImg = new Image(); zombieImg.src = 'assets/zombie1.png';
const bgImg = new Image(); bgImg.src = 'assets/bg.png';

let imagesLoaded = 0;
playerImg.onload = () => imagesLoaded++;
zombieImg.onload = () => imagesLoaded++;
bgImg.onload = () => imagesLoaded++;

let bgCanvas = document.createElement('canvas');
let bgCtx = bgCanvas.getContext('2d');
let bgPrepared = false;

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    bgPrepared = false; // Re-prepare background on resize
}
window.addEventListener('resize', resize);
resize();

function prepareBg() {
    if (!bgImg.width) return;
    let w = canvas.width;
    let h = canvas.width * (bgImg.height / bgImg.width);
    bgCanvas.width = w;
    bgCanvas.height = h * 2; 
    
    // Normal
    bgCtx.drawImage(bgImg, 0, 0, w, h);
    // Mirrored vertically
    bgCtx.save();
    bgCtx.translate(0, h * 2);
    bgCtx.scale(1, -1);
    bgCtx.drawImage(bgImg, 0, 0, w, h);
    bgCtx.restore();
    
    bgPrepared = true;
}

const player = {
    x: canvas.width / 2,
    y: canvas.height - 150,
    width: 170,
    height: 170,
    targetX: canvas.width / 2,
    
    draw() {
        if (imagesLoaded >= 3) {
            let bob = Math.sin(frames * 0.3) * 5;
            let tilt = Math.sin(frames * 0.15) * 0.05;
            ctx.save();
            ctx.translate(this.x, this.y + bob);
            ctx.rotate(tilt);
            ctx.drawImage(playerImg, -this.width/2, -this.height/2, this.width, this.height);
            ctx.restore();
        } else {
            ctx.fillStyle = '#1e90ff';
            ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        }
    },
    update() {
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
        let isGiant = Math.random() < 0.15;
        let size = isGiant ? 260 : 150;
        let hp = isGiant ? (12 + wave * 5) : (3 + Math.floor(wave / 2));
        let speed = isGiant ? (0.2 + wave * 0.02) : (0.4 + Math.random() * 0.3 + wave * 0.04);
        
        zombies.push({
            x: Math.random() * (canvas.width - size) + size/2,
            y: -150 - Math.random() * 80,
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
    
    // Significantly reduced item drop rate
    if(Math.random() < 0.05 || (z.isGiant && Math.random() < 0.3)) { 
        let type = (Math.random() < 0.15) ? 'laser' : 'coin'; 
        items.push({
            x: z.x, y: z.y,
            radius: z.isGiant ? 22 : 16,
            speed: 2.5,
            color: type === 'laser' ? '#ff4757' : '#f1c40f',
            type: type
        });
    }
    
    updateHUD();
    createParticles(z.x, z.y, '#2ed573');
}

function shoot() {
    let count = Math.min(7, 1 + Math.floor(wave / 3));
    for(let i=0; i<count; i++) {
        let offsetX = (i - (count-1)/2) * 15;
        bullets.push({
            x: player.x + offsetX,
            y: player.y - player.height/2 + 20,
            width: 5,
            height: 25,
            speed: 20,
            color: '#00d2d3'
        });
    }
}

function createParticles(x, y, color) {
    for(let i=0; i<15; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random()-0.5)*12,
            vy: (Math.random()-0.5)*12,
            life: 1.0,
            color: color
        });
    }
}

function updateGame() {
    if(!isPlaying) return;
    
    if (imagesLoaded >= 3 && !bgPrepared) prepareBg();

    if (bgPrepared) {
        let totalH = bgCanvas.height;
        let bgY = (frames * 3) % totalH; // Scrolling speed
        
        ctx.drawImage(bgCanvas, 0, bgY - totalH, canvas.width, totalH);
        ctx.drawImage(bgCanvas, 0, bgY, canvas.width, totalH);
        if (bgY + totalH < canvas.height) {
            ctx.drawImage(bgCanvas, 0, bgY + totalH, canvas.width, totalH);
        }
    } else {
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    player.update();
    player.draw();
    
    if (isLaserActive) {
        if (frames > laserTimer) {
            isLaserActive = false;
        } else {
            ctx.fillStyle = (frames % 4 < 2) ? '#ff4757' : '#ffa502';
            ctx.shadowBlur = 30;
            ctx.shadowColor = '#ff4757';
            ctx.fillRect(player.x - 40, 0, 80, player.y - player.height/2 + 30);
            ctx.shadowBlur = 0;
            
            for(let i=zombies.length-1; i>=0; i--) {
                let z = zombies[i];
                if(Math.abs(z.x - player.x) < z.width/2 + 40) {
                    z.hp -= 2; 
                    createParticles(z.x, z.y + z.height/2, '#ffa502');
                    if(z.hp <= 0) killZombie(i, z);
                }
            }
        }
    } else {
        if(frames % 7 === 0) shoot();
    }
    
    let spawnRate = Math.max(15, 50 - wave * 4); 
    if(frames % spawnRate === 0) spawnZombie();
    
    for(let i=bullets.length-1; i>=0; i--) {
        let b = bullets[i];
        b.y -= b.speed;
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = b.color;
        ctx.fillRect(b.x - b.width/2, b.y, b.width, b.height);
        ctx.shadowBlur = 0;
        if(b.y < -50) bullets.splice(i, 1);
    }
    
    for(let i=items.length-1; i>=0; i--) {
        let item = items[i];
        item.y += item.speed;
        
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(item.x, item.y, item.radius, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        
        if (item.type === 'laser') {
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('L', item.x, item.y);
        } else {
            ctx.beginPath();
            ctx.arc(item.x-4, item.y-4, item.radius*0.3, 0, Math.PI*2);
            ctx.fill();
        }
        
        let dx = item.x - player.x;
        let dy = item.y - player.y;
        if(Math.sqrt(dx*dx + dy*dy) < (item.radius + player.width/2 - 40)) {
            items.splice(i, 1);
            if(item.type === 'laser') {
                isLaserActive = true;
                laserTimer = frames + 180;
            } else {
                score += 50;
            }
            updateHUD();
            createParticles(player.x, player.y, item.color);
            continue;
        }
        
        if(item.y > canvas.height + 50) items.splice(i, 1);
    }
    
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
            updateHUD();
            createParticles(player.x, player.y, 'red');
            if(health <= 0) gameOver();
            continue;
        }
        
        for(let j=bullets.length-1; j>=0; j--) {
            let b = bullets[j];
            if(Math.abs(z.x - b.x) < z.width/2 && Math.abs(z.y - b.y) < z.height/2) {
                z.hp--;
                bullets.splice(j, 1);
                createParticles(b.x, b.y, '#f1c40f');
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
    scoreVal.innerText = score;
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
        
        player.x = canvas.width / 2;
        player.targetX = player.x;
        updateHUD();
        
        isPlaying = true;
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
    finalScore.innerText = score;
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

let isDragging = false;

function getX(e) {
    let rect = canvas.getBoundingClientRect();
    if(e.touches && e.touches.length > 0) {
        return e.touches[0].clientX - rect.left;
    }
    return e.clientX - rect.left;
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; player.targetX = getX(e); });
canvas.addEventListener('mousemove', (e) => { if(isDragging) player.targetX = getX(e); });
canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('touchstart', (e) => { isDragging = true; player.targetX = getX(e); }, {passive: true});
canvas.addEventListener('touchmove', (e) => { if(isDragging) player.targetX = getX(e); }, {passive: true});
canvas.addEventListener('touchend', () => isDragging = false);
