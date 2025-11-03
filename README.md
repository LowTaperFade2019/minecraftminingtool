# Minecraft Mining Tool

A Node.js bot built with [mineflayer](https://github.com/PrismarineJS/mineflayer) that continuously searches for and mines the nearest block matching a configurable Minecraft identifier (for example, `minecraft:coal_ore`). The bot uses curved waypoint navigation and subtle timing variations to simulate human-like movement while travelling between blocks.

## Features

- Connects to any Java Edition server supported by mineflayer.
- Targets the closest block matching the configured identifier and digs it.
- Adjustable search radius and idle delay via CLI flags or environment variables.
- Randomized curved movement between blocks for more natural navigation.
- Optional in-game chat commands to change the mining target or request status.

## Requirements

- Node.js 18 or newer
- Access to a Minecraft Java Edition server where bots are allowed

Install dependencies:

```bash
npm install
```

## Usage

Set the connection details through environment variables or CLI flags and start the bot:

```bash
MC_HOST=your.server.address \
MC_PORT=25565 \
MC_USERNAME=YourBotName \
TARGET_BLOCK=minecraft:diamond_ore \
npm start
```

Alternatively, pass the same options as flags:

```bash
node src/bot.js --host=your.server.address --port=25565 \
  --username=YourBotName --block=minecraft:gold_ore --radius=64
```

### Environment Variables & Flags

| Option | Environment Variable | CLI Flag | Default | Description |
| --- | --- | --- | --- | --- |
| Server host | `MC_HOST` | `--host` | `localhost` | Minecraft server hostname |
| Server port | `MC_PORT` | `--port` | `25565` | Minecraft server port |
| Bot username | `MC_USERNAME` | `--username` | `MiningBot` | Username the bot should use |
| Bot password | `MC_PASSWORD` | `--password` | none | Optional password for authenticated servers |
| Target block | `TARGET_BLOCK` | `--block` | `minecraft:diamond_ore` | Namespaced identifier of the block to mine |
| Search radius | `SEARCH_RADIUS` | `--radius` | `48` | Maximum distance (in blocks) to search |
| Idle delay | `IDLE_DELAY` | `--idle-delay` | `5000` | Delay in milliseconds before re-scanning when no block is found |

### Chat Commands

- `mine <block_id>` – update the target block while the bot is running.
- `status` – display the current mining target.

## Notes

- The bot sends movement commands with slight random delays and travels via intermediate curved waypoints to mimic human behaviour.
- Ensure the server allows bot connections and that automated mining complies with server rules.

## License

This project is released under the ISC License.
