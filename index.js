// ===================== IMPORTS =====================
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder
} = require("discord.js");
const schedule = require("node-schedule");
require("dotenv").config();

// Express pour Render (éviter shutdown)
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot is running ✅"));
app.listen(PORT, () => console.log(`🌐 Serveur web actif sur le port ${PORT}`));

// ===================== CONSTANTES =====================
const OWNER_ROLE = "1405636625236758549"; // rôle admin
const KEY_FILE_URL = "https://gofile.io/d/F331o8"; // fichier lié aux clés

// ===================== INIT CLIENT =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===================== POOLS DE CLÉS =====================
const keyPools = {
  key1day: ["1DAY-AAA-BBB", "1DAY-CCC-DDD", "1DAY-EEE-FFF"],
  key3days: ["3DAY-111-222", "3DAY-333-444", "3DAY-555-666"],
  key1month: ["1MO-XXX-YYY", "1MO-ZZZ-000"],
  keytest: ["TEST-1111", "TEST-2222"]
};

// ===================== CONFIG =====================
let config = {
  welcomeChannel: null,
  welcomeGif: "https://media.giphy.com/media/OkJat1YNdoD3W/giphy.gif",
  announceChannel: null,
  ticketChannel: null,
  scheduledHour: "12:00",
  programmeMessage: null
};

// ===================== COMMANDES =====================
const commands = [
  // Clés
  new SlashCommandBuilder().setName("key")
    .setDescription("Envoie une clé en DM à un utilisateur")
    .addUserOption(opt => opt.setName("user").setDescription("Utilisateur à qui envoyer").setRequired(true))
    .addStringOption(opt => opt.setName("type").setDescription("Type de clé").setRequired(true)
      .addChoices(
        { name: "1 jour", value: "key1day" },
        { name: "3 jours", value: "key3days" },
        { name: "1 mois", value: "key1month" },
        { name: "test", value: "keytest" }
      )
    ),

  // AddKey
  new SlashCommandBuilder()
    .setName("addkey")
    .setDescription("Ajoute une ou plusieurs clés à un type de clé")
    .addStringOption(opt => opt.setName("type").setDescription("Type de clé").setRequired(true)
      .addChoices(
        { name: "1 jour", value: "key1day" },
        { name: "3 jours", value: "key3days" },
        { name: "1 mois", value: "key1month" },
        { name: "test", value: "keytest" }
      )
    )
    .addStringOption(opt => opt.setName("keys").setDescription("Clés séparées par espace ou virgule").setRequired(true)),

  // Purge
  new SlashCommandBuilder().setName("purge")
    .setDescription("Supprime des messages")
    .addIntegerOption(opt => opt.setName("nombre").setDescription("Nombre de messages").setRequired(true)),

  // Say
  new SlashCommandBuilder().setName("say")
    .setDescription("Le bot répète ton message")
    .addStringOption(opt => opt.setName("message").setDescription("Message à répéter").setRequired(true)),

  // Close
  new SlashCommandBuilder().setName("close")
    .setDescription("Ferme le salon courant"),

  // Invites
  new SlashCommandBuilder().setName("invites")
    .setDescription("Montre les invitations d’un utilisateur")
    .addUserOption(opt => opt.setName("user").setDescription("Utilisateur").setRequired(true)),

  // Setup
  new SlashCommandBuilder().setName("setup")
    .setDescription("Configure le bot")
    .addChannelOption(opt => opt.setName("welcome").setDescription("Salon de bienvenue"))
    .addStringOption(opt => opt.setName("welcomegif").setDescription("Lien du gif de bienvenue"))
    .addChannelOption(opt => opt.setName("announce").setDescription("Salon d’annonces"))
    .addChannelOption(opt => opt.setName("tickets").setDescription("Salon panel tickets"))
    .addStringOption(opt => opt.setName("hour").setDescription("Heure des messages quotidiens (HH:MM)")),

  // Programme
  new SlashCommandBuilder().setName("programme")
    .setDescription("Envoie le message programmé")
    .addStringOption(opt => opt.setName("message").setDescription("Message à envoyer").setRequired(true)),
];

// ===================== READY =====================
client.once("ready", async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });

  console.log("✅ Commandes slash enregistrées !");
});

// ===================== INTERACTIONS =====================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (!interaction.member.roles.cache.has(OWNER_ROLE) && !["invites"].includes(commandName)) {
    return interaction.reply({ content: "❌ Tu n’as pas la permission.", ephemeral: true });
  }

  // ----- /key -----
  if (commandName === "key") {
    const user = interaction.options.getUser("user");
    const type = interaction.options.getString("type");

    if (!keyPools[type] || keyPools[type].length === 0)
      return interaction.reply({ content: "❌ Plus de clés dispo pour ce type.", ephemeral: true });

    const key = keyPools[type].shift();

    try {
      await user.send(`Salut ${user.username}, voici ta clé : \`${key}\`\nFichier : ${KEY_FILE_URL}`);
      await interaction.reply({ content: `✅ Clé envoyée en DM à ${user}`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Impossible d’envoyer le DM.", ephemeral: true });
    }
  }

  // ----- /addkey -----
  if (commandName === "addkey") {
    const type = interaction.options.getString("type");
    const keysRaw = interaction.options.getString("keys");
    const keysArray = keysRaw.split(/[\s,]+/).filter(k => k);

    if (!keyPools[type]) return interaction.reply({ content: "❌ Type de clé invalide.", ephemeral: true });

    keyPools[type].push(...keysArray);
    await interaction.reply({ content: `✅ ${keysArray.length} clés ajoutées au type ${type}.`, ephemeral: true });
  }

  // ----- /purge -----
  if (commandName === "purge") {
    const number = interaction.options.getInteger("nombre");
    if (number < 1 || number > 100) return interaction.reply({ content: "❌ Entre 1 et 100.", ephemeral: true });

    await interaction.channel.bulkDelete(number, true);
    await interaction.reply({ content: `✅ ${number} messages supprimés.`, ephemeral: true });
  }

  // ----- /say -----
  if (commandName === "say") {
    const msg = interaction.options.getString("message");
    await interaction.channel.send(msg);
    await interaction.reply({ content: "✅ Message envoyé.", ephemeral: true });
  }

  // ----- /close -----
  if (commandName === "close") {
    if (interaction.channel.deletable) {
      await interaction.reply({ content: "✅ Salon fermé.", ephemeral: true });
      await interaction.channel.delete();
    } else {
      await interaction.reply({ content: "❌ Impossible de supprimer ce salon.", ephemeral: true });
    }
  }

  // ----- /invites -----
  if (commandName === "invites") {
    const user = interaction.options.getUser("user");
    const invites = await interaction.guild.invites.fetch();
    const userInvites = invites.filter(i => i.inviter && i.inviter.id === user.id);

    let total = 0;
    userInvites.forEach(i => total += i.uses);

    const desc = userInvites.map(i => `🔗 ${i.code} → ${i.uses} uses`).join("\n") || "Aucune invite.";
    await interaction.reply(`📊 Invites de ${user} :\n${desc}\n\nTotal : **${total}**`);
  }

  // ----- /setup -----
  if (commandName === "setup") {
    const welcome = interaction.options.getChannel("welcome");
    const welcomeGif = interaction.options.getString("welcomegif");
    const announce = interaction.options.getChannel("announce");
    const tickets = interaction.options.getChannel("tickets");
    const hour = interaction.options.getString("hour");

    if (welcome) config.welcomeChannel = welcome.id;
    if (welcomeGif) config.welcomeGif = welcomeGif;
    if (announce) config.announceChannel = announce.id;
    if (tickets) config.ticketChannel = tickets.id;
    if (hour) config.scheduledHour = hour;

    await interaction.reply({ content: "✅ Configuration mise à jour !", ephemeral: true });
  }

  // ----- /programme -----
  if (commandName === "programme") {
    const message = interaction.options.getString("message");
    if (!config.announceChannel) return interaction.reply({ content: "❌ Aucun salon d’annonces configuré.", ephemeral: true });

    const channel = await interaction.guild.channels.fetch(config.announceChannel);
    if (!channel) return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });

    await channel.send(message);
    await interaction.reply({ content: "✅ Message envoyé dans le salon d’annonces.", ephemeral: true });
  }
});

// ===================== LOGIN =====================
client.login(process.env.TOKEN);
