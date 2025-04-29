// Configuration for the HUD overlay
// Contains WebSocket connection settings, UI positioning, and other display options
const config = {
    // WebSocket connection settings
    wsUrl: 'ws://127.0.0.1:8080', // WebSocket server URL
    reconnectDelay: 1000, // Initial delay before reconnecting (ms)
    maxReconnectDelay: 30000, // Maximum reconnection delay (ms)

    // UI positioning settings
    position: {
        top: '20px',
        right: '20px'
    },

    // Toast notification settings
    toastDuration: 3000, // How long to show toast messages (ms)

    // Debug mode - enables console logging
    debug: true,

    // Default icon and sprite sheet paths
    defaultIcon: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
    spriteSheets: {
        'ui': 'assets/ui.png',
        'ui_stuff0': 'assets/UI/ui_stuff0.png',
        'ninventory0': 'assets/ninventory0.png',
        'ninventory1': 'assets/ninventory1.png',
        'ninventory2': 'assets/ninventory2.png',
        'thuztor1': 'assets/ThuztorInventory1.png',
        'thuztor2': 'assets/ThuztorInventory2.png',
        'farming': 'assets/itemThuztorFarming1.png'
    },

    // State persistence settings
    stateKey: 'pz_hud_state', // localStorage key for saving state
    maxStateAge: 5 * 60 * 1000, // Maximum age of saved state (5 minutes)

    // Weapon texture fallbacks for missing textures
    textureFallbacks: {
        'Item_Crowbar_Forged': 'Item_Crowbar'
    }
};

// Manages sprite loading and texture mapping
// Handles loading sprite sheets and mapping item names to textures
class SpriteManager {
    constructor() {
        this.spriteData = window.SPRITE_DATA;
    }

    getSpriteStyle(textureName) {
        if (!textureName) {
            return {};
        }

        const spriteData = this.spriteData[textureName];
        if (!spriteData) {
            console.warn(`No sprite data found for: ${textureName}`);
            return this.getDefaultSpriteStyle();
        }

        const sheetUrl = config.spriteSheets[spriteData.sheet] || config.spriteSheets['ui'];
        if (!sheetUrl) {
            console.warn(`No sprite sheet found for: ${spriteData.sheet}`);
            return this.getDefaultSpriteStyle();
        }

        return {
            backgroundImage: `url(${sheetUrl})`,
            backgroundPosition: `-${spriteData.x}px -${spriteData.y}px`,
            width: `${spriteData.width}px`,
            height: `${spriteData.height}px`,
            backgroundRepeat: 'no-repeat'
        };
    }

    getDefaultSpriteStyle() {
        return {
            backgroundImage: `url(${config.spriteSheets['ui'] || config.defaultIcon})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat'
        };
    }

    getWeaponTexture(texture) {
        return config.textureFallbacks[texture] || texture;
    }
}

// Manages state persistence through localStorage
// Handles saving and loading HUD state
class StateManager {
    constructor() {
        this.state = {
            health: 100,
            weight: {
                current: 0,
                max: 0
            },
            location: 'outside',
            weapons: {
                primary: null,
                secondary: null
            },
            lastUpdated: Date.now()
        };
    }

    // Load state from localStorage
    loadState() {
        try {
            const savedState = localStorage.getItem(config.stateKey);
            if (!savedState) {
                return false;
            }

            const parsedState = JSON.parse(savedState);
            const stateAge = Date.now() - parsedState.lastUpdated;

            // Check if state is too old
            if (stateAge > config.maxStateAge) {
                localStorage.removeItem(config.stateKey);
                return false;
            }

            this.state = parsedState;
            return true;
        } catch (e) {
            console.error('Failed to load state:', e);
            return false;
        }
    }

    // Save state to localStorage
    saveState() {
        try {
            this.state.lastUpdated = Date.now();
            localStorage.setItem(config.stateKey, JSON.stringify(this.state));
            return true;
        } catch (e) {
            console.error('Failed to save state:', e);
            return false;
        }
    }

    // Update specific state properties
    updateState(updates) {
        this.state = {
            ...this.state,
            ...updates,
            lastUpdated: Date.now()
        };
        this.saveState();
    }

    // Get the current state
    getState() {
        return this.state;
    }
}

// Manages WebSocket connections and reconnection logic
// Handles connecting to the event daemon and processing incoming events
class WebSocketManager {
    constructor(eventHandler) {
        this.ws = null;
        this.reconnectTimeout = null;
        this.currentReconnectDelay = config.reconnectDelay;
        this.eventHandler = eventHandler;
    }

    // Establishes WebSocket connection with exponential backoff
    connect() {
        if (this.ws) {
            this.ws.close();
        }

        this.ws = new WebSocket(config.wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.currentReconnectDelay = config.reconnectDelay;
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.eventHandler(data);
            } catch (e) {
                console.error('Failed to parse WebSocket message:', e);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected, attempting to reconnect...');
            this.reconnectTimeout = setTimeout(() => {
                this.currentReconnectDelay = Math.min(
                    this.currentReconnectDelay * 2,
                    config.maxReconnectDelay
                );
                this.connect();
            }, this.currentReconnectDelay);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    // Cleanly disconnect from WebSocket
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
}

// Manages UI updates
// Handles updating all HUD elements
class UIManager {
    constructor() {
        this.elements = {
            health: {
                bar: document.getElementById('health-bar'),
                infection: document.getElementById('infection-level'),
                pain: document.getElementById('pain-level'),
                bodyParts: {
                    head: document.getElementById('head-health'),
                    torso: document.getElementById('torso-health'),
                    leftArm: document.getElementById('left-arm-health'),
                    rightArm: document.getElementById('right-arm-health'),
                    leftLeg: document.getElementById('left-leg-health'),
                    rightLeg: document.getElementById('right-leg-health')
                }
            },
            weight: {
                bar: document.getElementById('weight-bar'),
                text: document.getElementById('weight-text')
            },
            location: {
                indicator: document.getElementById('location-indicator'),
                text: document.getElementById('location-text')
            },
            weapons: {
                primary: {
                    container: document.getElementById('primary-weapon'),
                    icon: document.getElementById('primary-weapon-icon'),
                    name: document.getElementById('primary-weapon-name')
                },
                secondary: {
                    container: document.getElementById('secondary-weapon'),
                    icon: document.getElementById('secondary-weapon-icon'),
                    name: document.getElementById('secondary-weapon-name')
                }
            },
            toastContainer: document.getElementById('toast-container')
        };
        this.spriteManager = new SpriteManager();
    }

    // Update health bar
    updateHealth(healthPercent) {
        if (!this.elements.health.bar) return;

        const scaleValue = healthPercent / 100;
        this.elements.health.bar.style.transform = `scaleX(${scaleValue})`;

        if (healthPercent <= 25) {
            this.elements.health.bar.classList.add('low-health');
        } else {
            this.elements.health.bar.classList.remove('low-health');
        }
    }

    // Update health stats (infection, pain)
    updateHealthStats(stats) {
        if (!stats) return;

        if (stats.infection !== undefined && this.elements.health.infection) {
            const infection = Math.round(stats.infection * 100) + '%';
            this.elements.health.infection.querySelector('.stat-value').textContent = infection;
        }

        if (stats.pain !== undefined && this.elements.health.pain) {
            const pain = Math.round(stats.pain * 100) + '%';
            this.elements.health.pain.querySelector('.stat-value').textContent = pain;
        }
    }

    // Update body part health
    updateBodyPartHealth(part, health) {
        const bodyPartElement = this.elements.health.bodyParts[part];
        if (!bodyPartElement) return;

        const healthPercent = Math.round(health * 100);
        const partLabel = part.replace(/([A-Z])/g, ' $1').trim();
        bodyPartElement.textContent = `${partLabel}: ${healthPercent}%`;

        if (healthPercent < 100) {
            bodyPartElement.classList.add('damaged');
        } else {
            bodyPartElement.classList.remove('damaged');
        }
    }

    // Update weight display
    updateWeight(current, max) {
        if (!this.elements.weight.bar || !this.elements.weight.text) return;

        const weightPercent = Math.min((current / max) * 100, 100);
        this.elements.weight.bar.style.width = `${weightPercent}%`;
        this.elements.weight.text.textContent = `${current.toFixed(1)}/${max.toFixed(1)}`;
    }

    // Update location indicator
    updateLocation(isOutside) {
        if (!this.elements.location.indicator || !this.elements.location.text) return;

        this.elements.location.indicator.className = 'state-indicator';
        this.elements.location.indicator.classList.add(isOutside ? 'outside' : 'inside');
        this.elements.location.text.textContent = isOutside ? 'Outside' : 'Inside';
    }

    // Update weapon slot
    updateWeapon(slot, weapon) {
        const weaponSlot = this.elements.weapons[slot];
        if (!weaponSlot.container || !weaponSlot.icon || !weaponSlot.name) return;

        if (!weapon || !weapon.name) {
            weaponSlot.container.classList.add('empty');
            weaponSlot.name.textContent = 'Empty';
            return;
        }

        weaponSlot.container.classList.remove('empty');
        weaponSlot.name.textContent = weapon.name;

        if (weapon.texture) {
            const texture = this.spriteManager.getWeaponTexture(weapon.texture);
            const style = this.spriteManager.getSpriteStyle(texture);

            Object.assign(weaponSlot.icon.style, style);
        }
    }

    // Show toast notification
    showToast(message, icon, className = '') {
        const toast = document.createElement('div');
        toast.className = `toast ${className}`;
        toast.textContent = message;

        if (icon) {
            // Check if the icon is an emoji (starts with a Unicode character)
            const isEmoji = /^\p{Emoji}/u.test(icon);

            if (isEmoji) {
                // For emoji, create a text element
                const emojiElement = document.createElement('div');
                emojiElement.className = 'emoji-icon';
                emojiElement.textContent = icon;
                toast.prepend(emojiElement);
            } else {
                // For sprite textures, use the sprite manager
                const iconElement = document.createElement('div');
                iconElement.className = 'icon';
                // Get the correct texture from weapon texture map if needed
                const texture = this.spriteManager.getWeaponTexture(icon);
                // Apply the sprite style
                Object.assign(iconElement.style, this.spriteManager.getSpriteStyle(texture));
                toast.prepend(iconElement);
            }
        }

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, config.toastDuration);
    }
}

// Main HUD class that coordinates all components
// Manages state, UI updates, and WebSocket communication
class HUD {
    constructor() {
        this.stateManager = new StateManager();
        this.uiManager = new UIManager();
        this.wsManager = new WebSocketManager(this.handleEvent.bind(this));
        this.talkingHeadManager = new TalkingHeadManager();
    }

    // Initialize the HUD
    // Loads saved state and establishes WebSocket connection
    initialize() {
        // Try to load saved state
        if (this.stateManager.loadState()) {
            const state = this.stateManager.getState();
            this.uiManager.updateHealth(state.health);

            if (state.health <= 25) {
                this.uiManager.elements.health.bar.classList.add('low-health');
            }
        }

        // Connect to WebSocket
        this.wsManager.connect();

        // Initialize talking head
        this.talkingHeadManager.initialize();
    }

    // Handle incoming events from WebSocket
    // Updates UI based on event type and data
    handleEvent(event) {
        if (config.debug) {
            console.debug('Received event:', event);
        }

        switch (event.type) {
            case 'state':
                this.handleStateUpdate(event.player);
                break;
            case 'xp_gain':
                if (event.amount >= 1) {
                    // Use emoji for XP gains based on the perk
                    let xpEmoji = '⭐'; // Default star emoji

                    // Map perks to appropriate emojis
                    const perkEmojis = {
                        // Passive Skills
                        'Strength': '💪',
                        'Fitness': '🏃',

                        // Agility Skills
                        'Sprinting': '🏃‍♂️',
                        'Running': '🏃‍♂️',
                        'Lightfooted': '🦶',
                        'Nimble': '🤸',
                        'Sneaking': '🕵️',

                        // Combat Skills
                        'Axe': '🪓',
                        'Long Blunt': '🔨',
                        'Short Blunt': '🔧',
                        'Long Blade': '⚔️',
                        'Short Blade': '🔪',
                        'Spear': '🔱',
                        'Maintenance': '🛠️',

                        // Crafting Skills
                        'Carpentry': '🪚',
                        'Carving': '🪵',
                        'Cooking': '🍳',
                        'First Aid': '🩺',
                        'Electrical': '⚡',
                        'Metalworking': '🔥',
                        'Mechanics': '⚙️',
                        'Masonry': '🧱',
                        'Pottery': '🥣',
                        'Knapping': '🔨',
                        'Glassmaking': '🥛',
                        'Tailoring': '🧵',
                        'Welding': '🔥',

                        // Firearm Skills
                        'Aiming': '🎯',
                        'Reloading': '🔫',

                        // Survivalist Skills
                        'Agriculture': '🌱',
                        'Fishing': '🎣',
                        'Trapping': '🪤',
                        'Foraging': '🌿',
                        'Animal Care': '🐾',
                        'Butchering': '🥩',
                        'Tracking': '🐾',
                    };

                    if (perkEmojis[event.perk]) {
                        xpEmoji = perkEmojis[event.perk];
                    }

                    this.uiManager.showToast(`+${event.amount} XP: ${event.perk}`, xpEmoji, 'xp-toast');
                }
                break;
            case 'level_up':
                this.uiManager.showToast(`Level Up! ${event.perk} Level ${event.level}`, '🏆', 'level-up-toast');
                break;
            case 'zombie_kill':
                const weaponText = event.weapon === 'none' ? 'bare hands' : event.weapon;
                this.uiManager.showToast(`Zombie killed with ${weaponText}`, event.weaponTexture);
                break;
            default:
                if (config.debug) {
                    console.debug('Unknown event type:', event.type);
                }
        }
    }

    handleStateUpdate(player) {
        // Update health
        let healthPercent = player.health;
        if (healthPercent <= 1) {
            healthPercent = Math.round(healthPercent * 100);
        } else {
            healthPercent = Math.round(healthPercent);
        }
        this.uiManager.updateHealth(healthPercent);

        // Update health stats
        this.uiManager.updateHealthStats(player.healthStats);

        // Update body part health
        if (player.bodyPartHealth) {
            Object.entries(player.bodyPartHealth).forEach(([part, value]) => {
                this.uiManager.updateBodyPartHealth(part, value);
            });
        }

        // Update weight
        this.uiManager.updateWeight(
            player.stats.inventoryWeight,
            player.stats.maxWeight
        );

        // Update location
        this.uiManager.updateLocation(player.state.isOutside);

        // Update weapons
        this.uiManager.updateWeapon('primary', player.equipment.primaryHand);
        this.uiManager.updateWeapon('secondary', player.equipment.secondaryHand);

        // Save state
        this.stateManager.updateState({
            health: healthPercent,
            weight: {
                current: player.stats.inventoryWeight,
                max: player.stats.maxWeight
            },
            location: player.state.isOutside ? 'outside' : 'inside',
            weapons: {
                primary: player.equipment.primaryHand,
                secondary: player.equipment.secondaryHand
            }
        });
    }
}

// Initialize HUD when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const hud = new HUD();
    hud.initialize();
}); 