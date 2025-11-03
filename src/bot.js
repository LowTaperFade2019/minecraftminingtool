#!/usr/bin/env node

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    host: process.env.MC_HOST || 'localhost',
    port: process.env.MC_PORT ? parseInt(process.env.MC_PORT, 10) : 25565,
    username: process.env.MC_USERNAME || 'MiningBot',
    password: process.env.MC_PASSWORD,
    targetBlock: process.env.TARGET_BLOCK || 'minecraft:diamond_ore',
    searchRadius: process.env.SEARCH_RADIUS ? parseInt(process.env.SEARCH_RADIUS, 10) : 48,
    idleDelay: process.env.IDLE_DELAY ? parseInt(process.env.IDLE_DELAY, 10) : 5000
  };

  for (let i = 0; i < args.length; i++) {
    const [key, value] = args[i].split('=');
    switch (key) {
      case '--host':
        config.host = value;
        break;
      case '--port':
        config.port = parseInt(value, 10);
        break;
      case '--username':
        config.username = value;
        break;
      case '--password':
        config.password = value;
        break;
      case '--block':
        config.targetBlock = value;
        break;
      case '--radius':
        config.searchRadius = parseInt(value, 10);
        break;
      case '--idle-delay':
        config.idleDelay = parseInt(value, 10);
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
    }
  }

  return config;
}

function stripNamespace(blockName) {
  if (!blockName) return blockName;
  return blockName.toLowerCase().replace('minecraft:', '');
}

function createCurvedWaypoints(start, end) {
  const points = [];
  const midpoint = new Vec3(
    (start.x + end.x) / 2,
    start.y,
    (start.z + end.z) / 2
  );

  const offsetMagnitude = 1 + Math.random() * 2;
  const angle = Math.random() * Math.PI * 2;
  const offset = new Vec3(
    Math.cos(angle) * offsetMagnitude,
    0,
    Math.sin(angle) * offsetMagnitude
  );

  const control = midpoint.plus(offset);

  const segments = 4;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const x = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * control.x + t * t * end.x;
    const y = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * control.y + t * t * end.y;
    const z = (1 - t) * (1 - t) * start.z + 2 * (1 - t) * t * control.z + t * t * end.z;
    points.push(new Vec3(x, y, z));
  }

  return points;
}

function humanizedDelay(baseMs = 250) {
  const variation = Math.random() * baseMs * 0.4;
  return baseMs + variation;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function moveAlongCurve(bot, start, end) {
  const waypoints = createCurvedWaypoints(start, end);
  const { GoalNear } = goals;

  for (const waypoint of waypoints) {
    const target = waypoint.floored();
    try {
      await bot.pathfinder.goto(new GoalNear(target.x, target.y, target.z, 1));
      await sleep(humanizedDelay(200));
    } catch (err) {
      bot.emit('debug', `Failed to reach waypoint ${target}: ${err.message}`);
    }
  }
}

async function approachBlock(bot, block) {
  const { GoalNear } = goals;
  const start = bot.entity.position.clone();
  const end = block.position.clone();

  await moveAlongCurve(bot, start, end);

  const goal = new GoalNear(block.position.x, block.position.y, block.position.z, 1);
  await bot.pathfinder.goto(goal);
}

async function mineBlock(bot, block) {
  bot.chat(`Mining ${block.name} at ${block.position}`);
  await approachBlock(bot, block);
  await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true);
  await sleep(humanizedDelay(150));
  await bot.dig(block, true);
  await sleep(humanizedDelay(400));
}

function findNearestBlock(bot, blockName, radius) {
  if (!bot.entity || !bot.entity.position) {
    return null;
  }
  const mcData = bot.mcData;
  const normalized = stripNamespace(blockName);
  const blockDefinition = mcData.blocksByName[normalized];

  if (!blockDefinition) {
    bot.chat(`Unknown block: ${blockName}`);
    return null;
  }

  return bot.findBlock({
    matching: blockDefinition.id,
    maxDistance: radius,
    point: bot.entity.position
  });
}

async function mineNearestBlock(bot, blockName, radius) {
  if (!bot.entity || !bot.entity.position) {
    return false;
  }
  const target = findNearestBlock(bot, blockName, radius);

  if (!target) {
    bot.chat(`No ${blockName} found within ${radius} blocks.`);
    return false;
  }

  if (!bot.canSeeBlock(target)) {
    bot.emit('debug', `Target block ${blockName} at ${target.position} is not visible.`);
  }

  if (!bot.canDigBlock(target)) {
    bot.chat(`Cannot dig ${blockName} at ${target.position}`);
    return false;
  }

  await mineBlock(bot, target);
  return true;
}

function bootstrapBot(config) {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', async () => {
    bot.mcData = require('minecraft-data')(bot.version);
    const movements = new Movements(bot, bot.mcData);
    movements.canDig = true;
    movements.allow1by1towers = false;
    bot.pathfinder.setMovements(movements);

    bot.chat(`Target block: ${config.targetBlock}`);

    while (true) {
      try {
        const currentTarget = bot.configuredTarget || config.targetBlock;
        const mined = await mineNearestBlock(bot, currentTarget, config.searchRadius);
        if (!mined) {
          await sleep(config.idleDelay + humanizedDelay(500));
        } else {
          await sleep(humanizedDelay(750));
        }
      } catch (err) {
        bot.chat(`Error: ${err.message}`);
        await sleep(config.idleDelay + humanizedDelay(500));
      }
    }
  });

  bot.on('chat', async (username, message) => {
    if (username === bot.username) return;
    const normalizedMessage = message.trim().toLowerCase();
    if (normalizedMessage.startsWith('mine ')) {
      const newTarget = normalizedMessage.replace('mine ', '').trim();
      bot.chat(`Switching target to ${newTarget}`);
      bot.configuredTarget = newTarget;
    } else if (normalizedMessage === 'status') {
      bot.chat(`Current target: ${bot.configuredTarget || config.targetBlock}`);
    }
  });

  bot.on('end', () => {
    console.log('Bot connection ended.');
  });

  bot.on('error', (err) => {
    console.error('Bot error:', err);
  });

  bot.configuredTarget = config.targetBlock;

  setInterval(() => {
    if (!bot.entity) return;
    if (!bot.pathfinder.isMoving()) {
      bot.setControlState('jump', Math.random() < 0.2);
      bot.setControlState('sprint', Math.random() < 0.1);
      setTimeout(() => {
        bot.clearControlStates();
      }, humanizedDelay(600));
    }
  }, 8000);

  return bot;
}

async function main() {
  const config = parseArgs();
  const bot = bootstrapBot(config);

}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
