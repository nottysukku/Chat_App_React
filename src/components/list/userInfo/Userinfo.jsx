import "./userInfo.css";
import { useUserStore } from "../../../lib/userStore";

const Userinfo = () => {
  const { currentUser } = useUserStore();

  return (
    <div className="userInfo">
      <div className="user">
        <img src={currentUser.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{currentUser.username}</h2>
      </div>
      <div className="icons">
        {/* Link to GitHub */}
        <a
          href="https://github.com/nottysukku"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-link"
        >
          <img src="./more.png" alt="More Options" />
        </a>

        {/* Placeholder for Video functionality */}
       

        {/* Link to To-Do List */}
        <a
          href="https://to-do-list-five-self.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="icon-link"
        >
          <img src="./edit.png" alt="Edit Profile" />
        </a>
      </div>
    </div>
  );
};

export default Userinfo;
