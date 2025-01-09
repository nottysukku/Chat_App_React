import React, { useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Card, CardContent, CardMedia, Switch, Typography } from "@mui/material";
import "./darklightmode.css";
import Logoutbtn from "../logoutbtn/Logoutbtn";
export default function Darklightmode() {
  const [toggleDarkMode, setToggleDarkMode] = useState(false);

  const toggleDarkTheme = () => {
    setToggleDarkMode(!toggleDarkMode);
    document.body.style.backgroundImage = toggleDarkMode
        ?"url('/bg1.jpg')":"url('dark-background1.jpg')";
document.body.style.colorScheme = toggleDarkMode ? "light" : "dark";
   document.querySelectorAll("#container").forEach((element) => {
     element.style.backgroundColor = toggleDarkMode ? "rgba(17, 40, 19, 0.25)" : "rgba(17, 40, 19, 0.01)";
   });
   document.querySelector("#eh2").style.color = toggleDarkMode ? "white" : "black";
  const statusUser1 = document.getElementById("statususer1");
  if (statusUser1) {
    statusUser1.style.color = toggleDarkMode ? "white" : "black";
  }
  };

 

  return (
   
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
         {/* <Logoutbtn /> */}
        <img width={40} src="moonandsun-removebg-preview.png" alt="darkmode" />
        <Switch id="switch" checked={toggleDarkMode} onChange={toggleDarkTheme} />
 
       
       
      </div>
   
  );
}
