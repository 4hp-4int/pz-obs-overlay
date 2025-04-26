-- ZomboidEventMod.lua
require "ISUI/ISUIElement"

ZomboidEventMod = ZomboidEventMod or {}

-- Configuration
ZomboidEventMod.config = {
    EVENT_FILE = "events.json", -- File to write events to
    debug = true, -- Set to true to enable debug logging
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
function ZomboidEventMod.onAddXP(player, perk, amount)
    if not player or not perk then return end
    
    ZomboidEventMod.eventData = {
        type = "xp_gain",
        perk = perk:getName(),
        amount = amount,
        level = player:getPerkLevel(perk),
        player = ZomboidEventMod.getPlayerStats(player)
    }
    ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
end

function ZomboidEventMod.onZombieDead(zombie)
    if not zombie then return end
    local player = getPlayer()
    if not player then return end
    
    ZomboidEventMod.eventData = {
        type = "zombie_kill",
        weapon = player:getPrimaryHandItem() and player:getPrimaryHandItem():getName() or "none",
        location = { x = zombie:getX(), y = zombie:getY(), z = zombie:getZ() }
    }
    ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
end

local function sendPlayerStateEvent()
    local player = getPlayer()
    if not player then return end
    
    -- Rate limit state updates
    if not ZomboidEventMod.lastStateUpdate or 
       (getTimeInMillis() - ZomboidEventMod.lastStateUpdate) >= ZomboidEventMod.config.stateUpdateInterval then
        
        ZomboidEventMod.eventData = {
            type = "state",
            player = ZomboidEventMod.getPlayerStats(player)
        }
        
        ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
        ZomboidEventMod.lastStateUpdate = getTimeInMillis()
    end
end

-- Initialization
function ZomboidEventMod.initializeEvents()
    -- Only bind events once
    if ZomboidEventMod.initialized then return end
    
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Initializing events...")
    end
    
    Events.AddXP.Add(ZomboidEventMod.onAddXP)
    Events.OnZombieDead.Add(ZomboidEventMod.onZombieDead)
    Events.OnPlayerUpdate.Add(sendPlayerStateEvent)
    
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

return ZomboidEventMod 