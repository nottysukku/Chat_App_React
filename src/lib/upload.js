import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "./firebase"; 

const upload = async (file, onProgress) => {
  // Check if file is a Blob (like audio)
  let fileToUpload = file;
  let folder = "images/";  // Default folder for images

  if (file instanceof Blob) {
    // If the file is a Blob (audio), create a virtual file for it
    const timestamp = new Date().getTime();
    const audioFileName = `audio_${timestamp}.webm`; // Custom filename for audio files
    fileToUpload = new File([file], audioFileName, { type: "audio/webm" }); // Create a virtual file with the appropriate MIME type
    folder = "audio/";  // Set folder to 'audio/' for audio files
  } else if (file.type.startsWith("audio/")) {
    // If the file is already an audio file, set the folder
    folder = "audio/";
  } else if (file.type.startsWith("image/")) {
    // If it's an image, use the default folder "images/"
    folder = "images/";
  }

  const date = new Date();
  const storageRef = ref(storage, `${folder}${date.getTime()}_${fileToUpload.name}`);

  const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log("Upload is " + progress + "% done");
        if (onProgress) onProgress(progress); // Notify progress
      },
      (error) => {
        reject("Something went wrong! " + error.code);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          resolve(downloadURL); // Resolve with the download URL
        });
      }
    );
  });
};

export default upload;
