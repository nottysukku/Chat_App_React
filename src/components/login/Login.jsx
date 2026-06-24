import { useState } from "react";
import "./login.css";
import { toast } from "react-toastify";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import upload from "../../lib/upload";
import { useUserStore } from "../../lib/userStore";

const Login = () => {
  const { loginGuest, signupLocal, loginLocal } = useUserStore();
  const [avatar, setAvatar] = useState({
    file: null,
    url: "",
  });

  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false); // Option to force offline SQLite
  const [activeTheme, setActiveTheme] = useState(localStorage.getItem("chat_app_theme") || "theme-green");

  const themes = [
    { id: "theme-green", color: "#00a884", label: "Classic Teal" },
    { id: "theme-blue", color: "#34b7f1", label: "Cobalt Ocean" },
    { id: "theme-purple", color: "#a29bfe", label: "Royal Amethyst" },
    { id: "theme-amber", color: "#f39c12", label: "Desert Sunset" },
    { id: "theme-darkgreen", color: "#1b4332", label: "Forest Grove" }
  ];

  const handleThemeSelect = (themeId) => {
    setActiveTheme(themeId);
    localStorage.setItem("chat_app_theme", themeId);
    document.documentElement.className = themeId;
    toast.info(`Theme changed to ${themeId.replace("theme-", "")}`);
  };

  const handleAvatar = (e) => {
    if (e.target.files[0]) {
      setAvatar({
        file: e.target.files[0],
        url: URL.createObjectURL(e.target.files[0]),
      });
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.target);
    const { username, email, password } = Object.fromEntries(formData);

    if (!username || !email || !password) {
      setLoading(false);
      return toast.warn("Please enter all fields!");
    }

    if (username.trim().length < 2) {
      setLoading(false);
      return toast.warn("Username must be at least 2 characters.");
    }

    if (password.length < 6) {
      setLoading(false);
      return toast.warn("Password must be at least 6 characters.");
    }

    if (!avatar.file) {
      setLoading(false);
      return toast.warn("Please upload an avatar photo!");
    }

    if (isOfflineMode) {
      // Local SQLite registration
      try {
        const reader = new FileReader();
        reader.readAsDataURL(avatar.file);
        reader.onloadend = async () => {
          const avatarBase64 = reader.result;
          const success = await signupLocal(username, email, password, avatarBase64);
          if (success) {
            await loginLocal(email, password);
          }
          setLoading(false);
        };
        reader.onerror = () => {
          toast.error("Failed to process local profile avatar picture.");
          setLoading(false);
        };
      } catch (err) {
        console.error(err);
        toast.error("An error occurred during local registration.");
        setLoading(false);
      }
      return;
    }

    // Standard Firebase Cloud registration
    let createdAuthUser = null;
    try {
      // Upload image first to avoid race condition on user auth state change
      const imgUrl = await upload(avatar.file);

      const res = await createUserWithEmailAndPassword(auth, email, password);
      createdAuthUser = res.user;

      await setDoc(doc(db, "users", res.user.uid), {
        username,
        email: email.toLowerCase(),
        avatar: imgUrl,
        id: res.user.uid,
        blocked: [],
        status: "Hey! I am using ChatApp."
      });

      await setDoc(doc(db, "userchats", res.user.uid), {
        chats: [],
      });

      // Trigger manual store fetch to log the user in immediately
      await useUserStore.getState().fetchUserInfo(res.user.uid);
      toast.success(`Welcome to ChatApp, ${username}! 🎉`);
    } catch (err) {
      console.error(err);
      // If Firestore write failed AFTER Auth user was created, delete the dangling Auth account
      if (createdAuthUser && (err.code === "permission-denied" || err.message?.includes("permissions"))) {
        try { await deleteUser(createdAuthUser); } catch (_) {}
        toast.error("⚠️ Firestore permissions error! Please ask the admin to update the Firestore Security Rules to allow authenticated writes. See console for details.");
      } else {
        toast.error(friendlyAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Map Firebase error codes → human-readable messages
  const friendlyAuthError = (err) => {
    switch (err.code) {
      case "auth/weak-password":         return "Password must be at least 6 characters.";
      case "auth/email-already-in-use":  return "This email is already registered. Try signing in instead.";
      case "auth/invalid-email":         return "Please enter a valid email address.";
      case "auth/user-not-found":        return "No account found with this email. Please sign up first.";
      case "auth/wrong-password":        return "Incorrect password. Please try again.";
      case "auth/too-many-requests":     return "Too many failed attempts. Please wait a moment and try again.";
      case "auth/network-request-failed":return "Network error. Please check your internet connection.";
      case "permission-denied":          return "⚠️ Firestore permissions blocked the request. Update your Firestore Security Rules in Firebase Console.";
      default:
        if (err.message?.includes("permissions")) {
          return "⚠️ Firestore Security Rules are blocking this action. Go to Firebase Console → Firestore → Rules and allow authenticated reads/writes.";
        }
        return err.message || "An unexpected error occurred. Please try again.";
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);

    if (!email || !password) {
      setLoading(false);
      return toast.warn("Please enter email and password!");
    }

    if (isOfflineMode) {
      // Local SQLite sign in
      try {
        await loginLocal(email, password);
      } catch (err) {
        console.error(err);
        toast.error("Offline sign in failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Standard Firebase Cloud sign in
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Ensure we are NOT in local mode after a successful Firebase sign-in
      localStorage.setItem("is_local_mode", "false");
      localStorage.removeItem("local_current_user");
      toast.success("Signed in successfully!");
    } catch (err) {
      console.error(err);
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setShowPassword(false);
  };

  // When user switches from offline → cloud mode, clear the stale local flag
  const handleOfflineModeToggle = (checked) => {
    setIsOfflineMode(checked);
    if (!checked) {
      // Switching to Cloud mode — clear any stale local session
      localStorage.removeItem("is_local_mode");
      localStorage.removeItem("local_current_user");
    }
  };

  return (
    <div className="login">
      {/* Branding */}
      <div className="login__brand">
        <div className="login__logo">
          <svg viewBox="0 0 39 39" width="39" height="39" fill="none">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M19.5 0C8.73 0 0 8.73 0 19.5 0 23.52 1.26 27.27 3.45 30.36L1.19 37.62 8.73 35.4C11.7 37.35 15.45 38.97 19.5 38.97 30.27 38.97 39 30.27 39 19.5S30.27 0 19.5 0zm9.75 27.69c-.42 1.17-2.43 2.16-3.39 2.31-.87.12-1.98.18-3.18-.21-1.05-.3-2.28-.78-3.93-1.53-6.57-3-10.86-9.63-11.19-10.08-.33-.42-2.67-3.57-2.67-6.78 0-3.24 1.68-4.83 2.28-5.49.6-.63 1.29-.78 1.71-.78.42 0 .87.03 1.23.06.42.03.96-.15 1.5 1.14.54 1.32 1.86 4.53 2.01 4.86.18.33.27.72.06 1.14-.21.45-.33.72-.63 1.08-.33.39-.66.84-.96 1.14-.33.33-.66.66-.27 1.32.36.63 1.65 2.73 3.54 4.41 2.43 2.19 4.5 2.85 5.13 3.18.63.33 1.02.27 1.38-.18.39-.42 1.62-1.89 2.07-2.55.42-.63.87-.54 1.47-.33.6.24 3.81 1.8 4.47 2.13.63.33 1.08.48 1.23.75.18.3.18 1.62-.24 2.79z"
              fill="var(--wa-teal)"
            />
          </svg>
        </div>
        <h1 className="login__app-name">WhatsApp</h1>
      </div>

      {/* Card */}
      <div className="login__card">
        <h2 className="login__title">
          {isRegisterMode ? "Create Account" : "Welcome Back"}
        </h2>
        
        {/* Theme Picker inside Login Card */}
        <div className="login__theme-picker">
          {themes.map(t => (
            <button
              key={t.id}
              className={`login__theme-dot ${activeTheme === t.id ? "login__theme-dot--active" : ""}`}
              style={{ backgroundColor: t.color }}
              onClick={() => handleThemeSelect(t.id)}
              title={t.label}
              type="button"
            />
          ))}
        </div>

        <p className="login__subtitle">
          {isRegisterMode
            ? "Sign up to start messaging"
            : "Sign in to continue"}
        </p>

        {/* Offline Mode Switch */}
        <div className="login__offline-toggle">
          <label className="login__switch">
            <input
              type="checkbox"
              checked={isOfflineMode}
              onChange={(e) => handleOfflineModeToggle(e.target.checked)}
            />
            <span className="login__slider"></span>
          </label>
          <span className="login__offline-label">
            {isOfflineMode ? "Offline Mode (SQLite/Local)" : "Cloud Mode (Firebase)"}
          </span>
        </div>

        {/* Register Form */}
        {isRegisterMode ? (
          <form className="login__form" onSubmit={handleRegister}>
            {/* Avatar Upload */}
            <label className="login__avatar-upload" htmlFor="file">
              <img
                className="login__avatar-preview"
                src={avatar.url || "./avatar2.png"}
                alt="Avatar"
              />
              <span className="login__avatar-text">
                {avatar.file ? "Change photo" : "Upload a photo"}
              </span>
            </label>
            <input
              type="file"
              id="file"
              style={{ display: "none" }}
              onChange={handleAvatar}
              accept="image/*"
            />

            <input
              className="login__input"
              type="text"
              placeholder="Username"
              name="username"
              autoComplete="username"
            />
            <input
              className="login__input"
              type="email"
              placeholder="Email"
              name="email"
              autoComplete="email"
            />
            <div className="login__password-field">
              <input
                className="login__input"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min. 6 characters)"
                name="password"
                autoComplete="new-password"
                minLength={6}
              />
              <button
                type="button"
                className="login__password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <button
              className="login__submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="login__spinner" />
              ) : (
                "Sign Up"
              )}
            </button>
            <button
              className="login__guest-btn"
              type="button"
              onClick={() => loginGuest(isOfflineMode)}
              disabled={loading}
            >
              Sign In as Guest
            </button>
          </form>
        ) : (
          /* Login Form */
          <form className="login__form" onSubmit={handleLogin}>
            <input
              className="login__input"
              type="email"
              placeholder="Email"
              name="email"
              autoComplete="email"
            />
            <div className="login__password-field">
              <input
                className="login__input"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                name="password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login__password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <button
              className="login__submit-btn"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <span className="login__spinner" />
              ) : (
                "Sign In"
              )}
            </button>
            <button
              className="login__guest-btn"
              type="button"
              onClick={() => loginGuest(isOfflineMode)}
              disabled={loading}
            >
              Sign In as Guest
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="login__divider">
          <span className="login__divider-line" />
          <span className="login__divider-text">or</span>
          <span className="login__divider-line" />
        </div>

        {/* Switch mode button */}
        <button className="login__switch-btn" onClick={handleToggleMode}>
          {isRegisterMode
            ? "Already have an account? Sign In"
            : "Don't have an account? Sign Up"}
        </button>
      </div>
    </div>
  );
};

export default Login;
