//chat-server.js

// Require the packages we will use:
const { Console } = require("console");
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
        const { roomName, roomCreator, isPrivate, password } = data;
        
        console.log('Is the room private?:', isPrivate);

        // Check if room already exists
        const roomExists = chatRooms.some(room => room.roomName === roomName);
        
        if (!roomExists) {
            const newChatRoom = {
                roomName,
                creator: roomCreator,
                isPrivate,
                password: isPrivate ? password : null,
                activeUsers: [], // roomCreator is added as the first user
                bannedUsers: [],
                raisedHands: []
            };
            chatRooms.push(newChatRoom);
            socket.emit('chat_room_created', { roomName, isPrivate });
            io.sockets.emit('chat_rooms_list', chatRooms);
        } else {
            // Emit an error to the room creator if room name is taken
            socket.emit('chat_room_creation_error', { message: 'Room name already taken.' });
        }
    });

    // join room event handler.
    socket.on('join_chat_room', function (data) {
        const { roomName, userName, password } = data;
        // Check if room exists and the user is not already in the room
        const room = chatRooms.find(room => room.roomName === roomName);
        if (room && !room.activeUsers.includes(userName)) {
            console.log(room.password + " " + password + " " + room.isPrivate + " " + roomName + " " + userName);
            if (room.isPrivate && room.password !== password) {
                // Emit an error if the room is private and the password is incorrect
                return socket.emit('join_room_error', { message: 'Incorrect password.' });
            } else {
                //room.bannedUsers.includes(userName)
                if (false){
                    return socket.emit('join_room_error', { message: 'You have been banned from this room.' });
                } else {
                    socket.join(roomName);
                    room.activeUsers.push(userName);
                    io.to(roomName).emit('user_joined_room', { userName, roomName });
                    // Emit updated active users list
                    io.to(roomName).emit('active_users', room.activeUsers, room);
                    socket.emit('joined_chat_room', { room, activeUsers: room.activeUsers });
                }
            }
        } else {
            // Emit an error if room does not exist or user is already in the room
            socket.emit('join_room_error', { message: 'Cannot join room, already in room.' });
        }
    });

    // leave room event handler.
    socket.on('leave_chat_room', function (data, callback) {
    const { roomName, userName } = data;
    const room = chatRooms.find(room => room.roomName === roomName);
    
    if (room) {
        if (room.activeUsers.includes(userName)) {
            room.activeUsers = room.activeUsers.filter(user => user !== userName);
            socket.leave(roomName);
            io.to(roomName).emit('user_left_room', { userName, roomName });
            io.to(roomName).emit('active_users', room.activeUsers, room);

            // Acknowledgment to the leaving user
            callback({ status: 'ok', message: `Left ${roomName}` });
        } else {
            // User was not in the room's activeUsers array
            callback({ status: 'error', message: `User ${userName} was not in ${roomName}` });
        }
    } else {
        // Room not found
        callback({ status: 'error', message: `Room ${roomName} not found` });
    }

    //handles kicking out users
    socket.on('kick_out_user', function (data) {
        const { roomName, userName } = data;
        const room = chatRooms.find(room => room.roomName === roomName);
        if (room) {
            if (room.activeUsers.includes(userName)) {
                room.activeUsers = room.activeUsers.filter(user => user !== userName);
                io.to(roomName).emit('user_left_room', { userName, roomName });
                io.to(roomName).emit('active_users', room.activeUsers, room);
            } else {
                // User was not in the room's activeUsers array
                callback({ status: 'error', message: `User ${userName} was not in ${roomName}` });
            }
        } else {
            // Room not found
            callback({ status: 'error', message: `Room ${roomName} not found` });
        }
    });

    // ban user functionality
    socket.on('ban_user', function (data, callback) {
        const { roomName, userName } = data;
        const room = chatRooms.find(room => room.roomName === roomName);
    
        if (!room) {
            // Handle the case where the room does not exist
            callback({ status: 'error', message: 'Room does not exist.' });
        } else if (room.bannedUsers && room.bannedUsers.includes(userName)) {
            // Continue with the ban user logic
            room.bannedUsers = room.bannedUsers.filter(user => user !== userName);
            io.to(roomName).emit('user_left_room', { userName, roomName });
            io.to(roomName).emit('active_users', room.activeUsers, room);
        } else {
            // Handle other cases as needed
            callback({ status: 'error', message: 'User is not banned.' });
        }
    });

    // raise hand functionality
    socket.on('raise_hand', function (data) {
        const { roomName, userName } = data;
        const room = chatRooms.find(room => room.roomName === roomName);
        if (room) {
            if (room.activeUsers.includes(userName)) {
                room.raisedHands.push(userName);

                // Emit the 'raised_hand' event to notify other users in the same room
                io.to(roomName).emit('raised_hand', { userName, roomName });

                // Emit the updated raised hands list to the user who raised their hand
                socket.emit('raised_hands', room.raisedHands, room);
            } else {
                // User was not in the room's activeUsers array
                callback({ status: 'error', message: `User ${userName} was not in ${roomName}` });
            }
        } else {
            // Room not found
            callback({ status: 'error', message: `Room ${roomName} not found` });
        }
    });

});
});

console.log("LISTENING ON PORT 3456");