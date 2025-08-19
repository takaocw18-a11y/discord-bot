// ===================== BOT TICKETS COMPLET =====================
require("dotenv").config();
const fs = require("fs");
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    PermissionFlagsBits 
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message]
});

// ------------------ CONFIG ------------------
const TICKET_ROLES = [
    "1405636625236758549",
    "1405927995188969623",
    "1405636625211588717",
    "1405636625211588715",
    "1405636625211588710"
];

const TICKET_PANEL_CHANNEL_ID = "1407260852243136512"; // Remplace par ton salon
const PANEL_FILE = "./panel.json"; // Fichier pour stocker l'ID du panel

// ------------------ PANEL TICKETS ------------------
let panelMessageId;

try {
    panelMessageId = JSON.parse(fs.readFileSync(PANEL_FILE)).id;
} catch {
    panelMessageId = null;
}

async function sendTicketPanel() {
    const channel = await client.channels.fetch(TICKET_PANEL_CHANNEL_ID);
    if (!channel) return console.log("Salon panel introuvable.");

    // Vérifier si le message existe déjà
    if (panelMessageId) {
        const msg = await channel.messages.fetch(panelMessageId).catch(() => null);
        if (msg) return console.log("Panel déjà présent, rien à envoyer.");
    }

    // Créer le panel
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("🎫 Ouvre un ticket")
            .addOptions([
                { label: "Buy", value: "buy", emoji: "💲" },
                { label: "Help", value: "help", emoji: "❓" },
                { label: "Hwid", value: "hwid", emoji: "🔧" },
                { label: "Media", value: "media", emoji: "📷" }
            ])
    );

    const msg = await channel.send({ content: "🎫 Ouvre un ticket via le menu ci-dessous :", components: [row] });
    panelMessageId = msg.id;
    fs.writeFileSync(PANEL_FILE, JSON.stringify({ id: msg.id }));
    console.log("Panel envoyé et ID sauvegardé.");
}

// ------------------ INTERACTIONS ------------------
client.on("interactionCreate", async interaction => {
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
        const reason = interaction.values[0];
        const guild = interaction.guild;

        // Catégorie "Tickets"
        let category = guild.channels.cache.find(c => c.name === "🎫 Tickets" && c.type === 4);
        if (!category) category = await guild.channels.create({ name: "🎫 Tickets", type: 4 });

        // Numéro du ticket
        const ticketNumber = guild.channels.cache.filter(c => c.parentId === category.id).size + 1;

        // Création du salon ticket
        const ticketChannel = await guild.channels.create({
            name: `${ticketNumber}-${reason}`,
            type: 0,
            parent: category.id,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                ...TICKET_ROLES.map(roleId => ({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
                { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
            ]
        });

        // Bouton pour fermer le ticket
        const closeButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`close_ticket_${interaction.user.id}`)
                .setLabel("🔒 Fermer le ticket")
                .setStyle(ButtonStyle.Danger)
        );

        await ticketChannel.send({ 
            content: `🎫 Ticket ouvert pour **${reason.toUpperCase()}** par <@${interaction.user.id}>.`, 
            components: [closeButton] 
        });
        await interaction.reply({ content: `✅ Ton ticket a été créé : ${ticketChannel}`, ephemeral: true });
    }

    // ----- CLOSE TICKET -----
    if (interaction.isButton() && interaction.customId.startsWith("close_ticket_")) {
        const ticketOwnerId = interaction.customId.split("_")[2];
        const ticketChannel = interaction.channel;

        await interaction.reply({ content: "✅ Ticket fermé, envoi du transcript...", ephemeral: true });

        try {
            const messages = await ticketChannel.messages.fetch({ limit: 100 });
            const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            let transcript = `Transcript du ticket ${ticketChannel.name}\n\n`;
            sortedMessages.forEach(msg => {
                transcript += `[${new Date(msg.createdTimestamp).toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
            });

            const user = await client.users.fetch(ticketOwnerId);
            await user.send({ content: `Voici le transcript de ton ticket \`${ticketChannel.name}\`:\n\n\`\`\`\n${transcript}\n\`\`\`` });
        } catch (err) {
            console.log("Impossible d'envoyer le DM :", err.message);
        }

        setTimeout(() => ticketChannel.delete(), 5000);
    }
});

// ------------------ READY ------------------
client.once("ready", async () => {
    console.log(`Connecté en tant que ${client.user.tag}`);
    await sendTicketPanel();
});

// ------------------ LOGIN ------------------
client.login(process.env.TOKEN);
