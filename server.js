const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Socket.IO 配置 - 允许所有来源的跨域请求
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// 中间件
app.use(cors({
  origin: "*",
  credentials: false
}));
app.use(express.json());
app.use(express.static('.')); // 如果需要提供静态文件

// 存储实时连接状态
const connectedClients = new Map();
const roomData = new Map(); // 房间数据存储

// 健康检查端点
app.get('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    clients: connectedClients.size,
    rooms: roomData.size
  };
  res.status(200).json(healthData);
});

// 测试端点
app.get('/api/status', (req, res) => {
  res.json({
    message: 'WebSocket 服务运行正常',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id);
  connectedClients.set(socket.id, {
    id: socket.id,
    connectedAt: new Date(),
    rooms: new Set()
  });

  // 加入房间
  socket.on('join-room', (roomId, userData) => {
    if (!roomId) return;
    
    socket.join(roomId);
    const client = connectedClients.get(socket.id);
    if (client) {
      client.rooms.add(roomId);
    }
    
    // 初始化房间数据
    if (!roomData.has(roomId)) {
      roomData.set(roomId, {
        users: new Map(),
        activeSessions: new Map(),
        lastUpdate: Date.now()
      });
    }
    
    const room = roomData.get(roomId);
    room.users.set(socket.id, {
      ...userData,
      joinedAt: new Date(),
      lastHeartbeat: Date.now()
    });
    
    console.log(`用户 ${socket.id} 加入房间 ${roomId}`);
    
    // 通知房间内其他用户
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      userData,
      timestamp: Date.now()
    });
    
    // 发送当前房间状态给新用户
    socket.emit('room-state', {
      roomId,
      users: Array.from(room.users.values()),
      activeSessions: Array.from(room.activeSessions.values()),
      timestamp: Date.now()
    });
  });

  // 离开房间
  socket.on('leave-room', (roomId) => {
    if (roomId) {
      socket.leave(roomId);
      const client = connectedClients.get(socket.id);
      if (client) {
        client.rooms.delete(roomId);
      }
      
      const room = roomData.get(roomId);
      if (room) {
        room.users.delete(socket.id);
        room.activeSessions.delete(socket.id);
        
        // 如果房间为空，清理房间数据
        if (room.users.size === 0) {
          roomData.delete(roomId);
        }
      }
      
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        timestamp: Date.now()
      });
      
      console.log(`用户 ${socket.id} 离开房间 ${roomId}`);
    }
  });

  // 心跳检测
  socket.on('heartbeat', (data) => {
    const client = connectedClients.get(socket.id);
    if (client) {
      client.lastHeartbeat = Date.now();
    }
    
    // 更新房间内的心跳状态
    client?.rooms.forEach(roomId => {
      const room = roomData.get(roomId);
      if (room) {
        const user = room.users.get(socket.id);
        if (user) {
          user.lastHeartbeat = Date.now();
        }
      }
    });
    
    socket.emit('heartbeat-ack', {
      timestamp: Date.now(),
      serverTime: Date.now()
    });
  });

  // 开始计时器会话
  socket.on('start-session', (sessionData) => {
    const { roomId, taskId, taskData } = sessionData;
    if (!roomId || !taskId) return;
    
    const room = roomData.get(roomId);
    if (room) {
      room.activeSessions.set(socket.id, {
        userId: socket.id,
        taskId,
        taskData,
        startTime: Date.now(),
        isPaused: false,
        lastUpdated: Date.now()
      });
      
      // 广播给房间内其他用户
      socket.to(roomId).emit('session-started', {
        userId: socket.id,
        taskId,
        taskData,
        startTime: Date.now(),
        timestamp: Date.now()
      });
      
      console.log(`用户 ${socket.id} 在房间 ${roomId} 开始计时器会话`);
    }
  });

  // 暂停计时器会话
  socket.on('pause-session', (sessionData) => {
    const { roomId } = sessionData;
    if (!roomId) return;
    
    const room = roomData.get(roomId);
    if (room) {
      const session = room.activeSessions.get(socket.id);
      if (session) {
        session.isPaused = true;
        session.lastUpdated = Date.now();
        
        socket.to(roomId).emit('session-paused', {
          userId: socket.id,
          timestamp: Date.now()
        });
        
        console.log(`用户 ${socket.id} 在房间 ${roomId} 暂停计时器会话`);
      }
    }
  });

  // 继续计时器会话
  socket.on('resume-session', (sessionData) => {
    const { roomId } = sessionData;
    if (!roomId) return;
    
    const room = roomData.get(roomId);
    if (room) {
      const session = room.activeSessions.get(socket.id);
      if (session) {
        session.isPaused = false;
        session.lastUpdated = Date.now();
        
        socket.to(roomId).emit('session-resumed', {
          userId: socket.id,
          timestamp: Date.now()
        });
        
        console.log(`用户 ${socket.id} 在房间 ${roomId} 继续计时器会话`);
      }
    }
  });

  // 停止计时器会话
  socket.on('stop-session', (sessionData) => {
    const { roomId } = sessionData;
    if (!roomId) return;
    
    const room = roomData.get(roomId);
    if (room) {
      room.activeSessions.delete(socket.id);
      
      socket.to(roomId).emit('session-stopped', {
        userId: socket.id,
        timestamp: Date.now()
      });
      
      console.log(`用户 ${socket.id} 在房间 ${roomId} 停止计时器会话`);
    }
  });

  // 数据同步
  socket.on('sync-data', (syncData) => {
    const { roomId, data, syncMeta } = syncData;
    if (!roomId) return;
    
    // 广播同步数据给房间内其他用户
    socket.to(roomId).emit('data-synced', {
      fromUser: socket.id,
      data,
      syncMeta: {
        ...syncMeta,
        serverTime: Date.now(),
        serverVersion: '1.0.0'
      },
      timestamp: Date.now()
    });
    
    console.log(`用户 ${socket.id} 在房间 ${roomId} 同步数据`);
  });

  // 断开连接处理
  socket.on('disconnect', (reason) => {
    console.log('用户断开连接:', socket.id, '原因:', reason);
    
    // 清理房间数据
    const client = connectedClients.get(socket.id);
    if (client) {
      client.rooms.forEach(roomId => {
        const room = roomData.get(roomId);
        if (room) {
          room.users.delete(socket.id);
          room.activeSessions.delete(socket.id);
          
          // 通知房间内其他用户
          socket.to(roomId).emit('user-disconnected', {
            userId: socket.id,
            reason,
            timestamp: Date.now()
          });
          
          // 如果房间为空，清理房间数据
          if (room.users.size === 0) {
            roomData.delete(roomId);
          }
        }
      });
    }
    
    connectedClients.delete(socket.id);
  });

  // 错误处理
  socket.on('error', (error) => {
    console.error('Socket 错误:', socket.id, error);
  });
});

// 定期清理过期连接
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5分钟超时
  
  for (const [clientId, client] of connectedClients.entries()) {
    if (now - client.lastHeartbeat > timeout) {
      console.log('清理过期连接:', clientId);
      connectedClients.delete(clientId);
      
      // 清理房间数据
      client.rooms.forEach(roomId => {
        const room = roomData.get(roomId);
        if (room) {
          room.users.delete(clientId);
          room.activeSessions.delete(clientId);
          
          if (room.users.size === 0) {
            roomData.delete(roomId);
          }
        }
      });
    }
  }
}, 60000); // 每分钟检查一次

const PORT = process.env.PORT || 80;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 WebSocket 服务运行在端口 ${PORT}`);
  console.log(`📊 健康检查端点: http://localhost:${PORT}/health`);
  console.log(`🔗 API 状态端点: http://localhost:${PORT}/api/status`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('接收到 SIGTERM 信号，开始优雅关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('接收到 SIGINT 信号，开始优雅关闭...');
  server.close(() => {
    console.log('服务已关闭');
    process.exit(0);
  });
});