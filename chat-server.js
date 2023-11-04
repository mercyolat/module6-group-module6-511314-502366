//chat-server.js

// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(http, {
    wsEngine: 'ws'
});

const chatRooms = [
    { roomName: 'Room 1', creator: 'Admin', activeUsers: ['Admin'] },
    { roomName: 'Room 2', creator: 'Admin', activeUsers: ['Admin'] },
    { roomName: 'Room 3', creator: 'Admin', activeUsers: ['Admin'] }
];

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    // This callback runs when a new Socket.IO connection is established.
    socket.emit('chat_rooms_list', chatRooms);

    socket.on('message_to_server', function (data) {
        // This callback runs when the server receives a new message from the client.

        console.log("message: " + data["message"]); // log it to the Node.JS output
        io.sockets.emit("message_to_client", { message: data["message"] }) // broadcast the message to other users
    });
    
    socket.on('create_chat_room', function (data) {
        const { roomName, roomCreator } = data;
        // Check if room already exists
        const roomExists = chatRooms.some(room => room.roomName === roomName);
        if (!roomExists) {
            const newChatRoom = {
                roomName,
                creator: roomCreator,
                activeUsers: [roomCreator] // roomCreator is added as the first user
            };
            chatRooms.push(newChatRoom);
            socket.emit('chat_room_created', { roomName });
            io.sockets.emit('chat_rooms_list', chatRooms);
        } else {
            // Emit an error to the room creator if room name is taken
            socket.emit('chat_room_creation_error', { message: 'Room name already taken.' });
        }
    });
});

console.log("LISTENING ON PORT 3456");