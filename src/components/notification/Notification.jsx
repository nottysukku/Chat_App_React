import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Notification = () => {
  return (
    <div className=''>
      <ToastContainer 
        style={{ position: "absolute", width: "100%", maxWidth: "400px" }} 
        position="bottom-left"
      />
    </div>
  )
}

export default Notification