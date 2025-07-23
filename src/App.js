import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';

// Backend address - Read from environment variable injected by Amplify
// During local development, you can set REACT_APP_BACKEND_URL in a .env.local file
// or directly use "http://localhost:4000" if running locally.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

// Initialize socket connection
const socket = io(BACKEND_URL);

function App() {
  const [storedTime, setStoredTime] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [originalDisplayUrl, setOriginalDisplayUrl] = useState("");
  const [blurredImageUrl, setBlurredImageUrl] = useState("");

  //Socket.IO connection logging
  useEffect(() => {
    socket.on('connect', () => {
      console.log('✅ Frontend Socket.IO connected!');
      console.log('Socket ID:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('❌ Frontend Socket.IO disconnected!');
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ Frontend Socket.IO connection error:', err);
    });

    // ... (rest of your useEffect content for "time-ready", "image-blurred" etc.)
    // Make sure to return a cleanup function for these new listeners too
    return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        // ... (rest of your existing cleanup)
        socket.off("time-ready");
        socket.off("image-blurred");
        socket.off("image-uploaded-to-s3");
    };
  }, []);
  
  // Function to fetch a presigned URL for display
  const fetchDisplayUrl = async (key) => {
      try {
          const response = await axios.get(`${BACKEND_URL}/get-image-url?key=${key}`);
          return response.data.url;
      } catch (error) {
          console.error(`Error fetching display URL for ${key}:`, error);
          return ""; // Return empty string on error
      }
  };

  const handleClick = async () => {
    try {
      await axios.post(`${BACKEND_URL}/store-time`);
      alert("Time stored successfully!");
    } catch (err) {
      console.error("Error storing time:", err);
      alert("Failed to store time, try again.");
    }
  };

  const handleUpload = async () => {
    if (!imageFile) {
      alert("Please select an image first");
      return;
    }

  try {
    // 1. Get presigned URL from backend
    const uploadUrlResponse = await axios.get(`${BACKEND_URL}/get-upload-url`);
    // Store the fileName from the backend's response!
    const { url: uploadUrl, fileName: receivedFileName } = uploadUrlResponse.data;
  
    // For displaying the original image URL in the UI
    setUploadedImageUrl(uploadUrl.split("?")[0]);
  
    // Log the fileName received from backend for debugging
    console.log("Frontend: Received fileName from backend:", receivedFileName);
  
    // 2. Upload image directly to S3 using the presigned URL
    await axios.put(uploadUrl, imageFile, {
      headers: {
        "Content-Type": imageFile.type,
      },
    });
  
    // 3. After successful S3 upload, inform backend via socket with the CORRECT fileName
    // 💥 MAKE SURE you use 'receivedFileName' here!
    socket.emit("image-uploaded-to-s3", { fileName: receivedFileName });
  
    // Update frontend console log to reflect the correct emitted key
    console.log(`App.js:93 Frontend: Image successfully PUT to S3. Emitting 'image-uploaded-to-s3' for originalKey: ${receivedFileName}`);
    console.log("App.js:95 Frontend: 'image-uploaded-to-s3' event emitted.");
  
    alert("Image uploaded successfully!");
  } catch (err) {
    console.error("Error uploading image:", err);
    alert("Failed to upload image. See console for details.");
  }  

    // try {
    //    // generate a unique filename
    //   const fileName = `${uuidv4()}.${imageFile.name.split(".").pop()}`;

    //   console.log(`Frontend: Requesting upload URL for fileName: ${fileName}`);

    //   const response = await axios.get(`${BACKEND_URL}/upload-url?fileName=${fileName}`);
    //   const { uploadUrl } = response.data;
    //   console.log(`Frontend: Uploading image to S3: ${uploadUrl}`);

    //   // 2. Upload the image directly to S3 using the pre-signed URL
    //   await axios.put(uploadUrl, imageFile, {
    //     headers: {
    //       "Content-Type": imageFile.type,
    //     },
    //   });

    //   // Tell the backend the image is ready in S3
    //   console.log(`Frontend: Image successfully PUT to S3. Emitting 'image-uploaded-to-s3' for originalKey: ${fileName}`);
    //   socket.emit("image-uploaded-to-s3", { originalKey: fileName });
    //   console.log(`Frontend: 'image-uploaded-to-s3' event emitted.`);


    //   alert("Image uploaded to S3 successfully! Processing will begin shortly.");

    // } catch (err) {
    //   console.error("Upload error:", err);
    //   alert("Image upload failed. Check console for details.");
    // }
  };

  useEffect(() => {
    socket.on("time-ready", ({ time }) => {
      setStoredTime(time);
    });

    socket.on("image-blurred", async ({ blurredKey, originalKey }) => {
      console.log('🖼️ Received blurred image notification:', blurredKey);
      
      // Construct the public S3 URL for the blurred image
      const newBlurredUrl = await fetchDisplayUrl(blurredKey);
      setBlurredImageUrl(newBlurredUrl);

      // fetch presigned URL for the original image for display too
      if (originalKey) {
          const newOriginalUrl = await fetchDisplayUrl(originalKey);
          setOriginalDisplayUrl(newOriginalUrl); // ⬅️ SET NEW STATE
      }
      
      alert("Blurred image received and ready for display!");
    });

    return () => {
      socket.off("time-ready");
      socket.off("image-blurred");
      socket.off("image-uploaded-to-s3");
    };
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "3rem", fontFamily: "Inter, sans-serif" }}>
      <h1 style={{ color: '#2c3e50' }}>Image Processing App</h1>

      <div style={{ background: '#ecf0f1', padding: '20px', borderRadius: '10px', margin: '20px auto', maxWidth: '500px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#34495e' }}>Timestamp Feature</h2>
        <button
          onClick={handleClick}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
        >
          Store Current Time
        </button>
        {storedTime && (
          <p style={{ marginTop: '15px', fontSize: '1.1em', color: '#34495e' }}>
            Stored Time: <span style={{ fontWeight: 'bold', color: '#2c3e50' }}>{new Date(storedTime).toLocaleString()}</span>
          </p>
        )}
      </div>
      
      <hr style={{ margin: "2rem auto", width: '80%', borderColor: '#bdc3c7' }} />

      <div style={{ background: '#ecf0f1', padding: '20px', borderRadius: '10px', margin: '20px auto', maxWidth: '500px', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ color: '#34495e' }}>Image Blurring Service</h2>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
          style={{ display: 'block', margin: '15px auto', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}
        />
        <button
          onClick={handleUpload}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#2ecc71',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            transition: 'background-color 0.3s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2ecc71'}
        >
          Upload Image to AWS S3
        </button>

        {originalDisplayUrl && (
          <div style={{ marginTop: "20px", borderTop: '1px solid #bdc3c7', paddingTop: '20px' }}>
            <p style={{ fontSize: '1.1em', color: '#34495e' }}>Original Image (from S3):</p>
            <img
              src={originalDisplayUrl} 
              alt="Uploaded Original"
              style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
            />
          </div>
        )}

        {blurredImageUrl && (
          <div style={{ marginTop: "20px", borderTop: '1px solid #bdc3c7', paddingTop: '20px' }}>
            <p style={{ fontSize: '1.1em', color: '#34495e' }}>Blurred Image (from S3):</p>
            <img
              src={blurredImageUrl}
              alt="Blurred"
              style={{ maxWidth: "100%", maxHeight: "300px", borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
