// Configuration
const config = {
    // WebSocket connection
    wsUrl: 'ws://127.0.0.1:8080',
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,

    // UI settings
    position: {
        top: '20px',
        right: '20px'
    },

    // Toast notification settings
    toastDuration: 3000,

    // Debug mode
    debug: true,

    // Icon settings
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

    // State persistence
    stateKey: 'pz_hud_state',
    maxStateAge: 5 * 60 * 1000, // 5 minutes in milliseconds

    // Weapon texture fallbacks
    textureFallbacks: {
        'Item_Crowbar_Forged': 'Item_Crowbar'
    }
};

// Sprite Manager
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

// State Manager
class StateManager {
    constructor() {
        this.currentState = {
            health: 100,
            weight: { current: 0, max: 0 },
            location: 'outside',
            weapons: {
                primary: null,
                secondary: null
            },
            lastUpdate: Date.now()
        };
    }

    saveState() {
        this.currentState.lastUpdate = Date.now();
        localStorage.setItem(config.stateKey, JSON.stringify(this.currentState));
    }

    loadState() {
        try {
            const savedState = localStorage.getItem(config.stateKey);
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                const stateAge = Date.now() - parsedState.lastUpdate;

                if (stateAge < config.maxStateAge) {
                    this.currentState = parsedState;
                    return true;
                } else {
                    localStorage.removeItem(config.stateKey);
                }
            }
        } catch (e) {
            console.error('Failed to load saved state:', e);
        }
        return false;
    }

    updateState(newState) {
        this.currentState = { ...this.currentState, ...newState };
        this.saveState();
    }

    getState() {
        return { ...this.currentState };
    }
}

// UI Manager
class UIManager {
    constructor() {
        this.spriteManager = new SpriteManager();
        this.initializeElements();
    }

    initializeElements() {
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
            }
        };
    }

    updateHealth(healthPercent) {
        const healthBar = this.elements.health.bar;
        healthBar.style.transform = `scaleX(${healthPercent / 100})`;

        if (healthPercent <= 25) {
            healthBar.classList.add('low-health');
        } else {
            healthBar.classList.remove('low-health');
        }

        if (healthPercent < this.currentHealth) {
            healthBar.classList.add('damage-taken');
            setTimeout(() => {
                healthBar.classList.remove('damage-taken');
            }, 300);
        }

        this.currentHealth = healthPercent;
    }

    updateHealthStats(stats) {
        if (stats) {
            this.updateHealthStat('infection', stats.infectionLevel);
            this.updateHealthStat('pain', stats.painLevel);
        }
    }

    updateHealthStat(stat, value) {
        const element = this.elements.health[stat];
        if (element) {
            const valueElement = element.querySelector('.stat-value');
            if (valueElement) {
                valueElement.textContent = `${Math.round(value)}%`;
            }
        }
    }

    updateBodyPartHealth(part, value) {
        const element = this.elements.health.bodyParts[part];
        if (element) {
            const percent = Math.round(value);
            const displayName = part.split('-').map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            element.textContent = `${displayName}: ${percent}%`;

            if (percent < 50) {
                element.classList.add('damaged');
            } else {
                element.classList.remove('damaged');
            }
        }
    }

    updateWeight(current, max) {
        const weightPercent = (current / max) * 100;
        this.elements.weight.bar.style.width = `${weightPercent}%`;
        this.elements.weight.text.textContent =
            `${current.toFixed(1)}/${max.toFixed(1)}`;
    }

    updateLocation(isOutside) {
        const { indicator, text } = this.elements.location;
        if (isOutside) {
            indicator.className = 'state-indicator outside';
            text.textContent = 'Outside';
        } else {
            indicator.className = 'state-indicator inside';
            text.textContent = 'Inside';
        }
    }

    updateWeapon(slot, weapon) {
        const { container, icon, name } = this.elements.weapons[slot];

        if (weapon) {
            const resolvedTexture = this.spriteManager.getWeaponTexture(weapon.texture);
            container.classList.remove('empty');

            const spriteStyle = this.spriteManager.getSpriteStyle(resolvedTexture);
            Object.assign(icon.style, spriteStyle);
            name.textContent = weapon.name;
        } else {
            container.classList.add('empty');
            icon.style.backgroundImage = '';
            icon.style.backgroundPosition = '';
            icon.style.width = '';
            icon.style.height = '';
            name.textContent = 'Empty';
        }
    }

    showToast(message, iconPath = null) {
        const toast = document.createElement('div');
        toast.className = 'toast';

        if (iconPath) {
            const icon = document.createElement('img');
            icon.className = 'icon';
            icon.src = `assets/${iconPath}`;
            toast.appendChild(icon);
        }

        const text = document.createElement('span');
        text.textContent = message;
        toast.appendChild(text);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, config.toastDuration);
    }
}

// WebSocket Manager
class WebSocketManager {
    constructor(eventHandler) {
        this.ws = null;
        this.reconnectTimeout = null;
        this.currentReconnectDelay = config.reconnectDelay;
        this.eventHandler = eventHandler;
    }

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

// Main HUD Class
class HUD {
    constructor() {
        this.stateManager = new StateManager();
        this.uiManager = new UIManager();
        this.wsManager = new WebSocketManager(this.handleEvent.bind(this));
    }

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
    }

    handleEvent(event) {
        if (config.debug) {
            console.debug('Received event:', event);
        }

        switch (event.type) {
            case 'state':
                this.handleStateUpdate(event.player);
                break;
            case 'xp_gain':
                this.uiManager.showToast(`+${event.amount} XP: ${event.perk}`, event.perkTexture);
                break;
            case 'zombie_kill':
                this.uiManager.showToast(`Zombie killed with ${event.weapon}`);
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