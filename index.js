const { Client, GatewayIntentBits, REST, Routes, Intents, ChannelType, PermissionFlagsBits } = require('discord.js');
const { clientId, guildId, token, db_host, db_name, db_password, db_user } = require('./config.json');
const mysql = require ('mysql2/promise');

const dbConfig = {
  host: db_host,
  user: db_user,
  password: db_password,
  database: db_name
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ]
});

let connection;
client.once('ready', async () => {

  // Connect to the database
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to the database.");
  } catch (err) {
    console.error("Database connection error: " + err);
  }


  client.on('guildMemberAdd', async member => {
      console.log(`New member detected: ${member.user.tag}`);
      const userData = {
          id: member.id,
          username: member.user.tag,
          rank: member.roles.cache.map(role => role.name).join(', '),
          avatar: newMember.user.displayAvatarURL({ format: 'png', dynamic: true }), // Getting the full avatar URL
          is_bot: member.user.bot
      };

      if (!connection) {
        console.error('Database connection is not established.');
        return;
      }

      try {
          await connection.execute('INSERT INTO discord_bot (id, username, avatar, rank, is_bot) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=?, rank=?, is_bot=?', 
              [userData.id, userData.username, userData.rank, userData.is_bot, userData.username, userData.avatar, userData.rank, userData.is_bot]);
          console.log(`Data inserted/updated for user: ${userData.username}`);
      } catch (err) {
          console.error('Database error:', err);
      }
  });

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    console.log(`Member update detected for: ${newMember.user.tag}`);

    const oldRoles = oldMember.roles.cache.map(role => role.name).join(', ');
    const newRoles = newMember.roles.cache.map(role => role.name).join(', ');

    if (oldRoles !== newRoles || oldMember.nickname !== newMember.nickname) {
        console.log(`Data change detected for: ${newMember.user.tag}`);

        const userData = {
            discord_id: newMember.id,
            username: newMember.user.username,
            discriminator: newMember.user.discriminator,
            avatar: newMember.user.displayAvatarURL({ format: 'png', dynamic: true }), // Getting the full avatar URL
            rank: newRoles,
            is_bot: newMember.user.bot
        };

        try {
          await connection.execute(
            'INSERT INTO discord_bot (discord_id, username, discriminator, avatar, rank, is_bot) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE username=?, discriminator=?, rank=?, is_bot=?', 
            [userData.discord_id, userData.username, userData.discriminator, userData.avatar, userData.rank, userData.is_bot, userData.username, userData.discriminator, userData.avatar, userData.rank, userData.is_bot]
        );
        console.log(`Data inserted/updated for user: ${userData.username}`);
        } catch (err) {
            console.error('Database error during guildMemberUpdate:', err);
        }
    } else {
        console.log(`No significant data change detected for: ${newMember.user.tag}`);
    }
});



  // Create the /dob command
  await client.guilds.cache.get(guildId).commands.create({
    name: 'dob',
    description: 'Self-declare your Date of Birth for age verification.',
    options: [
      {
        name: 'date',
        type: 3,
        description: 'Your Date of Birth in DD-MM-YYYY format',
        required: true,
      },
    ],
  });

  // Create the /init command
  await client.guilds.cache.get(guildId).commands.create({
    name: 'init',
    description: 'Initialize the server with the Genderspace.io channel template.',
  });

  await client.guilds.cache.get(guildId).commands.create({
    name: 'clear',
    description: 'Clear all chat messages out of this channel.',
  });

  // Create the /post_rules command
  await client.guilds.cache.get(guildId).commands.create({
    name: 'post_rules',
    description: 'Post the Genderspace server rules.',
  });

  console.log('Commands registered!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  try {
    const { commandName } = interaction;

    if (commandName === 'clear') {
      // Fetch a certain number of messages from the channel (you can modify the number)
      const fetched = await interaction.channel.messages.fetch({ limit: 100 });
      // Bulk delete the fetched messages
      interaction.channel.bulkDelete(fetched)
          .then(() => {
              interaction.reply('Deleted messages successfully.').then(msg => {
                  // Optionally delete the confirmation message after a short delay
                  setTimeout(() => msg.delete(), 5000);
              });
          })
          .catch(error => {
              console.error('Error deleting messages: ', error);
              interaction.reply('There was an error trying to delete messages in this channel.');
          });
    }

    if (commandName === 'post_rules') {
      // Ensure only an Admin can execute this command
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: "Sorry, only Admins can post the server rules.", ephemeral: true });
      }
    
        // Post the Genderspace Server Rules
        const rulesMessage = `
        1. **Respect and Kindness**: Always treat each other with respect.
        2. **No Hate Speech or Discrimination**: Let's create a safe and inclusive space for everyone.
        3. **Discussion Sensitivity**: Remember, this is a safe space for all.
        4. **Public Warnings:** Understand public warnings are for transparency.
        5. **Research Before Sharing**: Ensure shared studies or opinions are from reputable sources.
        6. **Avoiding Gossip**: Everyone deserves privacy and respect, even in their absence.
        7. **Tech Talk**: Keep tech discussions to appropriate channels.
        8. **No Spam**: Respect the channel topics and avoid spamming.
        9. **Personal Boundaries**: Respect everyone's boundaries.
        10. **Keep it PG-13**: Please keep discussions PG-13. For more explicit topics, head over to #nsfw-chat.
        *Remember, these rules are here to ensure Genderspace remains a welcoming place for everyone!* :rainbow::star2:
        `;
        
        interaction.channel.send(rulesMessage);
        interaction.reply({ content: 'Server rules posted!', ephemeral: true });
      
    }    

    if (commandName === 'dob') {
      const dobString = interaction.options.getString('date');
      const [day, month, year] = dobString.split('-').map(Number);
  
      if (!day || !month || !year) {
        return interaction.reply({ content: 'Invalid date format. Please use DD-MM-YYYY.', ephemeral: true });
      }
  
      const today = new Date();
      const birthDate = new Date(year, month - 1, day);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
  
      if (commandName === 'dob') {
        // ... (previous code for date parsing and age calculation)
      
        if (age >= 18) {
          // User is verified to be 18 or older
          // Find the role by its name "NSFW Access"
          const nsfwRole = interaction.guild.roles.cache.find(role => role.name === 'NSFW Access');
          if (nsfwRole) {
            // Add the role to the user
            await interaction.member.roles.add(nsfwRole);
          } else {
            console.error('NSFW Access role not found.');
          }
          interaction.reply({ content: 'You are verified to be 18 or older and have been granted NSFW Access!', ephemeral: true });
        } else {
          // User is not old enough
          interaction.reply({ content: 'Sorry, you must be 18 or older to be verified.', ephemeral: true });
        }
      }      
    }

    } catch (error) {
      console.error('An error occurred: ', error);
      interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }
});


client.login(token);
