import React from 'react'
import { auth } from '../../lib/firebase';


import "./Logoutbtn.css";
const handleLogout = () => {
    auth.signOut();
    resetChat();
}
const Logoutbtn = () => {
  return (
    <>       
      <button className="btn-danger" onClick={handleLogout}>
        Logout
      </button>
    </>
  );
}

export default Logoutbtn;
