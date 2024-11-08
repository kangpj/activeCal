#! /usr/bin/env node
const http = require('http');
const WebSocket = require('ws');
const express = require('express');
const app = express();
// votesManager is a separate module
const votesManager = require('./votesManager'); 

const users = {}; 
// key: userId(generated by client), 
// data: { departName, nickName, clientId }
const clients = [];
// key: websocket
// data: { IPaddress, secretNumber, clientId }
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let year = new Date().getFullYear();
let month = new Date().getMonth();
// votesManager.toggleVote(year, month);
let logSeq = 0;

wss.on('connection', (ws, req) => {

    // indivisual clients' properties
    const client = {};
    const currentClientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    let currentClientId = null;
    let currentUserDept = null;
    let currentUserNcik = null;

    console.log(`#${logSeq++} New client connected: ${currentClientId} from ${currentClientIP}` );
    
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            if (parsedMessage.type === 'init') {

                currentClientId = parsedMessage.data;
                client[currentClientId] = {
                    ws:             ws,
                    ip:             currentClientIP,
                    secretNumber:   generateClientSecret(currentClientId)
                    };
                clients.push(client);
                // The very first message with vote status to the newly connected client
                ws.send(JSON.stringify({
                    type: 'updateVotes',
                    data: votesManager.getDefaultDepartment() 
                }));
            } else if (parsedMessage.type === 'ping') {
                ws.send(JSON.stringify({
                    type: 'pong'
                }));
            } else if (parsedMessage.type === 'vote') {
                const { year, month, day, clientId, userId } = parsedMessage.data;
                console.log('Logging for debug:(vote) ', userId);

                // Register vote in votesManager
                // votesManager.toggleVote(year, month, day, userId);


                // Broadcast updated votes to all clients
                if (day === 0) {
                    // unicast
                    ws.send(JSON.stringify({
                        type: 'updateVotes',
                        data: votesManager.getAllVotes() // Send all months' votes
                    }));
                } else {
                    broadcastMessage({
                        type: 'updateVotes',
                        data: votesManager.getAllVotes()
                    });
                }
            } else if (parsedMessage.type === 'getStatistics') {
                const { year, month } = parsedMessage.data;
                const { theDay, theNumber } = votesManager.getMostVotedDayInMonth(year, month);
                // unicast
                ws.send(JSON.stringify({
                    type: 'updateVoteStatistic',
                    data: {votersTotal: votesManager.getUniqueVoters(),
                           availableTotal: theNumber, 
                           theDay: theDay}
                }));

            } else if (parsedMessage.type === 'signIn') {
                const { userId, department, nickname } = parsedMessage.data;
                users[userId] = {department, nickname, isManager: department === 'ulsanedu' && nickname === 'caconam' };
                currentUserId = userId;
                console.log('Logging for debug:(signIn) ', users[userId]);
                if (users[userId].isManager) {
                    ws.send(JSON.stringify({ type: 'managerAuthenticated' }));
                }
            } else if (parsedMessage.type === 'logout') {
                if (currentUserId) {
                    console.log('Logging for debug:(logout) ', currentUserId);
                    delete users[currentUserId];
                    currentUserId = null;
                }
            } else if (parsedMessage.type === 'resetVotes' && users[currentUserId]?.isManager) {
                votesManager.clearAllVotes();
                broadcastMessage({
                    type: 'updateVotes',
                    data: votesManager.getAllVotes()
                });
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => closeClient(ws, currentClientIP, currentClientId, client));
});

// Heartbeat function to keep connections alive
function heartbeat() {
    this.isAlive = true;
}

function closeClient(ws, ip, clientId, client) {

    const idx = clients.findIndex(function(item) {return item[clientId] === client}) 
    if (idx > -1) clients.splice(idx, 1)
    ws.terminate();
    console.log(`Client from ${ip} disconnected`);

}

// Generate a unique hidden number for client verification
function generateClientSecret(clientId) {
    const secretNumber = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
    //clientSecretNumbers.set(clientId, secretNumber);
    return secretNumber; // Provide this to the user to save for verification
}

// Verify the client secret number to confirm decoupling
function verifyAndDecouple(clientId, providedSecret) {
    const storedSecret = clientSecretNumbers.get(clientId);

    if (storedSecret && storedSecret === providedSecret) {
        usersData.delete(clientId); // Decouple the clientId and userId
        clientSecretNumbers.delete(clientId); // Clear the secret
        return true;
    } else {
        throw new Error('Invalid secret number. Cannot decouple.');
    }
}

function broadcastMessage(message) {
    const messageString = JSON.stringify(message);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageString);
        }
    });
}

// Serve static files (e.g., the frontend HTML and JS files)
app.use(express.static('public'));

// Start the server
server.listen(3000, () => {
    console.log('Server running on port 3000');
});


/*
let usersData = {}; // Stores { clientId: { token, userId, nickname, department, role } }

// Helper functions
function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function generateToken() {
    return crypto.randomBytes(24).toString('hex');
}

// Handle WebSocket connections
wss.on('connection', (ws) => {
    console.log('New client connected');

    // Step 1: Generate a clientId and token, send it to the client
    const clientId = generateId();
    const token = generateToken();
    usersData[clientId] = { token, role: 'guest' }; // Default role for new users

    ws.clientId = clientId; // Attach clientId to the WebSocket session
    ws.send(JSON.stringify({ type: 'init', clientId, token }));

    // Listen for messages from the client
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // Step 2: Initialize userId, nickname, etc., based on client response
        if (data.type === 'initializeUser' && data.clientId === ws.clientId) {
            const { uniqueUserId, nickname, department } = data;
            usersData[clientId] = {
                ...usersData[clientId],
                userId: uniqueUserId,
                nickname,
                department,
                role: department ? 'departmentUser' : 'guest',
            };
            console.log(`User initialized: ${JSON.stringify(usersData[clientId])}`);

            // Acknowledge successful initialization
            ws.send(JSON.stringify({ type: 'userInitialized', status: 'success' }));
        }
    });

    ws.on('close', () => {
        console.log(`Client with clientId ${ws.clientId} disconnected`);
        delete usersData[ws.clientId];
    });
});
*/
