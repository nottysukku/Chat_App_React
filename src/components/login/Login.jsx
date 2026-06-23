import { useState } from "react";
import "./login.css";
import { toast } from "react-toastify";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import upload from "../../lib/upload";
import { useUserStore } from "../../lib/userStore";

const Login = () => {
  const { loginGuest } = useUserStore();
  const [avatar, setAvatar] = useState({
    file: null,
    url: "",
  });

  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      return toast.warn("Please enter inputs!");
    }

    if (!avatar.file) {
      setLoading(false);
      return toast.warn("Please upload an avatar!");
    }

    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      const imgUrl = await upload(avatar.file);

      await setDoc(doc(db, "users", res.user.uid), {
        username,
        email,
        avatar: imgUrl,
        id: res.user.uid,
        blocked: [],
      });

      await setDoc(doc(db, "userchats", res.user.uid), {
        chats: [],
      });

      toast.success("Account created! You can login now!");
    } catch (err) {
      console.log(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.target);
    const { email, password } = Object.fromEntries(formData);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.log(err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setShowPassword(false);
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
              fill="#25D366"
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
        <p className="login__subtitle">
          {isRegisterMode
            ? "Sign up to start messaging"
            : "Sign in to continue"}
        </p>

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
                placeholder="Password"
                name="password"
                autoComplete="new-password"
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
              onClick={() => loginGuest()}
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
              onClick={() => loginGuest()}
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
