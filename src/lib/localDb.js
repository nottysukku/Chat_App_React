// SQLite-style Local Storage Database Driver for Guest/Offline Mode

class LocalDb {
  constructor() {
    this.init();
  }

  init() {
    // Migrate existing Unsplash images and add default passwords if stored in LocalStorage to prevent login issues
    try {
      const usersStr = localStorage.getItem("sqlite_users");
      if (usersStr) {
        const users = JSON.parse(usersStr);
        let updated = false;
        users.forEach(u => {
          if (u.avatar && u.avatar.includes("unsplash.com")) {
            u.avatar = "./avatar2.png";
            updated = true;
          }
          if (!u.password) {
            u.password = "password";
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem("sqlite_users", JSON.stringify(users));
        }
      }
      const storiesStr = localStorage.getItem("sqlite_stories");
      if (storiesStr && storiesStr.includes("unsplash.com")) {
        const stories = JSON.parse(storiesStr);
        stories.forEach(s => {
          if (s.userAvatar && s.userAvatar.includes("unsplash.com")) {
            s.userAvatar = "./avatar2.png";
          }
          if (s.content && s.content.includes("unsplash.com")) {
            s.content = "./bg1.jpg";
          }
        });
        localStorage.setItem("sqlite_stories", JSON.stringify(stories));
      }
    } catch (e) {
      console.error("Migration error:", e);
    }

    // Check and initialize "tables" in LocalStorage
    if (!localStorage.getItem("sqlite_users")) {
      const mockUsers = [
        {
          id: "alice_id",
          username: "Alice Smith",
          email: "alice@example.com",
          password: "password",
          avatar: "./avatar2.png",
          status: "🌸 Coding my life away...",
          blocked: [],
        },
        {
          id: "bob_id",
          username: "Bob Jones",
          email: "bob@example.com",
          password: "password",
          avatar: "./avatar2.png",
          status: "🏄‍♂️ Catching some waves",
          blocked: [],
        },
        {
          id: "gemini_ai_id",
          username: "Gemini AI",
          email: "gemini@google.com",
          password: "password",
          avatar: "./avatar2.png",
          status: "🤖 Always online, ready to help!",
          blocked: [],
        }
      ];
      localStorage.setItem("sqlite_users", JSON.stringify(mockUsers));
    }

    if (!localStorage.getItem("sqlite_chats")) {
      const mockChats = [
        {
          id: "welcome_chat_id",
          createdAt: Date.now(),
          messages: [
            {
              senderId: "gemini_ai_id",
              text: "Welcome to ChatApp! I'm Gemini, your AI assistant. You can chat with me here or toggle the AI button at the top header.",
              createdAt: new Date(Date.now() - 3600000).toISOString(),
            }
          ]
        }
      ];
      localStorage.setItem("sqlite_chats", JSON.stringify(mockChats));
    }

    if (!localStorage.getItem("sqlite_userchats")) {
      const mockUserchats = {
        "guest_user": {
          chats: [
            {
              chatId: "welcome_chat_id",
              lastMessage: "Welcome to ChatApp! I'm Gemini, your AI assistant.",
              receiverId: "gemini_ai_id",
              updatedAt: Date.now(),
              isSeen: true
            }
          ]
        },
        "gemini_ai_id": {
          chats: [
            {
              chatId: "welcome_chat_id",
              lastMessage: "Welcome to ChatApp! I'm Gemini, your AI assistant.",
              receiverId: "guest_user",
              updatedAt: Date.now(),
              isSeen: true
            }
          ]
        }
      };
      localStorage.setItem("sqlite_userchats", JSON.stringify(mockUserchats));
    }

    if (!localStorage.getItem("sqlite_stories")) {
      const mockStories = [
        {
          id: "story_1",
          userId: "alice_id",
          username: "Alice Smith",
          userAvatar: "./avatar2.png",
          content: "Enjoying a quiet cup of coffee this morning! ☕",
          type: "text",
          createdAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        },
        {
          id: "story_2",
          userId: "bob_id",
          username: "Bob Jones",
          userAvatar: "./avatar2.png",
          content: "./bg1.jpg",
          type: "image",
          createdAt: Date.now() - 2000000,
          expiresAt: Date.now() + 86400000 - 2000000,
        }
      ];
      localStorage.setItem("sqlite_stories", JSON.stringify(mockStories));
    }
  }

  // --- SQL / Query Emulation Layer ---
  query(sql, params = []) {
    console.log(`[Local SQLite Engine] Executing: "${sql}"`, params);
    const sqlUpper = sql.toUpperCase().trim();

    if (sqlUpper.startsWith("SELECT")) {
      return this._handleSelect(sql, params);
    } else if (sqlUpper.startsWith("INSERT")) {
      return this._handleInsert(sql, params);
    } else if (sqlUpper.startsWith("UPDATE")) {
      return this._handleUpdate(sql, params);
    } else if (sqlUpper.startsWith("DELETE")) {
      return this._handleDelete(sql, params);
    }
    return null;
  }

  _getTable(name) {
    const data = localStorage.getItem(`sqlite_${name}`);
    return data ? JSON.parse(data) : [];
  }

  _setTable(name, data) {
    localStorage.setItem(`sqlite_${name}`, JSON.stringify(data));
    // Dispatch event to trigger UI reactivity in other parts of the application
    window.dispatchEvent(new CustomEvent("local-db-update"));
  }

  _handleSelect(sql, params) {
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("FROM USERS")) {
      const users = this._getTable("users");
      if (sqlUpper.includes("WHERE ID =")) {
        const id = params[0] || sql.match(/id\s*=\s*['"]([^'"]+)['"]/i)?.[1];
        return users.filter(u => u.id === id);
      }
      return users;
    }

    if (sqlUpper.includes("FROM CHATS")) {
      const chats = this._getTable("chats");
      if (sqlUpper.includes("WHERE ID =")) {
        const id = params[0] || sql.match(/id\s*=\s*['"]([^'"]+)['"]/i)?.[1];
        return chats.filter(c => c.id === id);
      }
      return chats;
    }

    if (sqlUpper.includes("FROM STORIES")) {
      const stories = this._getTable("stories");
      // Filter out expired stories
      const now = Date.now();
      return stories.filter(s => s.expiresAt > now);
    }

    return [];
  }

  _handleInsert(sql, params) {
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("INSERT INTO USERS")) {
      const users = this._getTable("users");
      const [id, username, email, avatar, status] = params;
      const newUser = { id, username, email, avatar, status: status || "", blocked: [] };
      if (!users.some(u => u.id === id)) {
        users.push(newUser);
        this._setTable("users", users);
      }
      return true;
    }

    if (sqlUpper.includes("INSERT INTO CHATS")) {
      const chats = this._getTable("chats");
      const [id, createdAt] = params;
      const newChat = { id, createdAt: createdAt || Date.now(), messages: [] };
      chats.push(newChat);
      this._setTable("chats", chats);
      return true;
    }

    if (sqlUpper.includes("INSERT INTO STORIES")) {
      const stories = this._getTable("stories");
      const [id, userId, username, userAvatar, content, type, createdAt, expiresAt] = params;
      const newStory = { id, userId, username, userAvatar, content, type, createdAt, expiresAt };
      stories.push(newStory);
      this._setTable("stories", stories);
      return true;
    }

    return false;
  }

  _handleUpdate(sql, params) {
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("UPDATE CHATS")) {
      // Typically used to append messages or delete messages
      const chats = this._getTable("chats");
      const chatId = params[0];
      const chatIndex = chats.findIndex(c => c.id === chatId);
      if (chatIndex > -1) {
        if (sqlUpper.includes("SET MESSAGES =")) {
          chats[chatIndex].messages = params[1];
          this._setTable("chats", chats);
          return true;
        }
      }
    }
    return false;
  }

  _handleDelete(sql, params) {
    const sqlUpper = sql.toUpperCase();
    if (sqlUpper.includes("DELETE FROM CHATS")) {
      const chatId = params[0];
      let chats = this._getTable("chats");
      chats = chats.filter(c => c.id !== chatId);
      this._setTable("chats", chats);
      return true;
    }
    return false;
  }

  // --- Wrapper CRUD APIs for React components ---
  getUserChats(userId) {
    const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
    return userchats[userId]?.chats || [];
  }

  updateUserChats(userId, chatsArray) {
    const userchats = JSON.parse(localStorage.getItem("sqlite_userchats") || "{}");
    if (!userchats[userId]) userchats[userId] = {};
    userchats[userId].chats = chatsArray;
    localStorage.setItem("sqlite_userchats", JSON.stringify(userchats));
    window.dispatchEvent(new CustomEvent("local-db-update"));
  }

  createLocalChat(currentUser, selectedUser) {
    const chatId = `chat_${Date.now()}`;
    // Insert chat
    this.query("INSERT INTO chats (id, createdAt) VALUES (?, ?)", [chatId, Date.now()]);

    // Update userchats for currentUser
    const currentUserChats = this.getUserChats(currentUser.id);
    currentUserChats.push({
      chatId,
      lastMessage: "",
      receiverId: selectedUser.id,
      updatedAt: Date.now(),
      isSeen: true
    });
    this.updateUserChats(currentUser.id, currentUserChats);

    // Update userchats for selectedUser
    const selectedUserChats = this.getUserChats(selectedUser.id);
    selectedUserChats.push({
      chatId,
      lastMessage: "",
      receiverId: currentUser.id,
      updatedAt: Date.now(),
      isSeen: false
    });
    this.updateUserChats(selectedUser.id, selectedUserChats);

    return chatId;
  }
}

export const localDb = new LocalDb();
