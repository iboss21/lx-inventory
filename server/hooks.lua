function TriggerHook(hookType, ...)
    if not hookType or not Events[hookType] then return end

    local hooks = Events[hookType]?.hooks
    if not hooks then return end

    local result
    for i = 1, #hooks do
        -- TODO: Add further logic here, like filtering.
        if hooks[i] then
            local ok, response = pcall(hooks[i].fn, ...)
            if ok then
                if response == false then
                    return false
                elseif response ~= nil then
                    result = response -- last hook to return a non-nil, non-false value wins
                end
            end
        end
    end

    return result
end

function TriggerListener(listenerType, ...)
    if not listenerType or not Events[listenerType] then return end

    local listeners = Events[listenerType]?.listeners
    if not listeners then return end

    for i = 1, #listeners do
        -- TODO: Add further logic here, like filtering.
        if listeners[i] then
            pcall(listeners[i].fn, ...)
        end
    end
end

-- Hook Helpers

local function shallowCopy(t)
    if not t then return t end
    local copy = {}
    for k, v in pairs(t) do
        copy[k] = v
    end
    return copy
end

local function buildPlayerInventory(player)
    return {
        slots = Config.MaxSlots,
        maxweight = Config.MaxWeight,
        items = player?.PlayerData?.items or {},
    }
end

local function resolveInventoryContext(inventory, id, player)
    if not inventory or not id then return end
    local inventoryType = GetInventoryType(inventory)
    if inventoryType == 'player' then
        player = player or exports['qb-core']:GetPlayer(id)
        return inventoryType, buildPlayerInventory(player)
    end
    if inventoryType == 'drop' then return inventoryType, Drops[id] end

    return inventoryType, Inventories[id]
end

local function buildMovedData(fromInventory, toInventory, fromId, toId, fromSlot, toSlot, toAmount, fromPlayer, toPlayer)
    local fromType, fromInventoryData = resolveInventoryContext(fromInventory, fromId, fromPlayer)
    local toType, toInventoryData = resolveInventoryContext(toInventory, toId, toPlayer)
    return {
        fromType = fromType,
        toType = toType,
        fromInventory = fromInventoryData,
        toInventory = toInventoryData,
        fromId = fromId,
        toId = toId,
        fromSlot = fromSlot,
        toSlot = toSlot,
        amount = toAmount,
    }
end

local function buildItemDroppedData(source, player, coords, slot, amount)
    local itemCopy = shallowCopy(player.PlayerData.items[slot])
    if itemCopy then itemCopy.amount = amount end
    return {
        source = source,
        sourceInventory = buildPlayerInventory(player),
        coords = coords,
        item = itemCopy,
        amount = amount,
    }
end

local function buildUsedData(source, player, item)
    return {
        source = source,
        sourceInventory = buildPlayerInventory(player),
        item = shallowCopy(item),
    }
end

local function buildItemAddedData(identifier, item, slot, amount, player, reason, resource)
    local inventoryType, inventoryData = resolveInventoryContext(identifier, identifier, player)
    return {
        toId = identifier,
        toInventory = inventoryData,
        toType = inventoryType,
        toSlot = slot,
        item = item,
        amount = amount,
        reason = reason,
        resource = resource,
    }
end

local function buildItemRemovedData(identifier, item, slot, amount, player, reason, resource)
    local inventoryType, inventoryData = resolveInventoryContext(identifier, identifier, player)
    local itemCopy = shallowCopy(item)
    itemCopy.amount = amount
    return {
        fromId = identifier,
        fromInventory = inventoryData,
        fromType = inventoryType,
        fromSlot = slot,
        item = itemCopy,
        amount = amount,
        reason = reason,
        resource = resource,
    }
end

local function buildShopData(shopType, shopId, itemSlot, amount, toId)
    local shopData = RegisteredShops[shopId]
    local itemData = shopData.items[itemSlot]
    return {
        shopType = shopType,
        shop = shopData,
        toId = toId,
        item = shallowCopy(itemData),
        amount = amount,
        totalPrice = itemData.price * amount,
    }
end

local function buildOpenedData(id, player, otherId, otherPlayer)
    local _, otherInventoryData = resolveInventoryContext(otherId, otherId, otherPlayer)
    return {
        source = id,
        sourceInventory = buildPlayerInventory(player),
        inventoryId = otherId,
        inventory = otherInventoryData,
    }
end

local function buildShopOpenedData(source, player, shopName)
    return {
        source = source,
        sourceInventory = buildPlayerInventory(player),
        shop = RegisteredShops[shopName],
    }
end

function GetInventoryType(identifier)
    if not identifier then return end
    if identifier == 'player' or type(identifier) == 'number' then return 'player' end
    if identifier:match('otherplayer%-') then return 'player' end
    if identifier:match('trunk%-') then return 'trunk' end
    if identifier:match('glovebox%-') then return 'glovebox' end
    if Inventories[identifier] then return 'inventory' end
    if Drops[identifier] then return 'drop' end
    local shopData = RegisteredShops[identifier]
    if shopData then return shopData.type or (shopData.name:gsub('%d+$', '')) end -- infer type from name if necessary
end

--- Re-fetches a player-type inventory snapshot for the listener, since the snapshot
--- is captured before a mutation.
--- @param payload table - the hook/listener payload to update in place
--- @param field string - the payload key holding the InventorySnapshot
--- @param identifier number|string - the identifier to re-resolve (player id, 'otherplayer-x', etc.)
function RefreshInventorySnapshot(payload, field, identifier)
    if not payload or not payload[field] then return payload end
    if GetInventoryType(identifier) ~= 'player' then return payload end
    local player = exports['qb-core']:GetPlayer(identifier)
    payload[field] = buildPlayerInventory(player)
    return payload
end

local hookBuilders = {
    ItemMoved = buildMovedData,
    ItemDropped = buildItemDroppedData,
    ItemUsed = buildUsedData,
    ItemBought = buildShopData,
    ItemAdded = buildItemAddedData,
    ItemRemoved = buildItemRemovedData,
    InventoryOpened = buildOpenedData,
    ShopOpened = buildShopOpenedData,
}

function buildHookData(hookType, ...)
    local builder = hookBuilders[hookType]
    if builder then return builder(...) end
end