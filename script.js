// Telegram Mini App - Chicken Huiken
"use strict";

// ======================
// Global State Management
// ======================
const state = {
    activeTab: 'game',
    runScore: 0,
    totalCoins: 0,
    lastDailyClaimAt: null,
    tgUser: null,
    initData: null,
    isGameActive: false,
    gameOver: false
};

// Three.js global variables
let scene, camera, renderer;
let clock = new THREE.Clock(), deltaTime;
const cellWidth = 2, columns = 21;
let laneTypes = ['car', 'car', 'car', 'forest', 'forest', 'forest', 'truck', 'truck', 'river', 'river', 'rail'];
let laneSpeeds, logSpeeds;
let cameraOffsetX, cameraOffsetZ;
let chicken;
let lanes;
let gameSounds;

// API Configuration
const API_BASE = window.location.origin;

// ======================
// Telegram WebApp Init
// ======================
function initTelegram() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        tg.ready();
        tg.expand();
        
        // Set theme colors
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#2481cc');
        document.documentElement.style.setProperty('--tg-theme-button-text-color', tg.themeParams.button_text_color || '#ffffff');
        
        state.initData = tg.initData;
        state.tgUser = tg.initDataUnsafe.user;
        
        return true;
    } else {
        console.warn('Telegram WebApp not available - using mock data for testing');
        state.initData = 'mock_init_data';
        state.tgUser = { id: 123456789, first_name: 'Test User' };
        return false;
    }
}

// ======================
// API Functions
// ======================
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        showToast(`Error: ${error.message}`);
        throw error;
    }
}

async function authenticateUser() {
    try {
        const data = await apiCall('/api/auth/telegram', {
            method: 'POST',
            body: JSON.stringify({ initData: state.initData })
        });
        
        if (data.ok && data.user) {
            state.totalCoins = data.user.totalCoins;
            state.lastDailyClaimAt = data.user.lastDailyClaimAt;
            updateCoinDisplay();
            updateProfileDisplay();
            updateDailyBonusUI();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Authentication failed:', error);
        return false;
    }
}

async function claimDailyBonus() {
    try {
        const data = await apiCall('/api/bonus/claim', {
            method: 'POST',
            body: JSON.stringify({ initData: state.initData })
        });
        
        if (data.ok) {
            state.totalCoins = data.totalCoins;
            state.lastDailyClaimAt = Date.now();
            updateCoinDisplay();
            updateProfileDisplay();
            updateDailyBonusUI();
            showToast('Daily bonus claimed! +50 coins');
            return true;
        } else {
            updateDailyBonusUI();
            return false;
        }
    } catch (error) {
        console.error('Bonus claim failed:', error);
        return false;
    }
}

async function completeGameSession(points) {
    try {
        const data = await apiCall('/api/sessions/complete', {
            method: 'POST',
            body: JSON.stringify({
                initData: state.initData,
                runPoints: points
            })
        });
        
        if (data.ok) {
            state.totalCoins = data.totalCoins;
            updateCoinDisplay();
            updateProfileDisplay();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Session complete failed:', error);
        return false;
    }
}

// ======================
// UI Functions
// ======================
function initUI() {
    // Tab navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchTab(tab);
        });
    });
    
    // Play button
    document.getElementById('play-button').addEventListener('click', startGame);
    
    // Restart button
    document.getElementById('restart-button').addEventListener('click', restartGame);
    
    // Claim bonus button
    document.getElementById('claim-button').addEventListener('click', handleClaimBonus);
    
    // Share button
    document.getElementById('share-button').addEventListener('click', handleShare);
    
    // Update UI with user data
    if (state.tgUser) {
        document.getElementById('profile-id').textContent = state.tgUser.id;
    }
}

function switchTab(tabName) {
    state.activeTab = tabName;
    
    // Update tab content visibility
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.tab === tabName) {
            item.classList.add('active');
        }
    });
}

function updateCoinDisplay() {
    document.getElementById('coin-count').textContent = state.totalCoins;
}

function updateProfileDisplay() {
    document.getElementById('profile-coins').textContent = `${state.totalCoins} 🪙`;
}

function updateDailyBonusUI() {
    const claimButton = document.getElementById('claim-button');
    const bonusTimer = document.getElementById('bonus-timer');
    
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    
    if (state.lastDailyClaimAt) {
        const timeSinceClaim = now - state.lastDailyClaimAt;
        if (timeSinceClaim < dayInMs) {
            const nextClaimTime = state.lastDailyClaimAt + dayInMs;
            claimButton.disabled = true;
            claimButton.classList.add('claimed');
            claimButton.textContent = 'Claimed';
            
            // Update timer
            updateBonusTimer(nextClaimTime);
            return;
        }
    }
    
    claimButton.disabled = false;
    claimButton.classList.remove('claimed');
    claimButton.textContent = 'Claim';
    bonusTimer.textContent = 'Ready to claim!';
}

function updateBonusTimer(nextClaimTime) {
    const bonusTimer = document.getElementById('bonus-timer');
    
    const updateTimer = () => {
        const now = Date.now();
        const diff = nextClaimTime - now;
        
        if (diff <= 0) {
            bonusTimer.textContent = 'Ready to claim!';
            updateDailyBonusUI();
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        bonusTimer.textContent = `Next claim in: ${hours}h ${minutes}m ${seconds}s`;
        setTimeout(updateTimer, 1000);
    };
    
    updateTimer();
}

async function handleClaimBonus() {
    await claimDailyBonus();
}

function handleShare() {
    const shareUrl = window.location.href;
    const shareText = `Check out my profile! I have ${state.totalCoins} coins in Chicken Huiken!`;
    
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        const encodedUrl = encodeURIComponent(shareUrl);
        const encodedText = encodeURIComponent(shareText);
        const telegramShareUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`;
        
        if (tg.openTelegramLink) {
            tg.openTelegramLink(telegramShareUrl);
        } else {
            window.open(telegramShareUrl, '_blank');
        }
    } else {
        // Fallback
        const encodedUrl = encodeURIComponent(shareUrl);
        const encodedText = encodeURIComponent(shareText);
        window.open(`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`, '_blank');
    }
}

function showToast(message) {
    // Simple toast notification
    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.showAlert(message);
    } else {
        alert(message);
    }
}


// ======================
// Game Initialization
// ======================
function initGame() {
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(5, 15, 18);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    cameraOffsetX = camera.position.x;
    cameraOffsetZ = camera.position.z;
    
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const container = document.getElementById('game-canvas-container');
    const containerRect = container.getBoundingClientRect();
    renderer.setSize(containerRect.width, containerRect.height);
    container.appendChild(renderer.domElement);
    
    window.addEventListener('resize', onPageResize, false);
    
    update();
    gameSounds = new Sound(camera);
}

function startGame() {
    document.getElementById('game-splash').style.display = 'none';
    document.getElementById('restart-button').classList.add('hidden');
    
    scene = new THREE.Scene();
    
    state.gameOver = false;
    state.runScore = 0;
    state.isGameActive = true;
    
    laneSpeeds = [3, 4, 5];
    logSpeeds = [2, 2.5, 3];
    
    camera.position.set(5, 15, 18);
    camera.lookAt(new THREE.Vector3(0, 0, 0));
    cameraOffsetX = camera.position.x;
    cameraOffsetZ = camera.position.z;
    
    addLight();
    chicken = new Chicken();
    scene.add(chicken.model);
    
    lanes = [-9,-8,-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7,8,9].map(index => {
        const lane = new Lane(index);
        lane.mesh.position.z = -index * cellWidth;
        scene.add(lane.mesh);
        return lane;
    }).filter(lane => lane.index >= 0);
    
    if (gameSounds && gameSounds.themeSong) {
        gameSounds.themeSong.setVolume(0.15);
    }
}

function restartGame() {
    startGame();
}

async function endGame() {
    if (state.gameOver) return;
    
    state.gameOver = true;
    state.isGameActive = false;
    
    document.getElementById('restart-button').classList.remove('hidden');
    
    // Save session to backend
    if (state.runScore > 0) {
        await completeGameSession(state.runScore);
        showToast(`Game Over! You earned ${state.runScore} coins!`);
    }
    
    state.runScore = 0;
}

function addLight() {
    let light = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(light);
    
    let hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 0.4);
    scene.add(hemisphere);
    
    let sunlight = new THREE.DirectionalLight(0xffffff, 0.6);
    sunlight.position.set(0, 100, 0);
    sunlight.castShadow = true;
    sunlight.shadow.camera.near = 50;
    sunlight.shadow.camera.far = 120;
    sunlight.shadow.camera.top = 200 * cellWidth;
    sunlight.shadow.camera.bottom = -columns/2 * cellWidth;
    sunlight.shadow.camera.left = -columns/2 * cellWidth;
    sunlight.shadow.camera.right = columns/2 * cellWidth;
    scene.add(sunlight);
}

function onPageResize() {
    const container = document.getElementById('game-canvas-container');
    const containerRect = container.getBoundingClientRect();
    camera.aspect = containerRect.width / containerRect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(containerRect.width, containerRect.height);
}

function render() {
    if (scene && camera) {
        renderer.render(scene, camera);
    }
}

// ======================
// Chicken Class
// ======================
class Chicken {
    constructor(size = {x: 0.63, y: 0.6, z: 0.63}) {
        this.model = new THREE.Group();
        this.currentLane = 0;
        this.maxLane = 0;
        this.currentColumn = Math.floor(columns/2);
        this.isMoving = false;
        this.feathers = new Feathers();
        this.splashes = new Splash();
        
        let red = new THREE.MeshLambertMaterial({color: 0xdc5a5a}),
            white = new THREE.MeshLambertMaterial({color: 0xffffff}),
            orange = new THREE.MeshLambertMaterial({color: 0xda6400}),
            black = new THREE.MeshLambertMaterial({color: 0x000000});
        
        let foot1 = new THREE.BoxBufferGeometry(0.1, 0.1, 0.6),
            foot2 = new THREE.BoxBufferGeometry(0.1, 0.1, 0.3),
            foot3 = new THREE.BoxBufferGeometry(0.1, 0.1, 0.6),
            foot4 = new THREE.BoxBufferGeometry(0.1, 0.5, 0.1),
            upperBeak = new THREE.BoxBufferGeometry(0.2, 0.2, 0.3);
        foot1.applyMatrix(new THREE.Matrix4().makeTranslation(0.1, foot1.parameters.height/2, 0.15));
        foot2.applyMatrix(new THREE.Matrix4().makeTranslation(0, foot2.parameters.height/2, 0));
        foot3.applyMatrix(new THREE.Matrix4().makeTranslation(-0.1, foot3.parameters.height/2, 0.15));
        foot4.applyMatrix(new THREE.Matrix4().makeTranslation(0, foot4.parameters.height/2, 0));
        upperBeak.applyMatrix(new THREE.Matrix4().makeTranslation(0, 1.5, upperBeak.parameters.depth/2 + 0.6));
        let leftFoot = THREE.BufferGeometryUtils.mergeBufferGeometries([foot1, foot2, foot3, foot4]), rightFoot = leftFoot.clone();
        leftFoot.applyMatrix(new THREE.Matrix4().makeTranslation(0.2, 0, 0));
        rightFoot.applyMatrix(new THREE.Matrix4().makeTranslation(-0.2, 0, 0));
        let feet = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([leftFoot, rightFoot, upperBeak]), orange);
        feet.castShadow = true;
        feet.receiveShadow = true;
        this.model.add(feet);
        
        let lowerBody = new THREE.BoxBufferGeometry(0.69, 0.6, 1.2),
            upperBody = new THREE.BoxBufferGeometry(0.69, 0.675, 0.8),
            leftWing = new THREE.BoxBufferGeometry(0.15, 0.4, 0.8),
            rightWing = new THREE.BoxBufferGeometry(0.15, 0.4, 0.8),
            tail = new THREE.BoxBufferGeometry(0.5, 0.4, 0.1);
        lowerBody.applyMatrix(new THREE.Matrix4().makeTranslation(0, lowerBody.parameters.height/2 + 0.5, 0));
        upperBody.applyMatrix(new THREE.Matrix4().makeTranslation(0, upperBody.parameters.height/2 + 1.1, 0.2));
        leftWing.applyMatrix(new THREE.Matrix4().makeTranslation(leftWing.parameters.width/2 + lowerBody.parameters.width/2, leftWing.parameters.height/2 + 0.6, 0));
        rightWing.applyMatrix(new THREE.Matrix4().makeTranslation(-rightWing.parameters.width/2 - lowerBody.parameters.width/2, rightWing.parameters.height/2 + 0.6, 0));
        tail.applyMatrix(new THREE.Matrix4().makeTranslation(0, lowerBody.parameters.height/2 + 0.5, -tail.parameters.depth/2 - 0.6));
        let body = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([lowerBody, upperBody, leftWing, rightWing, tail]), white);
        body.castShadow = true;
        body.receiveShadow = true;
        this.model.add(body);
        
        let eyeGeo = new THREE.BoxBufferGeometry(0.72, 0.12, 0.12);
        eyeGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 1.55, 0.32));
        let eyes = new THREE.Mesh(eyeGeo, black);
        eyes.castShadow = true;
        eyes.receiveShadow = true;
        this.model.add(eyes);
        
        let lowerBeak = new THREE.BoxBufferGeometry(0.2, 0.2, 0.2),
            comb = new THREE.BoxBufferGeometry(0.2, 0.15, 0.5);
        lowerBeak.applyMatrix(new THREE.Matrix4().makeTranslation(0, 1.3, lowerBeak.parameters.depth/2 + 0.6));
        comb.applyMatrix(new THREE.Matrix4().makeTranslation(0, comb.parameters.height/2 + 1.775, 0.2));
        let lowerBeakAndComb = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([lowerBeak, comb]), red);
        lowerBeakAndComb.castShadow = true;
        lowerBeakAndComb.receiveShadow = true;
        this.model.add(lowerBeakAndComb);
        
        this.model.scale.set(size.x, size.y, size.z);
        this.model.rotation.y += Math.PI;
        if (columns%2 == 0)
            this.model.position.x += cellWidth/2;
        
        let maxHeight = 1.2, minHeight = 0.8, duration = 1.2;
        let sizeKeyframes = new THREE.VectorKeyframeTrack('.scale', [0, duration/4, duration/2, duration * 3/4, duration], [this.model.scale.x, this.model.scale.y * (maxHeight + minHeight)/2, this.model.scale.z, this.model.scale.x, this.model.scale.y * maxHeight, this.model.scale.z, this.model.scale.x, this.model.scale.y * (maxHeight + minHeight)/2, this.model.scale.z, this.model.scale.x, this.model.scale.y * minHeight, this.model.scale.z, this.model.scale.x, this.model.scale.y * (maxHeight + minHeight)/2, this.model.scale.z]);
        let clip = new THREE.AnimationClip('idle', duration, [sizeKeyframes]);
        this.sizeAnimation = {
            mixer: new THREE.AnimationMixer(this.model),
            clock: new THREE.Clock()
        };
        let anim = this.sizeAnimation.mixer.clipAction(clip);
        anim.setLoop(THREE.LoopRepeat);
        anim.play();
    }
    
    getLane() {
        return -Math.round(this.model.position.z/cellWidth);
    }
    
    jump(direction) {
        if (!this.isMoving && !state.gameOver) {
            let duration = 0.4;
            let dX = 0, dY = 1, dZ = 0;
            let currentX = -columns/2 * cellWidth + cellWidth/2 + this.currentColumn * cellWidth;
            let currentZ = -this.currentLane * cellWidth;
            
            // Track if this is a forward move for scoring
            let isForwardMove = false;
            
            switch (direction) {
                case 'left':
                    if (this.currentColumn <=0)
                        return;
                    if(lanes[this.currentLane].type == 'forest' && lanes[this.currentLane].occupiedPositions.has(this.currentColumn - 1))
                        return;
                    this.currentColumn--;
                    dX = -cellWidth;
                    this.model.rotation.y = THREE.Math.degToRad(-90);
                    break;
                case 'up':
                    if(lanes[this.currentLane + 1].type == 'forest' && lanes[this.currentLane + 1].occupiedPositions.has(this.currentColumn))
                        return;
                    this.currentLane++;
                    dZ = -cellWidth;
                    this.model.rotation.y = THREE.Math.degToRad(180);
                    isForwardMove = true; // FORWARD MOVEMENT!
                    break;
                case 'right':
                    if (this.currentColumn >=columns-1)
                        return;
                    if(lanes[this.currentLane].type == 'forest' && lanes[this.currentLane].occupiedPositions.has(this.currentColumn + 1))
                        return;
                    this.currentColumn++;
                    dX = cellWidth;
                    this.model.rotation.y = THREE.Math.degToRad(90);
                    break;
                case 'down':
                    if (this.currentLane <= 0)
                        return;
                    if(lanes[this.currentLane - 1].type == 'forest' && lanes[this.currentLane - 1].occupiedPositions.has(this.currentColumn))
                        return;
                    this.currentLane--;
                    dZ = cellWidth;
                    this.model.rotation.y = THREE.Math.degToRad(0);
                    break;
            }
            
            if(this.currentLane > this.maxLane){
                this.maxLane = this.currentLane;
                laneSpeeds[0] += 1.5/100;
                laneSpeeds[1] += 2/100;
                laneSpeeds[2] += 2.5/100;
                let lane = new Lane(lanes.length);
                lane.mesh.position.z = -lane.index * cellWidth;
                lanes.push(lane);
                scene.add(lane.mesh);
                
                // ONLY increment score on forward movement
                if (isForwardMove) {
                    state.runScore++;
                    // Update coin display with run score + total coins
                    document.getElementById('coin-count').textContent = state.totalCoins + state.runScore;
                }
            }
            
            let finalX = currentX + dX;
            let finalZ = currentZ + dZ;
            let midwayX = (this.model.position.x + finalX)/2;
            let midwayZ = (this.model.position.z + finalZ)/2;
            let jumpKeyframes  = new THREE.VectorKeyframeTrack('.position', [0, duration/2, duration], [this.model.position.x, this.model.position.y, this.model.position.z, midwayX, this.model.position.y + dY, midwayZ, finalX, this.model.position.y, finalZ]);
            let clip = new THREE.AnimationClip('jump', duration, [jumpKeyframes]);
            this.jumpAnimation = {
                mixer: new THREE.AnimationMixer(this.model),
                clock: new THREE.Clock()
            };
            let instance = this;
            this.jumpAnimation.mixer.addEventListener('finished', () =>{
                instance.isMoving = false;
            });
            let anim = this.jumpAnimation.mixer.clipAction(clip);
            anim.setLoop(THREE.LoopOnce);
            anim.clampWhenFinished = true;
            this.isMoving = true;
            anim.play();
            if (gameSounds && gameSounds.buck) {
                gameSounds.buck.play();
            }
        }
    }
    
    squish() {
        let ratio = 0.15, duration = 0.4;
        let heightKeyframes = new THREE.VectorKeyframeTrack('.scale', [0, duration], [this.model.scale.x, this.model.scale.y, this.model.scale.z, this.model.scale.x, this.model.scale.y * ratio, this.model.scale.z]);
        let clip = new THREE.AnimationClip('squish', duration, [heightKeyframes]);
        this.heightAnimation = {
            mixer: new THREE.AnimationMixer(this.model),
            clock: new THREE.Clock()
        };
        let anim = this.heightAnimation.mixer.clipAction(clip);
        anim.setLoop(THREE.LoopOnce);
        anim.clampWhenFinished = true;
        anim.play();
    }
    
    shred() {
        this.feathers.animate(this.model.position);
    }
    
    fall() {
        let depth = 3 * cellWidth/4, duration = 0.2;
        let fallKeyframes = new THREE.VectorKeyframeTrack('.position', [0, duration], [this.model.position.x, this.model.position.y, this.model.position.z, this.model.position.x, this.model.position.y - depth, this.model.position.z]);
        let clip = new THREE.AnimationClip('fall', duration, [fallKeyframes]);
        this.fallAnimation = {
            mixer: new THREE.AnimationMixer(this.model),
            clock: new THREE.Clock()
        };
        this.fallAnimation.mixer.addEventListener('finished', () =>{
            chicken.model.visible = false;
            this.splashes.animate(this.model.position);
            if (gameSounds) {
                if (gameSounds.themeSong) gameSounds.themeSong.setVolume(0);
                if (gameSounds.splash) gameSounds.splash.play();
            }
        });
        let anim = this.fallAnimation.mixer.clipAction(clip);
        anim.setLoop(THREE.LoopOnce);
        anim.clampWhenFinished = true;
        anim.play();
    }
}


// ======================
// Game Object Classes (Roads, Lawns, etc.)
// ======================
class Road {
    constructor() {
        this.model = new THREE.Group();
        let leftRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
            middleRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
            rightRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth);
        leftRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(-columns * cellWidth, -leftRoadGeo.parameters.height/2, 0));
        rightRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(columns * cellWidth, -rightRoadGeo.parameters.height/2, 0));
        middleRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, -middleRoadGeo.parameters.height/2, 0));
        let side = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([leftRoadGeo, rightRoadGeo]), new THREE.MeshPhongMaterial({color: 0x1C1E24}));
        this.model.add(side);
        let center = new THREE.Mesh(middleRoadGeo, new THREE.MeshPhongMaterial({color: 0x373A44}));
        center.receiveShadow = true;
        this.model.add(center);
        
        let markings = [];
        let offset = columns % 2? 0 : cellWidth/2;
        for(let column = 0; column < columns; column+=2){
            let left = new THREE.BoxBufferGeometry(cellWidth, cellWidth/20, cellWidth/20),
                right = new THREE.BoxBufferGeometry(cellWidth, cellWidth/20, cellWidth/20);
            left.applyMatrix(new THREE.Matrix4().makeTranslation(column * cellWidth, 0, cellWidth/2  - left.parameters.depth/2));
            right.applyMatrix(new THREE.Matrix4().makeTranslation(column * cellWidth, 0, -cellWidth/2 + right.parameters.depth/2));
            markings.push(left);
            markings.push(right);
        }
        let patternGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(markings);
        patternGeo.applyMatrix(new THREE.Matrix4().makeTranslation(cellWidth/2 - cellWidth * columns/2  + offset, 0, 0));
        let pattern = new THREE.Mesh(patternGeo, new THREE.MeshPhongMaterial({color: 0xffffff}));
        this.model.add(pattern);
        return this.model;
    }
}

class Lawn {
    constructor(allDark = false) {
        if (!allDark){
            this.model = new THREE.Group();
            let leftLawnGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
                middleLawnGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
                rightLawnGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth);
            leftLawnGeo.applyMatrix(new THREE.Matrix4().makeTranslation(-columns * cellWidth, -leftLawnGeo.parameters.height/2, 0));
            rightLawnGeo.applyMatrix(new THREE.Matrix4().makeTranslation(columns * cellWidth, -rightLawnGeo.parameters.height/2, 0));
            middleLawnGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, -middleLawnGeo.parameters.height/2, 0));
            let side = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([leftLawnGeo, rightLawnGeo]), new THREE.MeshPhongMaterial({color: 0x598800}));
            this.model.add(side);
            let center = new THREE.Mesh(middleLawnGeo, new THREE.MeshPhongMaterial({color: 0x78AE00}));
            center.receiveShadow = true;
            this.model.add(center);
        } else{
            let geometry = new THREE.BoxBufferGeometry(cellWidth * columns * 3, cellWidth, cellWidth);
            geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, -geometry.parameters.height/2, 0));
            this.model = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({color: 0x598800}));
        }
        return this.model;
    }
}

class River {
    constructor() {
        this.model = new THREE.Group();
        let leftRiverGeo = new THREE.BoxBufferGeometry(cellWidth * columns, 3 * cellWidth/4, cellWidth),
            middleRiverGeo = new THREE.BoxBufferGeometry(cellWidth * columns, 3 * cellWidth/4, cellWidth),
            rightRiverGeo = new THREE.BoxBufferGeometry(cellWidth * columns, 3 * cellWidth/4, cellWidth);
        leftRiverGeo.applyMatrix(new THREE.Matrix4().makeTranslation(-columns * cellWidth, -leftRiverGeo.parameters.height/2 - cellWidth/4, 0));
        rightRiverGeo.applyMatrix(new THREE.Matrix4().makeTranslation(columns * cellWidth, -rightRiverGeo.parameters.height/2 - cellWidth/4, 0));
        middleRiverGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, -middleRiverGeo.parameters.height/2 - cellWidth/4, 0));
        let side = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([leftRiverGeo, rightRiverGeo]), new THREE.MeshPhongMaterial({color: 0x17A7CB}));
        this.model.add(side);
        let center = new THREE.Mesh(middleRiverGeo, new THREE.MeshPhongMaterial({color: 0x46CFE1}));
        this.model.add(center);
        return this.model;
    }
}

class Rail {
    constructor() {
        this.model = new THREE.Group();
        let leftRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
            middleRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth),
            rightRoadGeo = new THREE.BoxBufferGeometry(cellWidth * columns, cellWidth, cellWidth);
        leftRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(-columns * cellWidth, -leftRoadGeo.parameters.height/2, 0));
        rightRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(columns * cellWidth, -rightRoadGeo.parameters.height/2, 0));
        middleRoadGeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, -middleRoadGeo.parameters.height/2, 0));
        let side = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([leftRoadGeo, rightRoadGeo]), new THREE.MeshPhongMaterial({color: 0x1C1E24}));
        this.model.add(side);
        let center = new THREE.Mesh(middleRoadGeo, new THREE.MeshPhongMaterial({color: 0x373A44}));
        center.receiveShadow = true;
        this.model.add(center);
        return this.model;
    }
}

// Simplified vehicle classes
class Car {
    constructor(color, size = {x: 0.95, y: 0.9, z: 0.8}) {
        this.model = new THREE.Group();
        let colors = {
            'blue': {light: 0x04bcfa, dark: 0x0189c7},
            'green': {light: 0xB9F210, dark: 0x90D700},
            'yellow': {light: 0xffbb00, dark: 0xcc8800},
            'orange': {light: 0xFA6E10, dark: 0xED5800},
            'purple': {light: 0xA359FF, dark: 0x883bEC}
        };
        let light = colors[color].light;
        let lowerBody = new THREE.Mesh(new THREE.BoxBufferGeometry(4, 0.75, 1.8), new THREE.MeshLambertMaterial({color: light}));
        lowerBody.position.set(1, 0.5625, 0);
        lowerBody.castShadow = true;
        this.model.add(lowerBody);
        this.model.scale.set(size.x, size.y, size.z);
        return this.model;
    }
}

class Truck {
    constructor(color, size = {x: 0.95, y: 1, z: 1}) {
        this.model = new THREE.Group();
        let colors = {
            'brown': {light: 0x703500},
            'teal': {light: 0x008080},
            'burgundy': {light: 0x8d021f},
            'cyan': {light: 0x009999},
            'magenta': {light: 0xcc3355},
            'beige': {light: 0xba8a5f}
        };
        let light = colors[color].light;
        let body = new THREE.Mesh(new THREE.BoxBufferGeometry(5, 2, 1.8), new THREE.MeshLambertMaterial({color: light}));
        body.position.set(2, 1.5, 0);
        body.castShadow = true;
        this.model.add(body);
        this.model.scale.set(size.x, size.y, size.z);
        return this.model;
    }
}

class ChewChewTrain {
    constructor(length, size = {x: 1, y: 1, z: 0.95}) {
        this.length = length;
        this.model = new THREE.Group();
        for(let cabin = 0; cabin < length; ++cabin){
            let body = new THREE.Mesh(new THREE.BoxBufferGeometry(7.2, 2.5, 1.8), new THREE.MeshLambertMaterial({color: 0x1365d6}));
            body.position.set(8 * cabin + 3, 1.45, 0);
            body.castShadow = true;
            this.model.add(body);
        }
        this.model.scale.set(size.x, size.y, size.z);
    }
}

class Tree {
    constructor(layers, size = {x: 0.95, y: 1, z: 0.95}) {
        this.model = new THREE.Group();
        let trunk = new THREE.Mesh(new THREE.BoxBufferGeometry(0.75, 0.45, 0.75), new THREE.MeshLambertMaterial({color: 0x91654B}));
        trunk.position.y += 0.225;
        this.model.add(trunk);
        for(let i = 0; i < layers; i++) {
            let leaves = new THREE.Mesh(new THREE.BoxBufferGeometry(1.5, 0.45, 1.5), new THREE.MeshLambertMaterial({color: 0x09A440}));
            leaves.position.y = 0.45 + i * 0.45;
            leaves.castShadow = true;
            this.model.add(leaves);
        }
        this.model.scale.set(size.x, size.y, size.z);
        return this.model;
    }
}

class Log {
    constructor(size = {x: 0.95, y: 1, z: 0.8}) {
        this.model = new THREE.Group();
        let logMesh = new THREE.Mesh(new THREE.BoxBufferGeometry(3.6, 0.25, 1.2), new THREE.MeshLambertMaterial({color: 0x8d5358}));
        logMesh.position.set(1, -0.125, 0);
        this.model.add(logMesh);
        this.model.scale.set(size.x, size.y, size.z);
        return this.model;
    }
}

class Feathers {
    constructor() {
        this.coordinates = [
            {x: 0, y: 6.3, z: 0},
            {x: 1, y: 4.725, z: 1},
            {x: 1, y: 4.725, z: -1},
            {x: -1, y: 4.725, z: 1},
            {x: -1, y: 4.725, z: -1}
        ];
        this.feathers = [];
        this.animations = [];
        this.coordinates.forEach(() =>{
            let size = 0.25 + Math.random() * 0.25;
            let geo = new THREE.PlaneBufferGeometry(size, size);
            let mat = new THREE.MeshLambertMaterial({color: 0xffffff, side: THREE.DoubleSide});
            let feather = new THREE.Mesh(geo, mat);
            feather.rotation.set(Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI);
            feather.visible = false;
            if (scene) scene.add(feather);
            this.feathers.push(feather);
            this.animations.push(undefined);
        });
    }
    
    animate(initialPos, duration = 5) {
        this.feathers.forEach((feather, index) =>{
            feather.visible = true;
            feather.position.set(initialPos.x, initialPos.y, initialPos.z);
            let finalPosition = new THREE.Vector3(initialPos.x + this.coordinates[index].x, initialPos.y + this.coordinates[index].y, initialPos.z + this.coordinates[index].z);
            let movement = new THREE.VectorKeyframeTrack('.position', [0, duration/20, duration], [feather.position.x, feather.position.y, feather.position.z, finalPosition.x, finalPosition.y, finalPosition.z, finalPosition.x, 0, finalPosition.z]);
            let clip = new THREE.AnimationClip('feathers', duration, [movement]);
            this.animations[index] = {
                mixer: new THREE.AnimationMixer(feather),
                clock: new THREE.Clock()
            };
            let anim = this.animations[index].mixer.clipAction(clip);
            anim.setLoop(THREE.LoopOnce);
            this.animations[index].mixer.addEventListener('finished', () =>{
                feather.visible = false;
            });
            anim.play();
        });
    }
}

class Splash {
    constructor() {
        this.coordinates = [
            {x: 0, y: 5, z: 0},
            {x: 1, y: 4.375, z: 1},
            {x: 1, y: 4.375, z: -1},
            {x: -1, y: 4.375, z: 1},
            {x: -1, y: 4.375, z: -1}
        ];
        this.splashes = [];
        this.animations = [];
        this.coordinates.forEach(() =>{
            let size = 0.25 + Math.random() * 0.25;
            let geo = new THREE.BoxBufferGeometry(size, size, size);
            let mat = new THREE.MeshLambertMaterial({color: 0x46CFE1});
            let splash = new THREE.Mesh(geo, mat);
            splash.visible = false;
            if (scene) scene.add(splash);
            this.splashes.push(splash);
            this.animations.push(undefined);
        });
    }
    
    animate(initialPos, duration = 1) {
        this.splashes.forEach((splash, index) =>{
            splash.visible = true;
            splash.position.set(initialPos.x, initialPos.y, initialPos.z);
            let finalPosition = new THREE.Vector3(initialPos.x + this.coordinates[index].x, initialPos.y + this.coordinates[index].y, initialPos.z + this.coordinates[index].z);
            let movement = new THREE.VectorKeyframeTrack('.position', [0, duration/4, duration], [splash.position.x, splash.position.y, splash.position.z, finalPosition.x, finalPosition.y, finalPosition.z, finalPosition.x, 0, finalPosition.z]);
            let clip = new THREE.AnimationClip('water splash', duration, [movement]);
            this.animations[index] = {
                mixer: new THREE.AnimationMixer(splash),
                clock: new THREE.Clock()
            };
            let anim = this.animations[index].mixer.clipAction(clip);
            anim.setLoop(THREE.LoopOnce);
            this.animations[index].mixer.addEventListener('finished', () =>{
                splash.visible = false;
            });
            anim.play();
        });
    }
}


// ======================
// Lane Class
// ======================
class Lane {
    constructor(index) {
        this.index = index;
        this.type = index <= 0 ? 'field' : laneTypes[Math.floor(Math.random()*laneTypes.length)];
        let offset = columns/2 * cellWidth - cellWidth/2;
        switch(this.type) {
            case 'field': {
                this.mesh = new Lawn(index < 0);
                break;
            }
            case 'forest': {
                this.mesh = new Lawn();
                this.occupiedPositions = new Set();
                this.trees = [1,2,3,4,5,6].map(() => {
                    const tree = new Tree(1 + Math.floor(Math.random() * 5));
                    let position;
                    do {
                        position = Math.floor(Math.random()*columns);
                    }while(this.occupiedPositions.has(position));
                    this.occupiedPositions.add(position);
                    tree.position.x = position*cellWidth - offset;
                    this.mesh.add(tree);
                    return tree;
                });
                break;
            }
            case 'car' : {
                this.mesh = new Road();
                this.direction = Math.random() >= 0.5;
                const occupiedPositions = new Set();
                this.vehicles = [1,2,3].map(() => {
                    const colors = ['blue', 'purple', 'yellow', 'green', 'orange'];
                    const vehicle = new Car(colors[Math.floor(Math.random()*colors.length)]);
                    let position;
                    do {
                        position = Math.floor(Math.random()*columns);
                    }while(occupiedPositions.has(position) || occupiedPositions.has(this.direction? position - 1: position + 1));
                    occupiedPositions.add(position);
                    occupiedPositions.add(this.direction? position - 1: position + 1);
                    vehicle.position.x = position*cellWidth - offset;
                    if (this.direction)
                        vehicle.rotation.y += Math.PI;
                    this.mesh.add(vehicle);
                    return vehicle;
                });
                this.speed = laneSpeeds[Math.floor(Math.random()*laneSpeeds.length)];
                break;
            }
            case 'truck' : {
                this.mesh = new Road();
                this.direction = Math.random() >= 0.5;
                const occupiedPositions = new Set();
                this.vehicles = [1,2].map(() => {
                    const colors = ['cyan', 'magenta', 'beige'];
                    const vehicle = new Truck(colors[Math.floor(Math.random()*colors.length)]);
                    let position;
                    do {
                        position = Math.floor(Math.random()*columns);
                    }while(occupiedPositions.has(position) || occupiedPositions.has(this.direction? position - 1: position + 1) || occupiedPositions.has(this.direction? position - 2: position + 2));
                    occupiedPositions.add(position);
                    occupiedPositions.add(this.direction? position - 1: position + 1);
                    occupiedPositions.add(this.direction? position - 2: position + 2);
                    vehicle.position.x = position*cellWidth - offset;
                    if (this.direction)
                        vehicle.rotation.y += Math.PI;
                    this.mesh.add(vehicle);
                    return vehicle;
                });
                this.speed = laneSpeeds[Math.floor(Math.random()*laneSpeeds.length)];
                break;
            }
            case 'river' : {
                this.mesh = new River();
                this.direction = Math.random() >= 0.5;
                if (lanes && lanes[this.index - 1] && lanes[this.index - 1].type == 'river')
                        this.direction = !(lanes[this.index - 1].direction);
                const occupiedPositions = new Set();
                this.logs = [1,2,3].map(() => {
                    const log = new Log();
                    let position;
                    do {
                        position = Math.floor(Math.random()*columns);
                    }while(occupiedPositions.has(position) || occupiedPositions.has(this.direction? position - 1: position + 1));
                    occupiedPositions.add(position);
                    occupiedPositions.add(this.direction? position - 1: position + 1);
                    log.position.x = position*cellWidth - offset;
                    if (this.direction)
                        log.rotation.y += Math.PI;
                    this.mesh.add(log);
                    return log;
                });
                this.speed = logSpeeds[Math.floor(Math.random()*logSpeeds.length)];
                break;
            }
            case 'rail' : {
                this.mesh = new Rail();
                this.direction = Math.random() >= 0.5;
                this.speed = 20 + Math.random() * 10;
                let duration = 8 + Math.random() * 7;
                let distance = this.speed * duration;
                let startPos = Math.random() * distance/2;
                let train = new ChewChewTrain(2 + Math.floor(Math.random() * 7));
                this.train = train.model;
                this.trainLength = train.length;
                if (this.direction){
                    this.train.rotation.y += Math.PI;
                    this.train.position.x = -offset - cellWidth - startPos;
                    this.initialPosition = this.train.position.x;
                    this.finalPosition = this.initialPosition + distance;
                } else{
                    this.train.position.x = offset + cellWidth + startPos;
                    this.initialPosition = this.train.position.x;
                    this.finalPosition = this.initialPosition - distance;
                }
                this.mesh.add(this.train);
                break;
            }
        }
    }
}

// ======================
// Sound System
// ======================
class Sound {
    constructor(listenerParent) {
        let listener = new THREE.AudioListener();
        listenerParent.add(listener);
        let audioLoader = new THREE.AudioLoader();
        
        this.buck = new THREE.Audio(listener);
        audioLoader.load('https://badasstechie.github.io/CrossyRoad/audio/buck.wav', buffer =>{
            this.buck.setBuffer(buffer);
            this.buck.setLoop(false);
            this.buck.setVolume(0.3);
        });
        
        this.themeSong = new THREE.Audio(listener);
        audioLoader.load('https://badasstechie.github.io/CrossyRoad/audio/katamari.mp3', buffer =>{
            this.themeSong.setBuffer(buffer);
            this.themeSong.setLoop(true);
            this.themeSong.setVolume(0.15);
            this.themeSong.play();
        });
        
        this.death = new THREE.Audio(listener);
        audioLoader.load('https://badasstechie.github.io/CrossyRoad/audio/death.wav', buffer =>{
            this.death.setBuffer(buffer);
            this.death.setLoop(false);
            this.death.setVolume(0.3);
        });
        
        this.hit = new THREE.Audio(listener);
        audioLoader.load('https://badasstechie.github.io/CrossyRoad/audio/hit.mp3', buffer =>{
            this.hit.setBuffer(buffer);
            this.hit.setLoop(false);
            this.hit.setVolume(0.3);
            this.hit.onEnded = () =>{
                this.hit.isPlaying = false;
                this.death.play();
            };
        });
        
        this.splash = new THREE.Audio(listener);
        audioLoader.load('https://badasstechie.github.io/CrossyRoad/audio/splash.mp3', buffer =>{
            this.splash.setBuffer(buffer);
            this.splash.setLoop(false);
            this.splash.setVolume(0.3);
        });
    }
}

// ======================
// Game Loop
// ======================
function update() {
    deltaTime = clock.getDelta();
    
    if(chicken && state.isGameActive){
        // Animations
        if (chicken.jumpAnimation && chicken.jumpAnimation.mixer)
            chicken.jumpAnimation.mixer.update(chicken.jumpAnimation.clock.getDelta());
        if (chicken.sizeAnimation && chicken.sizeAnimation.mixer && !state.gameOver)
            chicken.sizeAnimation.mixer.update(chicken.sizeAnimation.clock.getDelta());
        if (chicken.heightAnimation && chicken.heightAnimation.mixer)
            chicken.heightAnimation.mixer.update(chicken.heightAnimation.clock.getDelta());
        if (chicken.fallAnimation && chicken.fallAnimation.mixer)
            chicken.fallAnimation.mixer.update(chicken.fallAnimation.clock.getDelta());
        
        chicken.feathers.animations.forEach((animation) =>{
            if(animation && animation.mixer){
                animation.mixer.update(animation.clock.getDelta());
            }
        });
        chicken.splashes.animations.forEach(animation =>{
            if(animation && animation.mixer)
                animation.mixer.update(animation.clock.getDelta());
        });
        
        // Camera follows player
        camera.position.x = chicken.model.position.x + cameraOffsetX;
        camera.position.z = chicken.model.position.z + cameraOffsetZ;
    }
    
    if(lanes && chicken && state.isGameActive){
        // Move vehicles and check collisions
        lanes.filter(lane => lane.index >= chicken.getLane() - 9 && lane.index <= chicken.getLane() + 9).forEach(lane => {
            if (lane.type == 'car'){
                const leftPos = -columns/2 * cellWidth + cellWidth/2 - 2 * cellWidth;
                const rightPos = -leftPos;
                lane.vehicles.forEach(car => {
                    if(lane.direction) {
                        car.position.x = car.position.x > rightPos? leftPos : car.position.x + lane.speed * deltaTime;
                    }else{
                        car.position.x = car.position.x < leftPos? rightPos : car.position.x - lane.speed * deltaTime;
                    }
                    const carLeftEdge = car.position.x + (lane.direction? (-cellWidth * 1.5) : (-cellWidth * 0.5));
                    const carRightEdge = car.position.x + (lane.direction? (cellWidth * 0.5) : (cellWidth * 1.5));
                    const chickenLeftEdge = chicken.model.position.x - cellWidth/2 * 0.2;
                    const chickenRightEdge = chicken.model.position.x + cellWidth/2 * 0.2;
                    if(chickenRightEdge > carLeftEdge && chickenLeftEdge < carRightEdge && chicken.getLane() == lane.index){
                        if (!state.gameOver){
                            chicken.squish();
                            if (gameSounds && gameSounds.themeSong) gameSounds.themeSong.setVolume(0);
                            if (gameSounds && gameSounds.hit) gameSounds.hit.play();
                            endGame();
                        }
                    }
                });
            }
            else if (lane.type == 'truck'){
                const leftPos = -columns/2 * cellWidth + cellWidth/2 - 3 * cellWidth;
                const rightPos = -leftPos;
                lane.vehicles.forEach(truck => {
                    if(lane.direction) {
                        truck.position.x = truck.position.x > rightPos? leftPos : truck.position.x + lane.speed * deltaTime;
                    }else{
                        truck.position.x = truck.position.x < leftPos? rightPos : truck.position.x - lane.speed * deltaTime;
                    }
                    const truckLeftEdge = truck.position.x + (lane.direction? (-cellWidth * 2.5) : (-cellWidth * 0.5));
                    const truckRightEdge = truck.position.x + (lane.direction? (cellWidth * 0.5) : (cellWidth * 2.5));
                    const chickenLeftEdge = chicken.model.position.x - cellWidth/2 * 0.2;
                    const chickenRightEdge = chicken.model.position.x + cellWidth/2 * 0.2;
                    if(chickenRightEdge > truckLeftEdge && chickenLeftEdge < truckRightEdge && chicken.getLane() == lane.index){
                        if (!state.gameOver){
                            chicken.squish();
                            if (gameSounds && gameSounds.themeSong) gameSounds.themeSong.setVolume(0);
                            if (gameSounds && gameSounds.hit) gameSounds.hit.play();
                            endGame();
                        }
                    }
                });
            }
            else if (lane.type == 'river'){
                const leftPos = -columns/2 * cellWidth + cellWidth/2 - 2 * cellWidth;
                const rightPos = -leftPos;
                let logsBelowChicken = 0;
                lane.logs.forEach(log => {
                    if(lane.direction) {
                        log.position.x = log.position.x > rightPos? leftPos : log.position.x + lane.speed * deltaTime;
                    }else{
                        log.position.x = log.position.x < leftPos? rightPos : log.position.x - lane.speed * deltaTime;
                    }
                    const logLeftEdge = log.position.x + (lane.direction? (-cellWidth * 1.5) : (-cellWidth * 0.5));
                    const logRightEdge = log.position.x + (lane.direction? (cellWidth * 0.5) : (cellWidth * 1.5));
                    const chickenLeftEdge = chicken.model.position.x - cellWidth/2 * 0.2;
                    const chickenRightEdge = chicken.model.position.x + cellWidth/2 * 0.2;
                    const farLeft = -columns/2 * cellWidth;
                    const farRight = columns/2 * cellWidth;
                    if(chickenRightEdge > logLeftEdge && chickenLeftEdge < logRightEdge && chicken.getLane() == lane.index && chicken.isMoving == false && !state.gameOver){
                        logsBelowChicken++;
                        chicken.currentColumn = Math.floor((chicken.model.position.x + columns/2 * cellWidth)/cellWidth);
                        if (chicken.currentColumn >= columns)
                            chicken.currentColumn = columns - 1;
                        if (chicken.currentColumn < 0)
                            chicken.currentColumn = 0;
                        if (chickenRightEdge < farRight && chickenLeftEdge > farLeft)
                            chicken.model.position.x += lane.direction? lane.speed * deltaTime : -lane.speed * deltaTime;
                    }
                });
                if(logsBelowChicken == 0 && chicken.getLane() == lane.index && chicken.isMoving == false){
                    if (!state.gameOver){
                        chicken.fall();
                        endGame();
                    }
                }
            }
            else if (lane.type == 'rail'){
                if(lane.direction){
                    lane.train.position.x = ((lane.train.position.x > lane.finalPosition)? lane.initialPosition : (lane.train.position.x + lane.speed * deltaTime));
                } else{
                    lane.train.position.x = ((lane.train.position.x < lane.finalPosition)? lane.initialPosition : (lane.train.position.x - lane.speed * deltaTime));
                }
                const trainLength = 4 * cellWidth * lane.trainLength;
                const trainLeftEdge = lane.train.position.x + (lane.direction? -(trainLength - cellWidth * 0.5) : -(cellWidth * 0.5));
                const trainRightEdge = lane.train.position.x + (lane.direction? (cellWidth * 0.5) : (trainLength - cellWidth * 0.5));
                const chickenLeftEdge = chicken.model.position.x - cellWidth/2 * 0.2;
                const chickenRightEdge = chicken.model.position.x + cellWidth/2 * 0.2;
                if(chickenRightEdge > trainLeftEdge && chickenLeftEdge < trainRightEdge && chicken.getLane() == lane.index){
                    if (!state.gameOver){
                        chicken.shred();
                        chicken.model.visible = false;
                        if (gameSounds && gameSounds.themeSong) gameSounds.themeSong.setVolume(0);
                        if (gameSounds && gameSounds.death) gameSounds.death.play();
                        endGame();
                    }
                }
            }
        });
    }
    
    render();
    requestAnimationFrame(update);
}

// ======================
// Controls
// ======================
const onKeyDown = event => {
    if (!state.isGameActive || !chicken) return;
    
    switch (event.keyCode) {
        case 37:
            chicken.jump("left");
            break;
        case 38:
            chicken.jump("up");
            break;
        case 39:
            chicken.jump("right");
            break;
        case 40:
            chicken.jump("down");
            break;
    }
}
document.onkeydown = onKeyDown;

// Touch controls
let xDown = null;
let yDown = null;

const getTouches = evt =>{
    return evt.touches || evt.originalEvent.touches;
}

const handleTouchStart = evt =>{
    const firstTouch = getTouches(evt)[0];
    xDown = firstTouch.clientX;
    yDown = firstTouch.clientY;
};

const handleTouchMove = evt =>{
    if (!xDown || !yDown || !state.isGameActive || !chicken) {
        return;
    }
    let xUp = evt.touches[0].clientX;
    let yUp = evt.touches[0].clientY;
    let xDiff = xDown - xUp;
    let yDiff = yDown - yUp;
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) {
            chicken.jump("left");
        } else {
            chicken.jump("right");
        }
    } else {
        if (yDiff > 0) {
            chicken.jump("up");
        } else {
            chicken.jump("down");
        }
    }
    xDown = null;
    yDown = null;
};
document.addEventListener('touchstart', handleTouchStart, false);
document.addEventListener('touchmove', handleTouchMove, false);

// ======================
// Application Entry Point
// ======================
async function main() {
    // Initialize Telegram WebApp
    initTelegram();
    
    // Initialize UI
    initUI();
    
    // Initialize Game
    initGame();
    
    // Authenticate user
    const authenticated = await authenticateUser();
    
    if (!authenticated) {
        console.warn('Authentication failed - some features may not work');
    }
    
    // Start periodic bonus timer updates
    setInterval(() => {
        if (state.lastDailyClaimAt) {
            updateDailyBonusUI();
        }
    }, 1000);
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

