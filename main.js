const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder
} = require("discord.js");

const keepAlive = require("./keep_alive");

const TOKEN = process.env.TOKEN ? process.env.TOKEN.trim() : null;
const CLIENT_ID = process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : null;

if (!TOKEN || !CLIENT_ID) {
  console.log("❌ Missing TOKEN or CLIENT_ID in Replit Secrets");
  process.exit();
}

console.log(`✓ TOKEN loaded (length: ${TOKEN.length} characters)`);
console.log(`✓ CLIENT_ID loaded: ${CLIENT_ID}`);

let products = [
  { name: "YouTube Premium Yearly", description: "Full Time Warranty • 1 Year Access", price: 23 },
  { name: "Netflix Yearly", description: "2 Months Warranty • 1 Year Access", price: 15 }
];

const userSelections = new Map();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("shop")
    .setDescription("Show the Snowy Solutions shop panel")
    .setDMPermission(false),

  new SlashCommandBuilder()
    .setName("addproduct")
    .setDescription("Add a product to the shop")
    .addStringOption(opt => opt.setName("name").setDescription("Product name").setRequired(true))
    .addStringOption(opt => opt.setName("description").setDescription("Product description").setRequired(true))
    .addNumberOption(opt => opt.setName("price").setDescription("Product price").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✔ Commands registered!");
  } catch (err) {
    console.log(err);
  }
})();

function buildProductMenu() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId("product_menu")
    .setPlaceholder("Select a product to buy...");

  products.forEach((p, index) => {
    menu.addOptions({
      label: p.name,
      value: index.toString(),
      description: `$${p.price}`
    });
  });

  return new ActionRowBuilder().addComponents(menu);
}

function buildBuyButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("buy_now")
      .setLabel("Buy Now")
      .setStyle(ButtonStyle.Success)
  );
}

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "shop") {
      const embed = new EmbedBuilder()
        .setTitle("❄ Snowy Solutions Shop")
        .setDescription("Choose a product from the dropdown below.")
        .setColor("#00BFFF");

      return interaction.reply({
        embeds: [embed],
        components: [buildProductMenu(), buildBuyButton()]
      });
    }

    if (interaction.commandName === "addproduct") {
      const name = interaction.options.getString("name");
      const description = interaction.options.getString("description");
      const price = interaction.options.getNumber("price");

      products.push({ name, description, price });

      return interaction.reply(
        `✅ Added product:\n**${name}**\n${description}\n💰 $${price}`
      );
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "product_menu") {
    const index = parseInt(interaction.values[0]);
    const p = products[index];

    userSelections.set(interaction.user.id, p);

    const embed = new EmbedBuilder()
      .setTitle(p.name)
      .setDescription(`${p.description}\n\n💵 **$${p.price}**`)
      .setColor("#00BFFF");

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === "buy_now") {
    const p = userSelections.get(interaction.user.id);

    if (!p) {
      return interaction.reply({
        content: "❌ Please pick a product first.",
        ephemeral: true
      });
    }

    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    const category = guild.channels.cache.find(
      c => c.name.toLowerCase() === "tickets" && c.type === ChannelType.GuildCategory
    );

    if (!category) {
      return interaction.reply({
        content: "❌ Error: No 'Tickets' category found. Please ask an admin to create one.",
        ephemeral: true
      });
    }

    const permissionOverwrites = [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: interaction.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
      }
    ];

    guild.roles.cache.forEach(role => {
      if (role.permissions.has(PermissionFlagsBits.Administrator) ||
          role.permissions.has(PermissionFlagsBits.ManageChannels)) {
        permissionOverwrites.push({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
        });
      }
    });

    try {
      const channel = await guild.channels.create({
        name: `snowy-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: permissionOverwrites
      });

      await channel.send(
        `🎫 **New Ticket Created**\n` +
        `User: <@${interaction.user.id}>\n` +
        `Product: **${p.name}**\n` +
        `Price: **$${p.price}**\n\n` +
        `A staff member will assist you shortly.`
      );

      userSelections.delete(interaction.user.id);

      return interaction.reply({
        content: `🎫 Your ticket has been created: ${channel}`,
        ephemeral: true
      });
    } catch (error) {
      console.error("Error creating ticket channel:", error);
      return interaction.reply({
        content: "❌ Failed to create ticket. Please make sure the bot has 'Manage Channels' permission.",
        ephemeral: true
      });
    }
  }
});

keepAlive();
client.login(TOKEN);
console.log("✔ Bot is starting...");
