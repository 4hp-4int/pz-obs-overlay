-- ZomboidEventMod.lua
require "ISUI/ISUIElement"

ZomboidEventMod = ZomboidEventMod or {}

-- Configuration
ZomboidEventMod.config = {
    EVENT_FILE = "events.json", -- File to write events to
    debug = true, -- Set to true to enable debug logging
    stateUpdateInterval = 1000, -- Interval in ms to send state updates
    minXpForToast = 1, -- Minimum XP to show toast
    frequentPerks = { -- Perks that gain XP frequently
        "Fitness",
        "Strength"
    }
}

ZomboidEventMod.eventData = nil -- Storage for event data
ZomboidEventMod.perkLevels = {} -- Track previous perk levels

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

-- Initialize perk levels for the player
function ZomboidEventMod.initializePerkLevels()
    local player = getPlayer()
    if not player then return end
    
    ZomboidEventMod.perkLevels = {}
    
    -- Get all available perks from PerkFactory
    local perks = PerkFactory.PerkList
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Initializing perk levels...")
    end
    
    -- Iterate over all perks
    for i=0, perks:size()-1 do
        local perk = perks:get(i)
        if perk then
            local perkName = PerkFactory.getPerkName(perk)
            local level = player:getPerkLevel(perk)
            
            if ZomboidEventMod.config.debug then
                print(string.format("  %s: Level %d", perkName, level))
            end
            
            ZomboidEventMod.perkLevels[perkName] = level
        end
    end
    
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Perk levels initialized")
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
    
    local bodyDamage = player:getBodyDamage()
    if not bodyDamage then return nil end
    
    -- Get overall health and body part health
    local overallHealth = bodyDamage:getHealth()
    local bodyPartHealth = {
        head = bodyDamage:getBodyPartHealth(BodyPartType.Head),
        torso = bodyDamage:getBodyPartHealth(BodyPartType.Torso_Upper),
        leftArm = bodyDamage:getBodyPartHealth(BodyPartType.Arm_L),
        rightArm = bodyDamage:getBodyPartHealth(BodyPartType.Arm_R),
        leftLeg = bodyDamage:getBodyPartHealth(BodyPartType.Leg_L),
        rightLeg = bodyDamage:getBodyPartHealth(BodyPartType.Leg_R)
    }
    
    -- Get additional health-related stats
    local healthStats = {
        infectionLevel = bodyDamage:getInfectionLevel(),
        painLevel = player:getStats():getPain(),
        coldLevel = bodyDamage:getColdStrength(),
        wetness = bodyDamage:getWetness(),
        discomfortLevel = bodyDamage:getDiscomfortLevel(),
        foodSicknessLevel = bodyDamage:getFoodSicknessLevel(),
        poisonLevel = bodyDamage:getPoisonLevel()
    }
    
    print("[DEBUG] Health Stats - Overall: " .. overallHealth .. 
          ", Infection: " .. healthStats.infectionLevel .. 
          ", Pain: " .. healthStats.painLevel)
    
    local stats = {
        health = overallHealth,
        bodyPartHealth = bodyPartHealth,
        healthStats = healthStats,
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
            primaryHand = player:getPrimaryHandItem() and {
                name = player:getPrimaryHandItem():getName(),
                texture = player:getPrimaryHandItem():getTexture():getName()
            } or nil,
            secondaryHand = player:getSecondaryHandItem() and {
                name = player:getSecondaryHandItem():getName(),
                texture = player:getSecondaryHandItem():getTexture():getName()
            } or nil
        }
    }
    
    return stats
end

-- Event Handlers
function ZomboidEventMod.onAddXP(player, perk, amount)
    if not player or not perk then return end
    
    local perkName = perk:getName()
    local currentLevel = player:getPerkLevel(perk)
    local previousLevel = ZomboidEventMod.perkLevels[perkName] or 0
    
    -- Check if this is a level up
    if currentLevel > previousLevel then
        ZomboidEventMod.eventData = {
            type = "level_up",
            perk = perkName,
            level = currentLevel,
            player = ZomboidEventMod.getPlayerStats(player)
        }
        ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
    end
    
    -- Only send XP gain for non-frequent perks or significant gains
    local isFrequentPerk = false
    for _, frequentPerk in ipairs(ZomboidEventMod.config.frequentPerks) do
        if perkName == frequentPerk then
            isFrequentPerk = true
            break
        end
    end
    
    if not isFrequentPerk or amount >= 5 then
        ZomboidEventMod.eventData = {
            type = "xp_gain",
            perk = perkName,
            amount = amount,
            level = currentLevel,
            player = ZomboidEventMod.getPlayerStats(player)
        }
        ZomboidEventMod.sendEvent(ZomboidEventMod.eventData)
    end
    
    -- Update tracked level
    ZomboidEventMod.perkLevels[perkName] = currentLevel
end

function ZomboidEventMod.onZombieDead(zombie)
    if not zombie then return end
    local player = getPlayer()
    if not player then return end
    
    local weapon = player:getPrimaryHandItem() and player:getPrimaryHandItem():getName() or "none"
    local weaponTexture = player:getPrimaryHandItem() and player:getPrimaryHandItem():getTexture():getName() or "none"
    ZomboidEventMod.eventData = {
        type = "zombie_kill",
        weapon = weapon,
        weaponTexture = weaponTexture,
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
    ZomboidEventMod.initializePerkLevels()
end

-- Register core game events
Events.OnGameBoot.Add(ZomboidEventMod.onGameBoot)
Events.OnGameStart.Add(ZomboidEventMod.onGameStart)

return ZomboidEventMod 