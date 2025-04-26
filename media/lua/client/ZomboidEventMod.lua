-- ZomboidEventMod.lua
require "ISUI/ISUIElement"

ZomboidEventMod = ZomboidEventMod or {}

-- Configuration
ZomboidEventMod.config = {
    EVENT_FILE = "events.json", -- File to write events to
    debug = true, -- Set to true to enable debug logging
    playerStatsInterval = 10000, -- Interval in ms to send player stats
    stateUpdateInterval = 5000 -- Interval in ms to send state updates
}

ZomboidEventMod.eventData = nil -- Storage for event data

-- Simple JSON encoder
function ZomboidEventMod.toJSON(data)
    if data == nil then return "null" end
    
    local dataType = type(data)
    if dataType == "number" then
        return tostring(data)
    elseif dataType == "boolean" then
        return tostring(data)
    elseif dataType == "string" then
        return string.format('"%s"', data:gsub('"', '\\"'))
    elseif dataType == "table" then
        local parts = {}
        -- Check if it's an array or object
        local isArray = true
        local n = 0
        for k, v in pairs(data) do
            n = n + 1
            if type(k) ~= "number" or k ~= n then
                isArray = false
                break
            end
        end
        
        if isArray then
            for _, v in ipairs(data) do
                table.insert(parts, ZomboidEventMod.toJSON(v))
            end
            return "[" .. table.concat(parts, ",") .. "]"
        else
            for k, v in pairs(data) do
                table.insert(parts, string.format('"%s":%s', k, ZomboidEventMod.toJSON(v)))
            end
            return "{" .. table.concat(parts, ",") .. "}"
        end
    end
    return "null"
end

-- Initialize our file writer
function ZomboidEventMod.initializeWriter()
    -- Get user's save folder + mods folder
    local saveFolder = getGameTime():getModData().saveFolder
    if not saveFolder then
        saveFolder = "Saves"
    end
    ZomboidEventMod.eventFilePath = saveFolder .. "/" .. ZomboidEventMod.config.EVENT_FILE
    
    -- Create/clear the file
    local writer = getFileWriter(ZomboidEventMod.eventFilePath, true, true) 
    if writer then
        writer:close() -- Just create/clear the file
    end
end

-- Utility function to write events to file
function ZomboidEventMod.sendEvent(eventData)
    ZomboidEventMod.eventData = eventData
    if not ZomboidEventMod.eventData then return end
    
    -- Add timestamp and player info if available
    ZomboidEventMod.eventData.timestamp = getGameTime():getWorldAgeHours()
    
    local json_data = ZomboidEventMod.toJSON(ZomboidEventMod.eventData)
    
    -- Write to file using writeln for automatic newlines
    local writer = getFileWriter(ZomboidEventMod.eventFilePath, true, true)
    if writer then
        writer:writeln(json_data)
        writer:close()
    end
    
    -- Also log to console for debugging
    if ZomboidEventMod.config.debug then
        print("[ZOMBOID_EVENT] " .. json_data)
    end
end

-- Get player stats
function ZomboidEventMod.getPlayerStats(player)
    if not player then return nil end
    
    local stats = {
        health = player:getHealth(),
        position = {
            x = player:getX(),
            y = player:getY(),
            z = player:getZ()
        },
        state = {
            isAsleep = player:isAsleep(),
            isResting = player:isResting(),
            isOutside = player:isOutside(),
            isWearingGloves = player:isWearingGloves(),
            isWearingGlasses = player:isWearingGlasses(),
            isWearingVisualAid = player:isWearingVisualAid(),
            isDisguised = player:isDisguised(),
            isWeaponReady = player:isWeaponReady(),
            isCurrentlyIdle = player:isCurrentlyIdle(),
            isCurrentlyBusy = player:isCurrentlyBusy()
        },
        stats = {
            hoursSurvived = player:getHoursSurvived(),
            zombieKills = player:getZombieKills(),
            inventoryWeight = player:getInventoryWeight(),
            maxWeight = player:getMaxWeight(),
            levelUpMultiplier = player:getLevelUpMultiplier(),
            numSurvivorsInVicinity = player:getNumSurvivorsInVicinity()
        },
        equipment = {
            primaryHand = player:getPrimaryHandItem() and player:getPrimaryHandItem():getName() or nil,
            secondaryHand = player:getSecondaryHandItem() and player:getSecondaryHandItem():getName() or nil
        }
    }
    
    return stats
end

-- Event Handlers
function ZomboidEventMod.onEquipPrimary(player, item)
    if not player or not item then return end
    
    ZomboidEventMod.eventData = {
        type = "equip",
        itemName = item:getName(),
        itemType = item:getType(),
        iconPath = tostring(item:getIcon()),
        equipped = "primary"
    }
    ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
end

function ZomboidEventMod.onContainerUpdate(container, type)
    if not container then return end
    local player = getPlayer()
    if not player then return end

    -- Only track when items are added to player's inventory
    if type == "add" and container == player:getInventory() then
        local items = container:getItems()
        local lastItem = items:get(items:size() - 1)
        if lastItem then
            ZomboidEventMod.eventData = {
                type = "pickup",
                itemName = lastItem:getName(),
                itemType = lastItem:getType(),
                iconPath = tostring(lastItem:getIcon())
            }
            ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
        end
    end
end

-- Store the last weapon swing for hit detection
ZomboidEventMod.lastWeaponSwing = nil

-- Enhanced weapon events
function ZomboidEventMod.onWeaponSwing(player, weapon)
    if not player or not weapon then return end
    
    -- Store the last weapon swing for hit detection
    ZomboidEventMod.lastWeaponSwing = {
        weapon = weapon,
        time = getTimeInMillis()
    }
    
    ZomboidEventMod.eventData = {
        type = "attack",
        itemName = weapon:getName(),
        itemType = weapon:getType(),
        iconPath = tostring(weapon:getIcon()),
        hit = false,
        player = ZomboidEventMod.getPlayerStats(player)
    }
    ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
end

function ZomboidEventMod.onHitZombie(zombie, player, bodyPart, weapon)
    if not player or not zombie then return end
    
    -- Check if this hit corresponds to our last weapon swing
    local now = getTimeInMillis()
    if ZomboidEventMod.lastWeaponSwing and 
       (now - ZomboidEventMod.lastWeaponSwing.time) < 1000 then -- Within 1 second
        
        ZomboidEventMod.eventData = {
            type = "hit",
            itemName = weapon and weapon:getName() or "Hands",
            itemType = weapon and weapon:getType() or "Bare Hands",
            iconPath = weapon and tostring(weapon:getIcon()) or "",
            bodyPart = bodyPart,
            hit = true,
            player = ZomboidEventMod.getPlayerStats(player)
        }
        ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
    end
end

function ZomboidEventMod.onAddXP(player, perk, amount)
    if not player or not perk then return end
    
    local eventData = {
        type = "xp_gain",
        perk = perk:getName(), -- Use getName() instead of getId() for better readability
        amount = amount,
        level = player:getPerkLevel(perk),
        player = ZomboidEventMod.getPlayerStats(player)
    }
    ZomboidEventMod.sendEvent(eventData)
end

function ZomboidEventMod.onZombieDead(zombie)
    if not zombie then return end
    local player = getPlayer()
    if not player then return end
    
    local eventData = {
        type = "zombie_kill",
        weapon = player:getPrimaryHandItem() and player:getPrimaryHandItem():getName() or "none",
        location = { x = zombie:getX(), y = zombie:getY(), z = zombie:getZ() }
    }
    ZomboidEventMod.sendEvent(eventData)
end

-- Periodic player stats update
function ZomboidEventMod.updatePlayerStats()
    local player = getPlayer()
    if not player then return end
    
    local eventData = {
        type = "player_update",
        player = ZomboidEventMod.getPlayerStats(player)
    }
    ZomboidEventMod.sendEvent(eventData)
end

-- Initialization
function ZomboidEventMod.initializeEvents()
    -- Only bind events once
    if ZomboidEventMod.initialized then return end
    
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Initializing events...")
    end
    
    Events.OnEquipPrimary.Add(ZomboidEventMod.onEquipPrimary)
    Events.OnContainerUpdate.Add(ZomboidEventMod.onContainerUpdate)
    Events.OnWeaponSwing.Add(ZomboidEventMod.onWeaponSwing)
    Events.OnHitZombie.Add(ZomboidEventMod.onHitZombie)
    Events.AddXP.Add(ZomboidEventMod.onAddXP)
    Events.OnZombieDead.Add(ZomboidEventMod.onZombieDead)
    
    -- Add periodic player stats update
    Events.OnTick.Add(function()
        if not ZomboidEventMod.lastStatsUpdate or 
           (getTimeInMillis() - ZomboidEventMod.lastStatsUpdate) >= ZomboidEventMod.config.playerStatsInterval then
            ZomboidEventMod.updatePlayerStats()
            ZomboidEventMod.lastStatsUpdate = getTimeInMillis()
        end
    end)
    
    ZomboidEventMod.initialized = true
    
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Events initialized successfully")
    end
end

-- Boot and Start handlers
function ZomboidEventMod.onGameBoot()
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Game boot detected")
    end
end

function ZomboidEventMod.onGameStart()
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Game start detected")
    end
    ZomboidEventMod.initializeEvents()
    ZomboidEventMod.initializeWriter()
end

-- Register core game events
Events.OnGameBoot.Add(ZomboidEventMod.onGameBoot)
Events.OnGameStart.Add(ZomboidEventMod.onGameStart)

local function updatePlayerState()
    local player = getPlayer()
    if not player then return end
    
    -- Rate limit state updates
    if not ZomboidEventMod.lastStateUpdate or 
       (getTimeInMillis() - ZomboidEventMod.lastStateUpdate) >= ZomboidEventMod.config.stateUpdateInterval then
        
        -- Get basic player state
        ZomboidEventMod.eventData = {
            type = "state",
            health = player:getBodyDamage():getOverallBodyHealth(),
            position = {
                x = player:getX(),
                y = player:getY(),
                z = player:getZ()
            },
            stats = {
                isAsleep = player:isAsleep(),
                isResting = player:isResting(),
                isOutside = player:isOutside(),
                hoursSurvived = player:getHoursSurvived(),
                zombieKills = player:getZombieKills(),
                inventoryWeight = player:getInventoryWeight(),
                maxWeight = player:getMaxWeight()
            },
            equipment = {
                primaryHand = player:getPrimaryHandItem() and player:getPrimaryHandItem():getName() or nil,
                secondaryHand = player:getSecondaryHandItem() and player:getSecondaryHandItem():getName() or nil
            }
        }
        
        -- Send state update
        ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
        ZomboidEventMod.lastStateUpdate = getTimeInMillis()
    end
end

local function onXPGain(skill, amount, level)
    ZomboidEventMod.eventData = {
        type = "xp",
        skill = skill,
        amount = amount,
        level = level
    }
    ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
end

-- Register events
Events.OnPlayerUpdate.Add(updatePlayerState)
Events.AddXP.Add(onXPGain)

return ZomboidEventMod 