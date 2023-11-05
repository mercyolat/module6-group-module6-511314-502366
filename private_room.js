
// server side:
// join room event handler
socket.on('join_chat_room', function (data) {
    const { roomName, userName, password } = data;
    // Check if the room exists
    const room = chatRooms.find(room => room.roomName === roomName);

    if (room) {
        if (!room.isPrivate) {
            // If the room is not private, allow the user to join without a password
            socket.join(roomName);
            room.activeUsers.push(userName);
            io.to(roomName).emit('user_joined_room', { userName, roomName });
            // Emit updated active users list
            io.to(roomName).emit('active_users', room.activeUsers);
        } else {
            if (room.password === password) {
                // If the room is private and the password is correct, allow the user to join
                socket.join(roomName);
                room.activeUsers.push(userName);
                io.to(roomName).emit('user_joined_room', { userName, roomName });
                // Emit updated active users list
                io.to(roomName).emit('active_users', room.activeUsers);
            } else {
                // Password is incorrect
                socket.emit('join_room_error', { message: 'Incorrect password.' });
            }
        }
    } else {
        // Room not found
        socket.emit('join_room_error', { message: 'Room not found.' });
    }
});

//on the client side:
function joinChatRoom(roomName) {
    var userName = document.getElementById('username').value;

    // Check if the user is trying to join a different room than the current one
    if (currentChatRoom && currentChatRoom !== roomName) {
        socketio.emit('leave_chat_room', { roomName: currentChatRoom, userName }, function (ack) {
            console.log(ack.message);
            if (ack.status === 'ok') {
            }
        });
    }

    // Update currentChatRoom and UI regardless of whether it was the same room
    currentChatRoom = roomName;
    updateMessageTitle("Chat Room: " + roomName);
    socketio.emit('join_chat_room', { roomName, userName });

    if (isPrivateRoom(roomName)) {
        const passwordEntered = prompt('Enter the password for the private room:');
        if (passwordEntered !== null) {  // Check if the user canceled the prompt
            socketio.emit('join_chat_room', { roomName, userName, password: passwordEntered });
        }
    } else {
        // For public rooms, no password is required
        socketio.emit('join_chat_room', { roomName, userName });
    }

    updateActiveUsers([]); // Clear the list until the new list is populated
}

function isRoomPrivate(roomName) {
    const room = chatRooms.find(room => room.roomName === roomName);
    return room && room.isPrivate;
}
