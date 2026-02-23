# Synapse Discord Bot

A community support bot for the Synapse Discord server.

## Features

- **FAQ Answers:** Automatic responses to common questions
- **Price Tracking:** Real-time SYN price and stats
- **Node Monitoring:** Check node status and earnings
- **Task Lookup:** Query task status
- **Moderation:** Auto-moderation and logging

## Setup

### Prerequisites

- Node.js 18+
- Discord Bot Token
- Synapse API Key

### Installation

```bash
git clone https://github.com/synapse-protocol/discord-bot.git
cd discord-bot
npm install
cp config.example.json config.json
# Edit config.json with your tokens
npm start
```

### Configuration

```json
{
  "discord": {
    "token": "YOUR_BOT_TOKEN",
    "clientId": "YOUR_CLIENT_ID",
    "guildId": "YOUR_GUILD_ID"
  },
  "synapse": {
    "apiKey": "YOUR_SYNAPSE_API_KEY",
    "network": "mainnet"
  },
  "features": {
    "faq": true,
    "price": true,
    "nodes": true,
    "moderation": true
  }
}
```

## Commands

### Public Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/price` | Show SYN price and stats | `/price` |
| `/faq <query>` | Search FAQ | `/faq staking` |
| `/node <id>` | Check node status | `/node node_abc123` |
| `/task <id>` | Check task status | `/task task_xyz789` |
| `/stats` | Network statistics | `/stats` |
| `/help` | Show help message | `/help` |

### Admin Commands

| Command | Description |
|---------|-------------|
| `/warn @user <reason>` | Warn user |
| `/kick @user <reason>` | Kick user |
| `/ban @user <reason>` | Ban user |
| `/slowmode <seconds>` | Enable slow mode |

## Auto-Responses

The bot automatically responds to common questions:

```javascript
// faq/triggers.js
module.exports = [
  {
    patterns: ['how to stake', 'staking guide'],
    response: 'Check out our staking guide: https://docs.synapse.io/guides/staking'
  },
  {
    patterns: ['api key', 'get api key'],
    response: 'Generate your API key at https://synapse.io/dashboard'
  },
  {
    patterns: ['node requirements', 'hardware requirements'],
    response: 'Minimum: RTX 2080, 32GB RAM. See full specs: https://docs.synapse.io/guides/node-setup'
  }
];
```

## Customization

### Adding Commands

```javascript
// commands/custom.js
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('custom')
    .setDescription('My custom command'),
  
  async execute(interaction) {
    await interaction.reply('Hello from custom command!');
  }
};
```

### Custom Responses

```javascript
// responses/welcome.js
module.exports = {
  trigger: 'guildMemberAdd',
  execute(member) {
    const channel = member.guild.channels.cache.get('welcome-channel');
    channel.send(`Welcome ${member}! Check out #getting-started`);
  }
};
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
CMD ["npm", "start"]
```

```bash
docker build -t synapse-discord-bot .
docker run -d --env-file .env synapse-discord-bot
```

### Hosting Services

- Railway
- Heroku
- Fly.io
- VPS

## Monitoring

```javascript
// monitoring setup
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request

## Support

For bot issues: Open GitHub issue
For general help: Join Discord
