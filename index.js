// ===================== PANEL DE TICKETS =====================
const { ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits } = require("discord.js");

// IDs des rôles qui auront accès aux tickets
const TICKET_ROLES = [
  "1405636625236758549",
  "1405927995188969623",
  "1405636625211588717",
  "1405636625211588715",
  "1405636625211588710"
];

// Salon où le panel sera envoyé
const TICKET_PANEL_CHANNEL_ID = config.ticketChannel; // à configurer via /setup

// Fonction pour créer le panel
async function sendTicketPanel() {
  if (!TICKET_PANEL_CHANNEL_ID) return console.log("Salon de panel non configuré.");
  const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
  if (!channel) return console.log("Salon panel introuvable.");

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("ticket_select")
      .setPlaceholder("Ouvre un ticket")
      .addOptions([
        { label: "Buy", value: "buy", emoji: "💲" },
        { label: "Help", value: "help", emoji: "❓" },
        { label: "Hwid", value: "hwid", emoji: "🔧" },
        { label: "Media", value: "media", emoji: "📷" }
      ])
  );

  await channel.send({
    content: "🎫 Ouvre un ticket via le menu ci-dessous :",
    components: [row]
  });
}

// Événement interaction pour le select menu
client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ticket_select") return;

  const reason = interaction.values[0]; // buy, help, hwid, media
  const guild = interaction.guild;

  // Création d'une catégorie si elle n'existe pas
  let category = guild.channels.cache.find(c => c.name === "🎫 Tickets" && c.type === 4); // type 4 = category
  if (!category) {
    category = await guild.channels.create({
      name: "🎫 Tickets",
      type: 4
    });
  }

  // Numérotation des tickets
  const ticketNumber = guild.channels.cache.filter(c => c.parentId === category.id).size + 1;

  // Création du salon du ticket
  const ticketChannel = await guild.channels.create({
    name: `${ticketNumber}-${reason}`,
    type: 0, // type 0 = text
    parent: category.id,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }, // tout le monde interdit
      ...TICKET_ROLES.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ]
  });

  await ticketChannel.send(`🎫 Ticket ouvert pour **${reason.toUpperCase()}** par <@${interaction.user.id}>.`);
  await interaction.reply({ content: `✅ Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
});

// Envoi automatique du panel au démarrage
client.once("ready", async () => {
  await sendTicketPanel();
});
