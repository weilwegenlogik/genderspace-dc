const { Client, GatewayIntentBits, REST, Routes, Intents, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, Events, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
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
  
  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.log(`Guild ${guildId} not found.`);
    return;
  }

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
          avatar: member.user.displayAvatarURL({ format: 'png', dynamic: true }), // Getting the full avatar URL
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

      // Find the role by its name "Member"
      const memberRole = member.guild.roles.cache.find(role => role.name === 'Member');

      if (memberRole) {
        // Add the role to the new member
        await member.roles.add(memberRole);
        console.log(`Assigned the 'Member' role to ${member.user.tag}`);
      } else {
        console.log("Role 'Member' not found.");
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

  // Create the /create-ticket-msg command
  await client.guilds.cache.get(guildId).commands.create({
    name: 'create-ticket-msg',
    description: 'Create the ticket msg.',
  });

  console.log('Commands registered!');
});

client.on('interactionCreate', async interaction => {
  try {
    const { commandName } = interaction;

    // Check if the interaction is a button
    if (interaction.isButton()) {
      console.log("Button interaction detected."); // Debugging
      // Check if the button's customId matches 'create-ticket'
      
      // Get the channel from the interaction's channel ID or some other identifier
      const ticketChannel = interaction.guild.channels.cache.get(interaction.channelId);

      // Define roles that are allowed to close or delete tickets
      const allowedRoles = ['Supporter', 'Moderator', 'Administrator'];

      // Check if the member has one of the allowed roles

      // Validate all roles and users
      const everyoneRole = interaction.guild.roles.everyone;
      const userId = interaction.user.id;
      const clientId = interaction.user.id;
      const supporterOrModeratorRole = interaction.guild.roles.cache.find(r => r.name === 'Supporter' || r.name === 'Moderator');

      if (!everyoneRole || !userId || !clientId || !supporterOrModeratorRole) {
        console.error('Missing role or user IDs');
        return;
      }

      const hasPermission = interaction.member.roles.cache.some(role => allowedRoles.includes(role.name));

      if (interaction.customId === 'delete-ticket' || interaction.customId === 'close-ticket') {
        if (hasPermission) {
          if (interaction.customId === 'delete-ticket') {
            ticketChannel.delete();
          } else if (interaction.customId === 'close-ticket') {
            ticketChannel.permissionOverwrites.set([
              { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
              { id: supporterOrModeratorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]);
            interaction.reply('Ticket has been closed.');
          }
        } else {
          interaction.reply('You do not have permission to perform this action.');
        }
      } else if (interaction.customId === 'resolve-ticket') {
        ticketChannel.permissionOverwrites.set([
          { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel] },
          { id: supporterOrModeratorRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]);
        interaction.reply('Ticket has been marked as resolved!');
      }
      



      if (interaction.customId === 'create-ticket') {
        console.log("Custom ID 'create-ticket' detected."); // Debugging

        try {
          const create_ticket_modal = new ModalBuilder()
          .setCustomId('create-ticket-modal')
          .setTitle('Create a New Ticket');
  
          const create_ticket_select_category = new TextInputBuilder()
          .setCustomId('ticket_category')
          .setLabel('Please describe the topic of your issue!')
          .setPlaceholder('e.g. Technical')
          .setStyle(TextInputStyle.Short);
  
          const create_ticket_select_priority = new TextInputBuilder()
          .setCustomId('ticket_priority')
          .setLabel('Please describe the urgency.')
          .setPlaceholder('High | Medium | Low')
          .setStyle(TextInputStyle.Short);

          const create_ticket_issue = new TextInputBuilder()
          .setCustomId('ticket_issue')
          .setLabel('Please describe your issue.')
          .setPlaceholder('e.g. How do I join the NSFW-channel?')
          .setStyle(TextInputStyle.Paragraph);
  
          const create_ticket_priority_row = new ActionRowBuilder()
            .addComponents(create_ticket_select_priority);
          const create_ticket_category_row = new ActionRowBuilder()
            .addComponents(create_ticket_select_category);
          const create_ticket_issue_row = new ActionRowBuilder()
            .addComponents(create_ticket_issue);
          
          create_ticket_modal.addComponents(create_ticket_category_row, create_ticket_priority_row, create_ticket_issue_row)

          await interaction.showModal(create_ticket_modal);
          console.log("Modal should have been shown."); // Debugging

        // Create a new text channel under the 'Support' category
        const supportCategory = interaction.guild.channels.cache.find(c => c.name === 'Support' && c.type === 'GUILD_CATEGORY');
  
        // Sanitize the username to make it suitable for a channel name
        const sanitizedUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, '');

        console.log("Sanitized Username:", sanitizedUsername); // Debugging line

        console.log("Creating channel with name:", `ticket-${sanitizedUsername}`); // Debugging line

        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${sanitizedUsername}`,
          type: 0,
          parent: '1159105764917510244',
          reason: 'Ticket Channel',
          permissionOverwrites: [
            { id: interaction.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.ManageChannels] },
            { id: interaction.guild.roles.cache.find(r => r.name === 'Supporter' || r.name === 'Moderator'), allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
          ],
        });

          console.log("Channel created:", ticketChannel.name); // Debugging line            
        } catch (err) {
          console.error("Error while showing modal: ", err); // Error handling for showModal
        }
  
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'create-ticket-modal') {
        
        // Retrieve the channel object; replace with your method of fetching the channel
        const ticketChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-_]/g, '')}`);
    
        // Extract modal data
        const topic = interaction.fields.getTextInputValue('ticket_category');
        const priority = interaction.fields.getTextInputValue('ticket_priority')
        const issue = interaction.fields.getTextInputValue('ticket_issue');

    
        // Send a message to the channel with the data from the modal
        if (ticketChannel) {
          interaction.reply({ content: `Ticket created successfully! ${ticketChannel}`, ephemeral: true });

          // TICKET BOT PREREQS
          const close_ticket = new ButtonBuilder()
          .setCustomId('close-ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔒');

          const delete_ticket = new ButtonBuilder()
          .setCustomId('delete-ticket')
          .setLabel('Delete Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✖️');

          const resolve_ticket = new ButtonBuilder()
          .setCustomId('resolve-ticket')
          .setLabel('Issue Resolved!')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✔️');

          const ticket_action_row = new ActionRowBuilder()
          .addComponents(resolve_ticket, close_ticket, delete_ticket);

          await ticketChannel.send({ components: [ticket_action_row] });


          // Send creation timestamp first
          const creationTime = Math.floor(Date.now() / 1000); // Get current time in seconds
          ticketChannel.send(`**Ticket created at:** <t:${creationTime}:F>`);

          ticketChannel.send(`New Ticket\n**Topic:**\n${topic}\n\n**Priority:**\n${priority}\n\n**Issue:**\n${issue}`);
        } else {
          console.error('Channel not found');  // Handle error appropriately
        }
      }
    }
    

    if (interaction.isCommand()) {
      if (commandName === 'create-ticket-msg') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "Sorry, only Admins can clear the whole channel.", ephemeral: true });
        }
        // TICKET BOT PREREQS
        const create_ticket = new ButtonBuilder()
        .setCustomId('create-ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📝');

        const create_ticket_row = new ActionRowBuilder()
          .addComponents(create_ticket);

        const channel = await client.channels.cache.get('1159105962691543090');
        await channel.send({ content: 'Need help? Create a ticket!', components: [create_ticket_row] });
      }

      if (commandName === 'clear') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: "Sorry, only Admins can clear the whole channel.", ephemeral: true });
        }
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
    }

    } catch (error) {
      console.error('An error occurred: ', error);
      interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
    }
});


client.login(token);
