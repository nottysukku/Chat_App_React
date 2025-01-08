import { useState } from "react";
import "./login.css"; // Make sure to import the CSS file for styling
import { toast } from "react-toastify";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth, db } from "../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import upload from "../../lib/upload";
import { register } from "timeago.js";

const Login = () => {
  const [avatar, setAvatar] = useState({
    file: null,
    url: "",
  });

  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
 
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

    if (!username || !email || !password){
      setLoading(false);
      return toast.warn("Please enter inputs!");}

    if (!avatar.file){
      setLoading(false);
       return toast.warn("Please upload an avatar!");}

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
    
    
    const registerForm = document.getElementById("registerform");
    const loginForm = document.getElementById("loginform");
    if (isRegisterMode) {
      registerForm?.classList.add("jump");
      setTimeout(() => {
        registerForm?.classList.remove("jump");
      }, 400);
    }
     

      if (!isRegisterMode) {
        loginForm?.classList.add("jump");
        setTimeout(() => {
          loginForm?.classList.remove("jump");
        }, 400);
      }
    }

      return (
        <div className="login">
      <div
        className={`item-container ${isRegisterMode ? "show-register" : "show-login"}`}
      >
        <div className="item">
          <h2 id="eh2" style={{color:"#2f2d2d"}}>{isRegisterMode ? "Register Here" : "Welcome back,"}</h2>
          {isRegisterMode ? (
        <form id="registerform" onSubmit={handleRegister}>
          <label id="lable"  htmlFor="file">
            <img  src={avatar.url || "./avatar2.png"} alt="Avatar" />
            Upload an image
          </label>
          <input
            type="file"
            id="file"
            style={{ display: "none" }}
            onChange={handleAvatar}
          />
          <input id="inn" type="text" placeholder="Username" name="username" />
          <input id="inn" type="text" placeholder="Email" name="email" />
          <input id="inn" type="password" placeholder="Password" name="password" />
          <button disabled={loading}>
            {loading ? "Loading" : "Sign Up"}
          </button>
        </form>
          ) : (
        <form id="loginform" onSubmit={handleLogin}>
          <input id="inn" type="text" placeholder="Email" name="email" />
          <input id="inn" type="password" placeholder="Password" name="password" />
          <button disabled={loading}>
            {loading ? "Loading" : "Sign In"}
          </button>
        </form>
          )}
        </div>
        <button className="switch-btn" onClick={handleToggleMode}>
          {isRegisterMode
        ? "Already have an account? Login"
        : "Don't have an account? Register"}
        </button>
      </div>
        </div>
      );
};

export default Login;
