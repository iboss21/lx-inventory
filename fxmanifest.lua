fx_version 'cerulean'
game 'gta5'
lua54 'yes'
author 'Kakarot · NUI by iBoss21 / LXRCore (LXR UI kit)'
description 'Player inventory system providing a variety of features for storing and managing items'
version '2.3.0'

shared_scripts {
    '@qb-core/shared/locale.lua',
    'locales/en.lua',
    'locales/*.lua',
    'config/*.lua',
}

client_scripts {
    'client/main.lua',
    'client/drops.lua',
    'client/vehicles.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/main.lua',
    'server/functions.lua',
    'server/commands.lua',
    'server/hooks.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/lxr-ui.css',
    'html/main.css',
    'html/app.js',
    'html/fonts/*.woff2',
    'html/img/*.png',
    'html/images/*.png',
}

dependency 'qb-weapons'
