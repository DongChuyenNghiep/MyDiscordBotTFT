import "dotenv/config";
import express from "express";
import { Client, GatewayIntentBits } from "discord.js";
import axios from "axios";
import { GUILD_ID, API_TEAMS, API_USERS, CHECK_INTERVAL } from "./config.js";

// Khởi tạo Discord bot
const TOKEN = process.env.DISCORD_TOKEN;
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ],
});

// Lưu dữ liệu team cũ để so sánh
let previousTeams = {};

async function fetchTeams() {
    try {
        const response = await axios.post(API_TEAMS, {}); 
        return response.data;
    } catch (error) {
        console.error("❌ Lỗi khi gọi API Teams:", error.message);
        return [];
    }
}

async function fetchUsers() {
    try {
        const response = await axios.post(API_USERS, {}); 
        return response.data;
    } catch (error) {
        console.error("❌ Lỗi khi gọi API Users:", error.message);
        return [];
    }
}

async function updateRoles(newTeams, updatedTeams) {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch();

    const users = await fetchUsers(); 

    for (const team of newTeams) {
        await assignRolesToTeam(team, users, guild);
    }

    for (const team of updatedTeams) {
        await updateTeamRoles(team, users, guild);
    }
}

async function assignRolesToTeam(team, users, guild) {
    const { teamName, gameMembers } = team;
    if (!gameMembers || !gameMembers["Teamfight Tactics"]) return;

    console.log(`\n🆕 Xử lý team mới: ${teamName}`);
    await fetchAllMembers(guild);

    const members = gameMembers["Teamfight Tactics"];
    for (const riotId of members) {
        console.log(`🔍 Tìm riotId: ${riotId}`);
        const user = users.find(u => u.riotId === riotId);
        if (!user) {
            console.log(`❌ Không tìm thấy user với riotId: ${riotId}`);
            continue;
        }

        console.log(`✅ RiotId ${riotId} khớp với Discord Username: ${user.discordID}`);
        const discordMember = guild.members.cache.find(member => member.user.username === user.discordID);
        if (!discordMember) {
            console.log(`⚠️ Không tìm thấy thành viên ${user.discordID} trong server.`);
            continue;
        }

        console.log(`✅ Thành viên ${discordMember.user.username} (${discordMember.user.id}) có trong server. Thêm role.`);
        let gameRole = await getOrCreateRole(guild, "TFT Championship Participants", "BLUE");
  

        await discordMember.roles.add([gameRole]);
        console.log(`✅ Đã thêm role "${teamName}" cho ${discordMember.user.username}`);
    }
}

async function fetchAllMembers(guild) {
    try {
        console.log("🔄 Fetching all members in the server...");
        await guild.members.fetch();
        console.log(`✅ Fetch hoàn tất! Tổng số thành viên: ${guild.memberCount}`);
    } catch (error) {
        console.error("❌ Lỗi khi fetch toàn bộ thành viên:", error);
    }
}

async function updateTeamRoles(team, users, guild) {
    const prevTeam = previousTeams[team._id];
    if (!prevTeam) return;

    const { teamName, gameMembers } = team;
    const oldTeamName = prevTeam.teamName;
    const oldMembers = prevTeam.gameMembers ? prevTeam.gameMembers["Teamfight Tactics"] || [] : [];

    if (!gameMembers || !gameMembers["Teamfight Tactics"]) return;
    const newMembers = gameMembers["Teamfight Tactics"];

    console.log(`\n🔄 Cập nhật team "${oldTeamName}" -> "${teamName}"`);
    await fetchAllMembers(guild);

    const newTeamRole = await getOrCreateRole(guild, teamName, "RED");
    if (!newTeamRole) return;

    for (const riotId of newMembers) {
        console.log(`🔍 Tìm riotId: ${riotId}`);
        const user = users.find(u => u.riotId === riotId);
        if (!user) {
            console.log(`❌ Không tìm thấy user với riotId: ${riotId}`);
            continue;
        }

        let discordMember = guild.members.cache.get(user.discordID) || 
                            guild.members.cache.find(member => member.user.username === user.discordID);
        if (!discordMember) continue;

        try {
            await discordMember.roles.add(newTeamRole);
            console.log(`✅ Đã thêm team mới "${teamName}" cho ${discordMember.user.username}`);
        } catch (error) {
            console.error(`❌ Lỗi khi add role "${teamName}" cho ${discordMember.user.username}:`, error);
        }
    }

    const oldTeamRole = guild.roles.cache.find(role => role.name === oldTeamName);
    if (oldTeamRole) {
        console.log(`🗑 Xóa role cũ "${oldTeamName}"`);
        await oldTeamRole.delete();
    }
    console.log(`✅ Hoàn tất cập nhật role cho team "${teamName}".`);
}

async function getOrCreateRole(guild, roleName, color) {
    let role = guild.roles.cache.find(r => r.name === roleName);
    if (!role) {
        try {
            role = await guild.roles.create({
                name: roleName,
                color: color === "RED" ? "#FF0000" : "#3498db",
                reason: "Auto-created for team update",
            });
            console.log(`✅ Role "${roleName}" đã được tạo.`);
        } catch (error) {
            console.error(`❌ Lỗi khi tạo role "${roleName}":`, error);
        }
    }
    return role;
}

async function checkForUpdates() {
    try {
        const teams = await fetchTeams();
        if (!teams || teams.length === 0) {
            console.log("❌ Không có dữ liệu team từ API.");
            return;
        }

        console.log(`🔍 Số team từ API: ${teams.length}`);
        const newTeams = teams.filter(team => !previousTeams[team._id]);
        const updatedTeams = teams.filter(team => previousTeams[team._id] && previousTeams[team._id].__v !== team.__v);

        if (newTeams.length > 0 || updatedTeams.length > 0) {
            await updateRoles(newTeams, updatedTeams);
        }

        previousTeams = teams.reduce((acc, team) => {
            acc[team._id] = team;
            return acc;
        }, {});
    } catch (error) {
        console.error("❌ Lỗi khi kiểm tra team mới:", error);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Bot is running!");
});

app.listen(PORT, () => {
    console.log(`🌐 Express server is running on port ${PORT}`);
});

// 🌍 Ping chính server của nó mỗi 10 giây để Render không đưa vào trạng thái ngủ
const SERVER_URL = `https://mydiscordbot-9v5s.onrender.com/`;

setInterval(() => {
    axios.get(SERVER_URL)
        .then(() => console.log("🔄 Ping chính server để giữ bot hoạt động"))
        .catch(err => console.error("❌ Lỗi khi ping server:", err.message));
}, 10000); // 10 giây

// Đăng nhập bot Discord
client.once("ready", async () => {
    console.log(`🤖 Bot đã đăng nhập với tên ${client.user.tag}`);
    const guild = await client.guilds.fetch(GUILD_ID);
    await fetchAllMembers(guild);
    setInterval(checkForUpdates, CHECK_INTERVAL);
});

client.login(TOKEN);