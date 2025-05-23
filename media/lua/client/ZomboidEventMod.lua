-- ZomboidEventMod.lua
-- This mod integrates Project Zomboid gameplay events with a Twitch overlay system
-- It tracks player stats, events, and sends them to a JSON file for the overlay to read

require "ISUI/ISUIElement"

ZomboidEventMod = ZomboidEventMod or {}

-- Configuration settings for the mod
-- EVENT_FILE: Where to write the events JSON
-- SCREEN_POS_FILE: Where to write the screen position data
-- debug: Enable/disable debug logging
-- stateUpdateInterval: How often to send player state updates (in milliseconds)
-- minXpForToast: Minimum XP gain to show a toast notification
-- didFaceCapture: Tracks if we've captured the player's face screenshot
-- frequentPerks: List of perks that gain XP frequently to avoid spam
ZomboidEventMod.config = {
    EVENT_FILE = "events.json",
    SCREEN_POS_FILE = "screen_pos.json",
    debug = true,
    stateUpdateInterval = 1000,
    minXpForToast = 1,
    didFaceCapture = false,
    frequentPerks = {
        "Fitness",
        "Strength"
    }
}

ZomboidEventMod.eventData = nil -- Stores the current event data before writing to file
ZomboidEventMod.perkLevels = {} -- Tracks previous perk levels to detect changes

-- Simple JSON encoder for Lua tables
-- Handles numbers, booleans, strings, arrays, and objects
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
    ZomboidEventMod.screenPosFilePath = saveFolder .. "/" .. ZomboidEventMod.config.SCREEN_POS_FILE
    
    -- Create/clear the files
    local writer = getFileWriter(ZomboidEventMod.eventFilePath, true, true)
    if writer then
        writer:close() -- Just create/clear the file
    end
    
    writer = getFileWriter(ZomboidEventMod.screenPosFilePath, true, true)
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

-- Sends an event to the events file
-- Adds timestamp and player info if available
-- Also logs to console if debug is enabled
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

-- Captures a screenshot of the player's face from the character info window
-- Used for the overlay to display the player's current appearance
function ZomboidEventMod.captureFaceScreenshot()
    local infoWindow = ISCharacterInfoWindow.instance
    if infoWindow and infoWindow.avatarPanel then
        if ZomboidEventMod.config.debug then
            print("[ZomboidEventMod] Capturing face screenshot...")
        end
        Core.TakeFullScreenshot("face_capture_temp.png")
    elseif ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Avatar panel not available yet.")
    end
end

-- Gets comprehensive player stats including:
-- Health (overall and per body part)
-- Position coordinates
-- Current state (sleeping, resting, etc.)
-- Stats (survival time, kills, weight, etc.)
-- Equipment in hands
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

-- Sends a player state update event
-- Rate limited to avoid spamming the events file
function ZomboidEventMod.sendPlayerStateEvent()
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

-- Delayed screenshot capture to ensure the UI is fully rendered
function ZomboidEventMod.delayedScreenshot()
    Events.OnPostRender.Remove(ZomboidEventMod.delayedScreenshot)
    getCore():TakeFullScreenshot("face_capture_temp.png")
end

-- Hooks into the character screen to capture face screenshots when opened
function ZomboidEventMod.hookIntoHealthPanel()
    if ISCharacterScreen and not ISCharacterScreen._ZomboidEventMod_Hooked then
        local old_setVisible = ISCharacterScreen.setVisible
        ISCharacterScreen.setVisible = function(self, visible)
            if visible then
                print("[ZomboidEventMod] Health Panel opened")
                
                -- Get screen position
                local x = self:getParent():getAbsoluteX()
                local y = self:getParent():getAbsoluteY()
                local width = self:getParent():getWidth()
                local height = self:getParent():getHeight()
                
                -- Clear the file first
                local writer = getFileWriter(ZomboidEventMod.screenPosFilePath, true, true)
                if writer then
                    writer:close()
                end
                
                -- Save screen position to file
                local screenPosData = {
                    x = x,
                    y = y,
                    width = width,
                    height = height,
                    timestamp = getGameTime():getWorldAgeHours()
                }
                
                writer = getFileWriter(ZomboidEventMod.screenPosFilePath, true, true)
                if writer then
                    writer:writeln(ZomboidEventMod.toJSON(screenPosData))
                    writer:close()
                end
                
                -- Capture screenshot after position is saved
                Events.OnPostRender.Add(ZomboidEventMod.delayedScreenshot)
            end
            return old_setVisible(self, visible)
        end
        ISCharacterScreen._ZomboidEventMod_Hooked = true
        print("[ZomboidEventMod] Successfully hooked into `ISCharacterScreen:setVisible()`")
    end
end

function ZomboidEventMod.initializeEvents()
    -- Only bind events once
    if ZomboidEventMod.initialized then return end
    
    if ZomboidEventMod.config.debug then
        print("[ZomboidEventMod] Initializing events...")
    end
    
    Events.AddXP.Add(ZomboidEventMod.onAddXP)
    Events.OnZombieDead.Add(ZomboidEventMod.onZombieDead)
    Events.OnPlayerUpdate.Add(ZomboidEventMod.sendPlayerStateEvent)
    
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
    ZomboidEventMod.hookIntoHealthPanel()
end

-- Register core game events
Events.OnGameBoot.Add(ZomboidEventMod.onGameBoot)
Events.OnGameStart.Add(ZomboidEventMod.onGameStart)

return ZomboidEventMod